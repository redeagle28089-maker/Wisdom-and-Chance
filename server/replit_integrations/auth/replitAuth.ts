import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import pRetry from "p-retry";
import { authStorage } from "./storage";

// Use dynamic import for ESM-only openid-client to handle CJS bundling
type OpenIdClientModule = typeof import("openid-client");
type PassportStrategyModule = typeof import("openid-client/passport");

let clientModule: OpenIdClientModule | null = null;
let passportStrategyModule: PassportStrategyModule | null = null;

async function getOpenIdClient(): Promise<OpenIdClientModule> {
  if (!clientModule) {
    clientModule = await import("openid-client");
  }
  return clientModule;
}

async function getPassportStrategy(): Promise<PassportStrategyModule> {
  if (!passportStrategyModule) {
    passportStrategyModule = await import("openid-client/passport");
  }
  return passportStrategyModule;
}

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

async function discoverOidcWithRetry() {
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  console.log(`[auth] Environment: ${isProduction ? "production" : "development"}`);
  console.log(`[auth] REPL_ID: ${process.env.REPL_ID ? process.env.REPL_ID.substring(0, 8) + "..." : "MISSING"}`);
  
  // Validate environment before attempting discovery
  const validation = validateAuthEnvironment();
  if (!validation.valid) {
    console.error(`[auth] Environment validation failed: ${validation.error}`);
    throw new Error(validation.error);
  }
  
  const client = await getOpenIdClient();
  
  return await pRetry(
    async () => {
      console.log("[auth] Attempting OIDC discovery...");
      const config = await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      );
      console.log("[auth] OIDC discovery successful");
      return config;
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

// Pre-warm OIDC discovery at startup
export async function preWarmOidc() {
  try {
    console.log("[auth] Pre-warming OIDC discovery...");
    await getOidcConfig();
    console.log("[auth] OIDC pre-warming complete");
  } catch (error: any) {
    console.error("[auth] OIDC pre-warming failed:", error.message);
    // Don't throw - auth will retry on first request
  }
}

// Cache for OIDC config - simple implementation that doesn't cache failures
let cachedOidcConfig: Awaited<ReturnType<OpenIdClientModule["discovery"]>> | null = null;
let cacheExpiry: number = 0;

async function getOidcConfig() {
  const now = Date.now();
  if (cachedOidcConfig && now < cacheExpiry) {
    return cachedOidcConfig;
  }
  
  // Discovery failed cache was cleared or expired - try again
  const config = await discoverOidcWithRetry();
  cachedOidcConfig = config;
  cacheExpiry = now + (3600 * 1000); // Cache for 1 hour
  return config;
}

// Session configuration for reuse
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

function updateUserSession(
  user: any,
  tokens: any
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
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

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const { Strategy } = await getPassportStrategy();
  
  const verify = async (
    tokens: any,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies per domain
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain (lazy OIDC discovery)
  const ensureStrategy = async (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      // Lazy OIDC discovery - happens per-request, not at startup
      const config = await getOidcConfig();
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", async (req, res, next) => {
    try {
      const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
      console.log("[auth] Login initiated from hostname:", req.hostname);
      console.log("[auth] Environment:", isProduction ? "production" : "development");
      console.log("[auth] Full URL:", req.protocol + "://" + req.hostname + req.originalUrl);
      console.log("[auth] REPL_ID available:", !!process.env.REPL_ID);
      
      await ensureStrategy(req.hostname);
      console.log("[auth] Strategy ensured, starting authentication...");
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    } catch (error: any) {
      console.error("[auth] Login error:", error?.message || error);
      console.error("[auth] Login error stack:", error?.stack);
      console.error("[auth] REPL_ID:", process.env.REPL_ID ? "present" : "MISSING");
      console.error("[auth] ISSUER_URL:", process.env.ISSUER_URL || "using default");
      
      // Determine specific error message based on error type
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

  app.get("/api/callback", async (req, res, next) => {
    try {
      console.log("[auth] Callback received from hostname:", req.hostname);
      console.log("[auth] Callback query params:", JSON.stringify(req.query));
      await ensureStrategy(req.hostname);
      console.log("[auth] Callback strategy ensured, authenticating...");
      passport.authenticate(`replitauth:${req.hostname}`, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/?error=auth_failed",
      })(req, res, next);
    } catch (error: any) {
      console.error("[auth] Callback error:", error);
      console.error("[auth] Callback error stack:", error?.stack);
      res.redirect("/?error=auth_failed&message=" + encodeURIComponent("Authentication failed. Please try again."));
    }
  });

  app.get("/api/logout", async (req, res) => {
    try {
      const client = await getOpenIdClient();
      const config = await getOidcConfig();
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    } catch (error: any) {
      console.error("[auth] Logout error:", error);
      req.logout(() => {
        res.redirect("/");
      });
    }
  });

  // Diagnostic endpoint to check auth configuration in production
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
    };

    // Try OIDC discovery
    try {
      console.log("[auth/status] Testing OIDC discovery...");
      const config = await getOidcConfig();
      status.oidcDiscovery = "success";
      status.issuer = config.serverMetadata().issuer;
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
    const client = await getOpenIdClient();
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error: any) {
    // Check if this is a transient discovery error vs actual auth failure
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
