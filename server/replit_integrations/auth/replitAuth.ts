import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import pRetry from "p-retry";
import { authStorage } from "./storage";

async function discoverOidcWithRetry() {
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  console.log(`[auth] Environment: ${isProduction ? "production" : "development"}`);
  console.log(`[auth] REPL_ID: ${process.env.REPL_ID ? "present" : "missing"}`);
  
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
      retries: 15,
      minTimeout: 1000,
      maxTimeout: 60000,
      factor: 1.5,
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

// Memoize with shorter cache time in production to handle cold starts better
const getOidcConfig = memoize(
  async () => {
    return await discoverOidcWithRetry();
  },
  { 
    maxAge: 3600 * 1000,
    // Don't cache errors - allow retry on next request
    promise: true
  }
);

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
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
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

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
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
      
      // More specific error message
      const errorMsg = error?.message?.includes("ENOTFOUND") || error?.message?.includes("getaddrinfo")
        ? "Cannot reach authentication server. Please try again in a moment."
        : "Authentication service temporarily unavailable. Please try again.";
      
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
