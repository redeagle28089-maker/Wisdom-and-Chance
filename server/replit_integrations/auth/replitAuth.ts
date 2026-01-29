import { Issuer, generators, Client, TokenSet } from "openid-client";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import pRetry from "p-retry";
import { authStorage } from "./storage";

// Validate required environment variables for auth
function validateAuthEnvironment(): { valid: boolean; error?: string } {
  if (!process.env.REPL_ID) {
    return { valid: false, error: "REPL_ID environment variable is missing" };
  }
  if (!process.env.SESSION_SECRET) {
    return { valid: false, error: "SESSION_SECRET environment variable is missing" };
  }
  return { valid: true };
}

// Cache for OIDC issuer and client
let cachedIssuer: Issuer | null = null;
let cacheExpiry: number = 0;

async function discoverIssuerWithRetry(): Promise<Issuer> {
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  console.log(`[auth] Environment: ${isProduction ? "production" : "development"}`);
  console.log(`[auth] REPL_ID: ${process.env.REPL_ID ? process.env.REPL_ID.substring(0, 8) + "..." : "MISSING"}`);
  
  const validation = validateAuthEnvironment();
  if (!validation.valid) {
    console.error(`[auth] Environment validation failed: ${validation.error}`);
    throw new Error(validation.error);
  }
  
  return await pRetry(
    async () => {
      console.log("[auth] Attempting OIDC discovery...");
      const issuerUrl = process.env.ISSUER_URL ?? "https://replit.com/oidc";
      const issuer = await Issuer.discover(issuerUrl);
      console.log("[auth] OIDC discovery successful");
      return issuer;
    },
    {
      retries: 5,
      minTimeout: 1000,
      maxTimeout: 10000,
      factor: 2,
      onFailedAttempt: (error: any) => {
        console.log(
          `[auth] OIDC discovery attempt ${error.attemptNumber} failed: ${error.message}. ` +
          `${error.retriesLeft} retries left.`
        );
      },
    }
  );
}

async function getIssuer(): Promise<Issuer> {
  const now = Date.now();
  if (cachedIssuer && now < cacheExpiry) {
    return cachedIssuer;
  }
  
  const issuer = await discoverIssuerWithRetry();
  cachedIssuer = issuer;
  cacheExpiry = now + (3600 * 1000); // Cache for 1 hour
  return issuer;
}

function createClient(issuer: Issuer, callbackUrl: string): Client {
  return new issuer.Client({
    client_id: process.env.REPL_ID!,
    token_endpoint_auth_method: "none",
    redirect_uris: [callbackUrl],
    response_types: ["code"],
  });
}

// Pre-warm OIDC discovery at startup
export async function preWarmOidc() {
  try {
    console.log("[auth] Pre-warming OIDC discovery...");
    await getIssuer();
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
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// Store state and nonce for OIDC flow
const pendingAuth = new Map<string, { nonce: string; codeVerifier: string }>();

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", async (req, res) => {
    try {
      const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
      console.log("[auth] Login initiated from hostname:", req.hostname);
      console.log("[auth] Environment:", isProduction ? "production" : "development");
      
      const issuer = await getIssuer();
      const callbackUrl = `https://${req.hostname}/api/callback`;
      const client = createClient(issuer, callbackUrl);
      
      const state = generators.state();
      const nonce = generators.nonce();
      const codeVerifier = generators.codeVerifier();
      const codeChallenge = generators.codeChallenge(codeVerifier);
      
      pendingAuth.set(state, { nonce, codeVerifier });
      
      // Clean up old pending auth entries (older than 10 minutes)
      setTimeout(() => pendingAuth.delete(state), 10 * 60 * 1000);
      
      const authUrl = client.authorizationUrl({
        scope: "openid email profile offline_access",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "login consent",
      });
      
      console.log("[auth] Redirecting to auth URL");
      res.redirect(authUrl);
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
      console.log("[auth] Callback received from hostname:", req.hostname);
      
      const { code, state } = req.query as { code?: string; state?: string };
      
      if (!code || !state) {
        console.error("[auth] Missing code or state in callback");
        return res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Invalid callback parameters"));
      }
      
      const pending = pendingAuth.get(state);
      if (!pending) {
        console.error("[auth] No pending auth for state:", state);
        return res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Session expired. Please try again."));
      }
      
      pendingAuth.delete(state);
      
      const issuer = await getIssuer();
      const callbackUrl = `https://${req.hostname}/api/callback`;
      const client = createClient(issuer, callbackUrl);
      
      const tokenSet = await client.callback(callbackUrl, { code, state }, {
        state,
        nonce: pending.nonce,
        code_verifier: pending.codeVerifier,
      });
      
      const claims = tokenSet.claims();
      await upsertUser(claims);
      
      const user = {
        claims,
        access_token: tokenSet.access_token,
        refresh_token: tokenSet.refresh_token,
        expires_at: claims.exp,
      };
      
      req.login(user, (err) => {
        if (err) {
          console.error("[auth] Login error after callback:", err);
          return res.redirect("/?error=auth_failed");
        }
        res.redirect("/");
      });
    } catch (error: any) {
      console.error("[auth] Callback error:", error);
      console.error("[auth] Callback error stack:", error?.stack);
      res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Authentication failed. Please try again."));
    }
  });

  app.get("/api/logout", async (req, res) => {
    try {
      const issuer = await getIssuer();
      const endSessionUrl = issuer.metadata.end_session_endpoint;
      
      req.logout(() => {
        if (endSessionUrl) {
          const logoutUrl = new URL(endSessionUrl);
          logoutUrl.searchParams.set("client_id", process.env.REPL_ID!);
          logoutUrl.searchParams.set("post_logout_redirect_uri", `https://${req.hostname}`);
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
      openidClientVersion: "5.x",
    };

    try {
      console.log("[auth/status] Testing OIDC discovery...");
      const issuer = await getIssuer();
      status.oidcDiscovery = "success";
      status.issuer = issuer.metadata.issuer;
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

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const issuer = await getIssuer();
    const client = createClient(issuer, `https://${req.hostname}/api/callback`);
    const tokenSet = await client.refresh(refreshToken);
    
    user.claims = tokenSet.claims();
    user.access_token = tokenSet.access_token;
    user.refresh_token = tokenSet.refresh_token || refreshToken;
    user.expires_at = user.claims?.exp;
    
    return next();
  } catch (error: any) {
    const isDiscoveryError = error?.message?.includes("getaddrinfo") || 
                             error?.message?.includes("ENOTFOUND") ||
                             error?.message?.includes("EAI_AGAIN");
    
    if (isDiscoveryError) {
      console.error("[auth] Token refresh failed due to service unavailability:", error?.message);
      res.status(503).json({ 
        message: "Authentication service temporarily unavailable. Please try again.",
        retryable: true 
      });
    } else {
      console.error("[auth] Token refresh failed:", error?.message);
      res.status(401).json({ message: "Unauthorized" });
    }
    return;
  }
};
