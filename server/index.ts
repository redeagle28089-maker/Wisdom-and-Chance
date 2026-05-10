import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer, request as httpRequest } from "http";
import { initializeWebSocket } from "./websocket";
import { preWarmOidc } from "./replit_integrations/auth/replitAuth";
import { storage } from "./storage";

const app = express();
const httpServer = createServer(app);

initializeWebSocket(httpServer);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await storage.initialize();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV !== "production") {
    app.get("/mobile", (_req, res) => {
      const domain = process.env.REPLIT_DEV_DOMAIN || "localhost";
      const mobileUrl = `https://${domain}:8080`;
      res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mobile Preview</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0D0D14;display:flex;flex-direction:column;height:100vh;font-family:system-ui,sans-serif}
.toolbar{background:#1a1a2e;padding:8px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #333}
.toolbar a{color:#6C63FF;text-decoration:none;font-size:14px}
.toolbar span{color:#888;font-size:13px}
.toolbar .dot{width:8px;height:8px;border-radius:50%;background:#4ade80}
.frame-wrap{flex:1;display:flex;justify-content:center;padding:16px;overflow:hidden}
.phone-frame{width:390px;height:100%;border:2px solid #333;border-radius:24px;overflow:hidden;background:#0D0D14;box-shadow:0 0 40px rgba(108,99,255,0.15)}
iframe{width:100%;height:100%;border:none}
.full .phone-frame{width:100%;border-radius:0;border:none}
</style>
</head><body>
<div class="toolbar">
<div class="dot"></div>
<span>Mobile Preview</span>
<a href="#" onclick="document.body.classList.toggle('full');return false">Toggle Frame</a>
<a href="${mobileUrl}" target="_blank">Open Direct ↗</a>
<a href="/" target="_self">← Back to Web App</a>
</div>
<div class="frame-wrap">
<div class="phone-frame">
<iframe src="${mobileUrl}" allow="clipboard-write"></iframe>
</div>
</div>
</body></html>`);
    });
  }

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    // Intentional dev-only lazy load: Vite must not be bundled into the
    // production artifact; esbuild excludes it via the dynamic import at
    // runtime, which is safe here because this branch never executes in prod.
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      // Pre-warm OIDC discovery in background to improve login reliability
      preWarmOidc().catch(() => {
        // Error already logged in preWarmOidc
      });
    },
  );
})();
