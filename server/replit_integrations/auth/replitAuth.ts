import crypto from "crypto";
import passport from "passport";
import { Strategy as GoogleStrategy, type Profile as GoogleProfile } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage, ensureUserProvidersTable, backfillProviderLinks, migrateEmailsToLowercase, ProviderConflictError } from "./storage";

// Simple retry utility (replaces p-retry to avoid ESM bundling issues)
async function retry<T>(
  fn: () => Promise<T>,
  options: { retries: number; minTimeout: number; maxTimeout: number; factor: number }
): Promise<T> {
  let lastError: Error | undefined;
  let timeout = options.minTimeout;
  
  for (let attempt = 1; attempt <= options.retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (attempt <= options.retries) {
        console.log(
          `[auth] Attempt ${attempt} failed: ${error.message}. ` +
          `${options.retries + 1 - attempt} retries left. Waiting ${timeout}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, timeout));
        timeout = Math.min(timeout * options.factor, options.maxTimeout);
      }
    }
  }
  
  throw lastError;
}

// OIDC Configuration Types
interface OIDCMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint: string;
  jwks_uri: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
  scope: string;
}

interface JWTHeader {
  alg: string;
  typ: string;
  kid?: string;
}

interface JWTClaims {
  sub: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
}

interface JWK {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

interface JWKS {
  keys: JWK[];
}

// Extend session data type
declare module "express-session" {
  interface SessionData {
    pendingAuth?: {
      nonce: string;
      codeVerifier: string;
      createdAt: number;
      redirectTarget?: "web" | "mobile";
      googleState?: string;
    };
  }
}

// Validate required environment variables
function validateAuthEnvironment(): { valid: boolean; error?: string } {
  if (!process.env.REPL_ID) {
    return { valid: false, error: "REPL_ID environment variable is missing" };
  }
  if (!process.env.SESSION_SECRET) {
    return { valid: false, error: "SESSION_SECRET environment variable is missing" };
  }
  return { valid: true };
}

// Cache for OIDC metadata
let cachedMetadata: OIDCMetadata | null = null;
let metadataCacheExpiry: number = 0;

// Cache for JWKS
let cachedJWKS: JWKS | null = null;
let jwksCacheExpiry: number = 0;

async function discoverOIDCMetadata(): Promise<OIDCMetadata> {
  const issuerUrl = process.env.ISSUER_URL ?? "https://replit.com/oidc";
  
  return await retry(
    async () => {
      console.log("[auth] Fetching OIDC discovery document...");
      const response = await fetch(`${issuerUrl}/.well-known/openid-configuration`);
      if (!response.ok) {
        throw new Error(`Failed to fetch OIDC metadata: ${response.status}`);
      }
      const metadata = await response.json() as OIDCMetadata;
      console.log("[auth] OIDC discovery successful");
      return metadata;
    },
    {
      retries: 5,
      minTimeout: 1000,
      maxTimeout: 10000,
      factor: 2,
    }
  );
}

async function getOIDCMetadata(): Promise<OIDCMetadata> {
  const now = Date.now();
  if (cachedMetadata && now < metadataCacheExpiry) {
    return cachedMetadata;
  }
  
  const validation = validateAuthEnvironment();
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const metadata = await discoverOIDCMetadata();
  cachedMetadata = metadata;
  metadataCacheExpiry = now + (3600 * 1000); // Cache for 1 hour
  return metadata;
}

async function fetchJWKS(jwksUri: string): Promise<JWKS> {
  const now = Date.now();
  if (cachedJWKS && now < jwksCacheExpiry) {
    return cachedJWKS;
  }
  
  console.log("[auth] Fetching JWKS...");
  const response = await fetch(jwksUri);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }
  const jwks = await response.json() as JWKS;
  cachedJWKS = jwks;
  jwksCacheExpiry = now + (3600 * 1000); // Cache for 1 hour
  console.log("[auth] JWKS fetched successfully, keys:", jwks.keys.length);
  return jwks;
}

// Convert JWK to Node.js crypto key
function jwkToPublicKey(jwk: JWK): crypto.KeyObject {
  // For RSA keys
  if (jwk.kty === "RSA" && jwk.n && jwk.e) {
    const keyData = {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    };
    return crypto.createPublicKey({
      key: keyData,
      format: "jwk",
    });
  }
  
  // For EC keys
  if (jwk.kty === "EC" && jwk.x && jwk.y && jwk.crv) {
    const keyData = {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
    };
    return crypto.createPublicKey({
      key: keyData,
      format: "jwk",
    });
  }
  
  throw new Error(`Unsupported JWK key type: ${jwk.kty}`);
}

// Decode JWT without verification (to get header for key lookup)
function decodeJWTHeader(token: string): JWTHeader {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const header = Buffer.from(parts[0], "base64url").toString("utf-8");
  return JSON.parse(header);
}

// Decode JWT payload without verification
function decodeJWTPayload(token: string): JWTClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload);
}

// Verify JWT signature
function verifyJWTSignature(token: string, publicKey: crypto.KeyObject, algorithm: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }
  
  const signedData = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(parts[2], "base64url");
  
  // Map JWT algorithm to Node.js algorithm
  let nodeAlgorithm: string;
  switch (algorithm) {
    case "RS256":
      nodeAlgorithm = "RSA-SHA256";
      break;
    case "RS384":
      nodeAlgorithm = "RSA-SHA384";
      break;
    case "RS512":
      nodeAlgorithm = "RSA-SHA512";
      break;
    case "ES256":
      nodeAlgorithm = "SHA256";
      break;
    case "ES384":
      nodeAlgorithm = "SHA384";
      break;
    case "ES512":
      nodeAlgorithm = "SHA512";
      break;
    default:
      throw new Error(`Unsupported JWT algorithm: ${algorithm}`);
  }
  
  const verifier = crypto.createVerify(nodeAlgorithm);
  verifier.update(signedData);
  
  return verifier.verify(publicKey, signature);
}

// Verify and decode JWT with full validation
async function verifyAndDecodeJWT(
  token: string, 
  metadata: OIDCMetadata,
  expectedNonce?: string
): Promise<JWTClaims> {
  // Decode header to get kid and algorithm
  const header = decodeJWTHeader(token);
  
  // Fetch JWKS
  const jwks = await fetchJWKS(metadata.jwks_uri);
  
  // Find the matching key
  let matchingKey: JWK | undefined;
  if (header.kid) {
    matchingKey = jwks.keys.find(k => k.kid === header.kid);
  }
  if (!matchingKey && jwks.keys.length === 1) {
    matchingKey = jwks.keys[0];
  }
  if (!matchingKey) {
    throw new Error("No matching key found in JWKS for token verification");
  }
  
  // Convert JWK to public key
  const publicKey = jwkToPublicKey(matchingKey);
  
  // Verify signature
  const isValid = verifyJWTSignature(token, publicKey, header.alg);
  if (!isValid) {
    throw new Error("JWT signature verification failed");
  }
  
  // Decode payload
  const claims = decodeJWTPayload(token);
  
  // Validate issuer
  if (claims.iss !== metadata.issuer) {
    throw new Error(`Invalid issuer: expected ${metadata.issuer}, got ${claims.iss}`);
  }
  
  // Validate audience
  const clientId = process.env.REPL_ID!;
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(clientId)) {
    throw new Error(`Invalid audience: expected ${clientId}, got ${claims.aud}`);
  }
  
  // Validate expiration
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) {
    throw new Error("Token has expired");
  }
  
  // Validate issued at (with 5 minute clock skew tolerance)
  if (claims.iat && claims.iat > now + 300) {
    throw new Error("Token issued in the future");
  }
  
  // Validate nonce if provided
  if (expectedNonce && claims.nonce !== expectedNonce) {
    throw new Error("Nonce mismatch");
  }
  
  console.log("[auth] JWT verified successfully for sub:", claims.sub);
  return claims;
}

// PKCE helpers
function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

function generateCodeVerifier(): string {
  return generateRandomString(64);
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState(): string {
  return generateRandomString(32);
}

function generateNonce(): string {
  return generateRandomString(32);
}

// Pre-warm OIDC discovery
export async function preWarmOidc() {
  try {
    console.log("[auth] Pre-warming OIDC discovery...");
    const metadata = await getOIDCMetadata();
    // Also pre-fetch JWKS
    await fetchJWKS(metadata.jwks_uri);
    console.log("[auth] OIDC pre-warming complete");
  } catch (error: any) {
    console.error("[auth] OIDC pre-warming failed:", error.message);
  }
}

// Session configuration
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const pgStore = connectPg(session);

let sessionStoreInstance: InstanceType<typeof pgStore> | null = null;

export function getSessionStore() {
  if (!sessionStoreInstance) {
    sessionStoreInstance = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  }
  return sessionStoreInstance;
}

export function getSessionSecret() {
  return process.env.SESSION_SECRET!;
}

export function getSession() {
  return session({
    secret: getSessionSecret(),
    store: getSessionStore(),
    resave: false,
    saveUninitialized: true, // Changed to true to save session before login
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

async function upsertUser(claims: JWTClaims, provider: "replit" | "google") {
  const dbUser = await authStorage.upsertUser(
    {
      id: claims.sub,
      email: claims.email || "",
      firstName: claims.first_name || null,
      lastName: claims.last_name || null,
      profileImageUrl: claims.profile_image_url || null,
    },
    { provider, providerSub: claims.sub }
  );

  // Auto-promote the configured admin email to users.isAdmin=true when the
  // holder signs in via verified web SSO (Replit OIDC or Google). Mobile
  // email login refuses the admin email outright (mobileAuth), so only a
  // cryptographically verified SSO callback can land here for the admin —
  // that's what makes it safe to flip the flag automatically. See task #61.
  try {
    const { isAdminEmail } = await import("../../adminConfig");
    const { db } = await import("../../db");
    const { users } = await import("@shared/models/auth");
    const { eq } = await import("drizzle-orm");
    if (isAdminEmail(dbUser.email) && !dbUser.isAdmin) {
      await db.update(users).set({ isAdmin: true, updatedAt: new Date() }).where(eq(users.id, dbUser.id));
      dbUser.isAdmin = true;
      console.log(`[auth] Auto-promoted admin account to isAdmin=true via ${provider} SSO — userId=${dbUser.id}`);
    }
  } catch (e) {
    console.error("[auth] Error auto-promoting admin account:", e);
  }

  try {
    const { ensureCurrencies, grantStarterCollection } = await import("../../economyService");
    await ensureCurrencies(dbUser.id);
    await grantStarterCollection(dbUser.id);
  } catch (e) {
    console.error("[auth] Error granting starter economy:", e);
  }

  return dbUser;
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(
  metadata: OIDCMetadata,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.REPL_ID!,
    code_verifier: codeVerifier,
  });

  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${error}`);
  }

  const tokens = await response.json() as TokenResponse;
  
  // Validate token response
  if (!tokens.id_token) {
    throw new Error("Token response missing id_token");
  }
  if (tokens.token_type?.toLowerCase() !== "bearer") {
    throw new Error(`Unexpected token_type: ${tokens.token_type}`);
  }
  
  return tokens;
}

// Refresh access token
async function refreshAccessToken(
  metadata: OIDCMetadata,
  refreshToken: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.REPL_ID!,
  });

  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  return await response.json() as TokenResponse;
}

export async function setupAuth(app: Express) {
  // Ensure the user_providers table exists before any auth code runs.
  await ensureUserProvidersTable();

  // Normalise any mixed-case emails stored before this guard was in place.
  // Must run before backfillProviderLinks so mobile provider_sub values are consistent.
  await migrateEmailsToLowercase();

  // Backfill provider links for legacy accounts created before user_providers tracking.
  // Runs at startup; idempotent and safe to re-run on every deploy.
  await backfillProviderLinks();

  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Resolve the public hostname Replit OIDC was registered with. The workspace
  // canvas iframe sends a host header containing the dev port (`...replit.dev:5000`)
  // which Replit's OIDC client does NOT have whitelisted as a callback URL —
  // that produces the "This screen doesn't exist" page after sign-in. Prefer
  // REPLIT_DOMAINS (canonical, port-less) whenever the request host carries a
  // non-standard port. In production, REPLIT_DOMAINS is also set and is correct.
  function resolveOidcHost(req: import("express").Request): string {
    const rawHost = req.get("host") || req.hostname;
    const hasNonStandardPort = /:\d+$/.test(rawHost) && !/:(80|443)$/.test(rawHost);
    if (hasNonStandardPort && process.env.REPLIT_DOMAINS) {
      const canonical = process.env.REPLIT_DOMAINS.split(",")[0].trim();
      if (canonical) return canonical;
    }
    return rawHost.replace(/:(80|443)$/, "");
  }

  app.get("/api/login", async (req, res) => {
    try {
      const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
      const host = resolveOidcHost(req);
      console.log("[auth] Login initiated from host:", host, "(raw:", req.get("host"), ")");
      console.log("[auth] Environment:", isProduction ? "production" : "development");
      
      const metadata = await getOIDCMetadata();
      const callbackUrl = `https://${host}/api/callback`;
      
      const state = generateState();
      const nonce = generateNonce();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      
      // Store pending auth in session (not global Map)
      // Accept an explicit redirect target so the callback knows where to send the user
      // without relying on user-agent sniffing.
      const redirectTarget = req.query.redirect === "mobile" ? "mobile" : "web";
      req.session.pendingAuth = {
        nonce,
        codeVerifier,
        createdAt: Date.now(),
        redirectTarget,
      };
      
      // Save session before redirecting
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      const authUrl = new URL(metadata.authorization_endpoint);
      authUrl.searchParams.set("client_id", process.env.REPL_ID!);
      authUrl.searchParams.set("redirect_uri", callbackUrl);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid email profile offline_access");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("nonce", nonce);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      
      console.log("[auth] Redirecting to auth URL");
      res.redirect(authUrl.href);
    } catch (error: any) {
      console.error("[auth] Login error:", error?.message || error);
      console.error("[auth] Login error stack:", error?.stack);
      
      let errorMsg: string;
      const msg = error?.message || "";
      
      if (msg.includes("REPL_ID") || msg.includes("SESSION_SECRET")) {
        errorMsg = "Server configuration error. Please contact the app owner.";
      } else if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo") || msg.includes("EAI_AGAIN")) {
        errorMsg = "Cannot reach authentication server. Please try again in a moment.";
      } else if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
        errorMsg = "Authentication timed out. Please try again.";
      } else {
        errorMsg = "Authentication service temporarily unavailable. Please try again.";
      }
      
      res.redirect("/?error=auth_failed&message=" + encodeURIComponent(errorMsg));
    }
  });

  app.get("/api/callback", async (req, res) => {
    try {
      const host = resolveOidcHost(req);
      console.log("[auth] Callback received from host:", host, "(raw:", req.get("host"), ")");
      
      const { code, state, error: authError, error_description } = req.query as { 
        code?: string; 
        state?: string; 
        error?: string;
        error_description?: string;
      };
      
      if (authError) {
        console.error("[auth] Auth error from provider:", authError, error_description);
        return res.redirect("/?error=auth_failed&message=" + encodeURIComponent(error_description || authError));
      }
      
      if (!code) {
        console.error("[auth] Missing code in callback");
        return res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Invalid callback parameters"));
      }
      
      // Get pending auth from session
      const pending = req.session.pendingAuth;
      if (!pending) {
        console.error("[auth] No pending auth in session");
        return res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Session expired. Please try again."));
      }
      
      // Check if pending auth is too old (10 minutes max)
      if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
        delete req.session.pendingAuth;
        console.error("[auth] Pending auth expired");
        return res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Session expired. Please try again."));
      }
      
      // Capture redirect target before clearing pending auth
      const redirectTarget = pending.redirectTarget ?? "web";
      
      // Clear pending auth
      delete req.session.pendingAuth;
      
      const metadata = await getOIDCMetadata();
      const callbackUrl = `https://${host}/api/callback`;
      
      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(metadata, code, pending.codeVerifier, callbackUrl);
      
      // Verify ID token with full signature and claim validation
      const claims = await verifyAndDecodeJWT(tokens.id_token, metadata, pending.nonce);

      // Reject logins where the provider didn't supply an email — we require
      // email to enable cross-platform account linking.
      if (!claims.email) {
        console.error("[auth] Replit OIDC callback: provider returned no email for sub:", claims.sub);
        return res.redirect(
          "/?error=auth_failed&message=" +
          encodeURIComponent("Your Replit account did not provide an email address. Please ensure your Replit account has a verified email.")
        );
      }
      
      const dbUser = await upsertUser(claims, "replit");
      const effectiveUserId = dbUser.id;

      try {
        const { seedStarterDecks } = await import("../starter-decks");
        await seedStarterDecks(effectiveUserId);
      } catch (error) {
        console.warn("[auth] Failed to seed starter decks:", error);
      }
      
      const sessionClaims = { ...claims, sub: effectiveUserId };
      const user = {
        claims: sessionClaims,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: claims.exp,
      };
      
      req.login(user, (err) => {
        if (err) {
          console.error("[auth] Login error after callback:", err);
          return res.redirect("/?error=auth_failed");
        }
        console.log("[auth] Login successful for user:", effectiveUserId, "→ redirect:", redirectTarget);
        // Honor the device hint captured at /api/login: PC users land on the
        // web app ("/"), mobile users on the Expo download page ("/mobile-app").
        res.redirect(redirectTarget === "mobile" ? "/mobile-app" : "/");
      });
    } catch (error: unknown) {
      if (error instanceof ProviderConflictError) {
        console.error("[auth] Provider identity conflict in callback:", error.message);
        return res.redirect(
          "/?error=auth_failed&message=" +
          encodeURIComponent(
            "This Replit account is already linked to a different user account. " +
            "Please sign in with the account you originally used."
          )
        );
      }
      const err = error as Error;
      console.error("[auth] Callback error:", err.message ?? error);
      console.error("[auth] Callback error stack:", err.stack);
      res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Authentication failed. Please try again."));
    }
  });

  // ── Google OAuth 2.0 ──────────────────────────────────────────────────────
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: "/api/callback/google",
          proxy: true,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          // This verify callback is only called during the OAuth round-trip;
          // we complete user creation in the /api/callback/google route handler
          // where we also have access to req.session for the redirect target.
          done(null, profile);
        }
      )
    );

    app.get("/api/login/google", (req, res, next) => {
      const redirectTarget = req.query.redirect === "mobile" ? "mobile" : "web";
      const googleState = crypto.randomBytes(20).toString("hex");
      req.session.pendingAuth = {
        nonce: "",
        codeVerifier: "",
        createdAt: Date.now(),
        redirectTarget,
        googleState,
      };
      req.session.save((err) => {
        if (err) console.error("[google] Session save error before login:", err);
        passport.authenticate("google", { scope: ["profile", "email"], state: googleState })(req, res, next);
      });
    });

    app.get(
      "/api/callback/google",
      // State validation — must run before passport to prevent login-CSRF
      (req, res, next) => {
        const receivedState = req.query.state as string | undefined;
        const pending = req.session.pendingAuth;
        if (
          !pending ||
          !pending.googleState ||
          !receivedState ||
          receivedState !== pending.googleState
        ) {
          console.error("[google] State mismatch — possible CSRF attempt");
          return res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Session expired. Please try again."));
        }
        next();
      },
      passport.authenticate("google", { failureRedirect: "/?error=auth_failed", session: false }),
      async (req, res) => {
        try {
          const profile = req.user as GoogleProfile;
          const email = profile.emails?.[0]?.value;

          if (!email) {
            console.error("[google] No verified email in Google profile");
            return res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Google account has no accessible email."));
          }

          const googleClaims: JWTClaims = {
            sub: `google:${profile.id}`,
            email,
            first_name: profile.name?.givenName || undefined,
            last_name: profile.name?.familyName || undefined,
            profile_image_url: profile.photos?.[0]?.value || undefined,
          };

          const dbUser = await upsertUser(googleClaims, "google");

          try {
            const { seedStarterDecks } = await import("../starter-decks");
            await seedStarterDecks(dbUser.id);
          } catch (e) {
            console.warn("[google] Failed to seed starter decks:", e);
          }

          const sessionUser = {
            claims: { sub: dbUser.id, email: dbUser.email },
            access_token: "",
            refresh_token: null,
            expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
            provider: "google",
          };

          const googleRedirectTarget = req.session.pendingAuth?.redirectTarget ?? "web";
          req.login(sessionUser, (err) => {
            if (err) {
              console.error("[google] Login error:", err);
              return res.redirect("/?error=auth_failed");
            }
            delete req.session.pendingAuth;
            console.log("[google] Login successful for user:", dbUser.id, "→ redirect:", googleRedirectTarget);
            // Match Replit OIDC: PC → web app, mobile → Expo install page.
            res.redirect(googleRedirectTarget === "mobile" ? "/mobile-app" : "/");
          });
        } catch (error: unknown) {
          if (error instanceof ProviderConflictError) {
            console.error("[google] Provider identity conflict:", error.message);
            return res.redirect(
              "/?error=auth_failed&message=" +
              encodeURIComponent(
                "This Google account is already linked to a different user account. " +
                "Please sign in with the account you originally used."
              )
            );
          }
          const err = error as Error;
          console.error("[google] Callback error:", err.message ?? error);
          res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Google sign-in failed. Please try again."));
        }
      }
    );
  } else {
    console.log("[google] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google login disabled");
  }

  app.get("/api/logout", async (req, res) => {
    try {
      const metadata = await getOIDCMetadata();
      
      req.logout(() => {
        if (metadata.end_session_endpoint) {
          const logoutUrl = new URL(metadata.end_session_endpoint);
          logoutUrl.searchParams.set("client_id", process.env.REPL_ID!);
          logoutUrl.searchParams.set("post_logout_redirect_uri", `https://${req.get("host") || req.hostname}`);
          res.redirect(logoutUrl.href);
        } else {
          res.redirect("/");
        }
      });
    } catch (error: any) {
      console.error("[auth] Logout error:", error);
      req.logout(() => {
        res.redirect("/");
      });
    }
  });

  // Diagnostic endpoint
  app.get("/api/auth/status", async (req, res) => {
    const status: Record<string, any> = {
      environment: process.env.REPLIT_DEPLOYMENT === "1" ? "production" : "development",
      hostname: req.hostname,
      replIdPresent: !!process.env.REPL_ID,
      replIdPrefix: process.env.REPL_ID ? process.env.REPL_ID.substring(0, 8) : null,
      sessionSecretPresent: !!process.env.SESSION_SECRET,
      issuerUrl: process.env.ISSUER_URL || "https://replit.com/oidc (default)",
      databaseUrlPresent: !!process.env.DATABASE_URL,
      replitDomains: process.env.REPLIT_DOMAINS || "not set",
      openidClientVersion: "manual (fetch-based with JWKS verification)",
    };

    try {
      console.log("[auth/status] Testing OIDC discovery...");
      const metadata = await getOIDCMetadata();
      status.oidcDiscovery = "success";
      status.issuer = metadata.issuer;
      status.jwksUri = metadata.jwks_uri;
      
      // Also test JWKS fetch
      const jwks = await fetchJWKS(metadata.jwks_uri);
      status.jwksFetch = "success";
      status.jwksKeyCount = jwks.keys.length;
    } catch (error: any) {
      status.oidcDiscovery = "failed";
      status.oidcError = error?.message || "Unknown error";
      console.error("[auth/status] OIDC discovery failed:", error?.message);
    }

    res.json(status);
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  // Google sessions don't use Replit OIDC refresh tokens
  if (user.provider === "google") {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const metadata = await getOIDCMetadata();
    const tokens = await refreshAccessToken(metadata, refreshToken);
    
    // Verify the refreshed ID token as well
    const claims = await verifyAndDecodeJWT(tokens.id_token, metadata);

    // Preserve the canonical user ID: look up the provider link so that
    // linked accounts (e.g. mobile-first users whose id is a UUID, not the
    // Replit sub) keep the correct sub in session after token refresh.
    const canonicalUser = await authStorage.upsertUser(
      {
        id: claims.sub,
        email: claims.email || "",
        firstName: claims.first_name || null,
        lastName: claims.last_name || null,
        profileImageUrl: claims.profile_image_url || null,
      },
      { provider: "replit", providerSub: claims.sub }
    );
    
    user.claims = { ...claims, sub: canonicalUser.id };
    user.access_token = tokens.access_token;
    user.refresh_token = tokens.refresh_token || refreshToken;
    user.expires_at = claims.exp;

    // Persist the refreshed tokens back to the session so the next
    // request doesn't have to refresh again immediately.
    await new Promise<void>((resolve) => {
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("[auth] Failed to save session after token refresh:", saveErr);
        }
        resolve();
      });
    });
    
    return next();
  } catch (error: unknown) {
    const err = error as Error;
    if (error instanceof ProviderConflictError) {
      console.error("[auth] Provider conflict during token refresh:", err.message);
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const isNetworkError =
      err.message?.includes("getaddrinfo") ||
      err.message?.includes("ENOTFOUND") ||
      err.message?.includes("EAI_AGAIN");

    if (isNetworkError) {
      console.error("[auth] Token refresh failed due to service unavailability:", err.message);
      res.status(503).json({
        message: "Authentication service temporarily unavailable. Please try again.",
        retryable: true,
      });
    } else {
      console.error("[auth] Token refresh failed:", err.message);
      res.status(401).json({ message: "Unauthorized" });
    }
    return;
  }
};
