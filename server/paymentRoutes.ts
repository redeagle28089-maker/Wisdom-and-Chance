import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { getActiveProducts, getProduct, purchaseWithCurrency, fulfillPurchase, getPurchaseHistory, seedPurchaseProducts, hasAlreadyPurchased } from "./paymentService";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

export async function registerPaymentRoutes(app: Express) {
  await seedPurchaseProducts();

  app.get("/api/payments/products", async (_req: any, res) => {
    try {
      const products = await getActiveProducts();
      res.json(products);
    } catch (error) {
      console.error("[payments] Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/payments/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const history = await getPurchaseHistory(userId);
      res.json(history);
    } catch (error) {
      console.error("[payments] Error fetching history:", error);
      res.status(500).json({ message: "Failed to fetch purchase history" });
    }
  });

  app.post("/api/payments/purchase-currency", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const schema = z.object({
        productId: z.string().min(1),
        currencyType: z.enum(["gold", "gems"]),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request", errors: parsed.error.errors });

      const result = await purchaseWithCurrency(userId, parsed.data.productId, parsed.data.currencyType);
      if (!result.success) {
        return res.status(400).json({ message: result.error, currencies: result.currencies });
      }
      res.json({ message: "Purchase successful", transaction: result.transaction, cards: result.cards, currencies: result.currencies });
    } catch (error) {
      console.error("[payments] Error in currency purchase:", error);
      res.status(500).json({ message: "Failed to process purchase" });
    }
  });

  app.post("/api/payments/check-purchased", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { productId } = req.body || {};
      if (!productId) return res.status(400).json({ message: "productId required" });
      const purchased = await hasAlreadyPurchased(userId, productId);
      res.json({ purchased });
    } catch (error) {
      res.status(500).json({ message: "Failed to check purchase status" });
    }
  });

  app.post("/api/payments/paypal/create-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { productId } = req.body || {};
      const product = await getProduct(productId);
      if (!product) return res.status(400).json({ message: "Product not found" });

      if (product.isOneTimePurchase) {
        const already = await hasAlreadyPurchased(userId, productId);
        if (already) return res.status(400).json({ message: "This one-time purchase has already been claimed" });
      }

      const clientId = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.status(503).json({ message: "PayPal is not configured yet" });
      }

      const baseUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

      const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      });
      if (!authResponse.ok) return res.status(500).json({ message: "PayPal auth failed" });
      const authData = await authResponse.json() as any;
      if (!authData.access_token) return res.status(500).json({ message: "PayPal auth failed" });

      const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.access_token}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: {
              currency_code: "USD",
              value: product.priceUsd.toString(),
            },
            description: product.name,
            custom_id: `${userId}|${productId}`,
            payee: {
              email_address: "reagle2808@aol.com",
            },
          }],
        }),
      });
      if (!orderResponse.ok) return res.status(500).json({ message: "Failed to create PayPal order" });
      const orderData = await orderResponse.json() as any;
      if (!orderData.id) return res.status(500).json({ message: "Failed to create PayPal order" });

      res.json({ orderId: orderData.id });
    } catch (error) {
      console.error("[payments] PayPal create order error:", error);
      res.status(500).json({ message: "Failed to create PayPal order" });
    }
  });

  app.post("/api/payments/paypal/capture-order", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { orderId, productId } = req.body || {};
      if (!orderId || !productId) return res.status(400).json({ message: "orderId and productId required" });

      const product = await getProduct(productId);
      if (!product) return res.status(400).json({ message: "Product not found" });

      const clientId = process.env.PAYPAL_CLIENT_ID;
      const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
      if (!clientId || !clientSecret) return res.status(503).json({ message: "PayPal is not configured" });

      const baseUrl = process.env.PAYPAL_API_URL || "https://api-m.sandbox.paypal.com";

      const authResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      });
      if (!authResponse.ok) return res.status(500).json({ message: "PayPal auth failed" });
      const authData = await authResponse.json() as any;

      const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.access_token}`,
        },
      });
      if (!captureResponse.ok) return res.status(500).json({ message: "PayPal capture failed" });
      const captureData = await captureResponse.json() as any;

      if (captureData.status !== "COMPLETED") {
        return res.status(400).json({ message: "Payment not completed", status: captureData.status });
      }

      const purchaseUnit = captureData.purchase_units?.[0];
      const customId = purchaseUnit?.payments?.captures?.[0]?.custom_id || purchaseUnit?.custom_id || "";
      const [metaUserId, metaProductId] = customId.split("|");
      if (metaUserId !== userId || metaProductId !== productId) {
        return res.status(403).json({ message: "Payment metadata mismatch" });
      }

      const capturedAmount = purchaseUnit?.payments?.captures?.[0]?.amount?.value;
      if (parseFloat(capturedAmount) < product.priceUsd) {
        return res.status(400).json({ message: "Payment amount mismatch" });
      }

      const result = await fulfillPurchase(userId, product, "paypal", orderId, product.priceUsd, 0);
      if (!result.success) return res.status(400).json({ message: result.error });

      res.json({ message: "Purchase successful", transaction: result.transaction, cards: result.cards });
    } catch (error) {
      console.error("[payments] PayPal capture error:", error);
      res.status(500).json({ message: "Failed to capture PayPal order" });
    }
  });

  app.post("/api/payments/stripe/create-checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { productId } = req.body || {};
      const product = await getProduct(productId);
      if (!product) return res.status(400).json({ message: "Product not found" });

      if (product.isOneTimePurchase) {
        const already = await hasAlreadyPurchased(userId, productId);
        if (already) return res.status(400).json({ message: "This one-time purchase has already been claimed" });
      }

      let stripe;
      try {
        stripe = await getUncachableStripeClient();
      } catch {
        return res.status(503).json({ message: "Stripe is not configured yet" });
      }

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: product.priceUsd * 100,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${baseUrl}/shop?payment=success&session_id={CHECKOUT_SESSION_ID}&product_id=${productId}`,
        cancel_url: `${baseUrl}/shop?payment=cancelled`,
        metadata: {
          userId,
          productId,
        },
        payment_intent_data: {
          metadata: {
            userId,
            productId,
          },
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("[payments] Stripe checkout error:", error);
      res.status(500).json({ message: "Failed to create Stripe checkout session" });
    }
  });

  app.get("/api/payments/stripe/verify-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const sessionId = req.query.session_id as string;
      if (!sessionId) return res.status(400).json({ message: "session_id required" });

      let stripe;
      try {
        stripe = await getUncachableStripeClient();
      } catch {
        return res.status(503).json({ message: "Stripe is not configured" });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed" });
      }
      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ message: "Payment does not belong to this user" });
      }

      const productId = session.metadata?.productId;
      if (!productId) return res.status(400).json({ message: "Invalid session metadata" });

      const product = await getProduct(productId);
      if (!product) return res.status(400).json({ message: "Product not found" });

      const amountPaidCents = session.amount_total || 0;
      if (amountPaidCents < product.priceUsd * 100) {
        return res.status(400).json({ message: "Payment amount mismatch" });
      }

      const result = await fulfillPurchase(userId, product, "stripe", sessionId, product.priceUsd, 0);
      if (!result.success) {
        if (result.error === "Payment already fulfilled") {
          return res.json({ message: "Purchase already completed", alreadyFulfilled: true });
        }
        return res.status(400).json({ message: result.error });
      }

      res.json({ message: "Purchase successful", transaction: result.transaction, cards: result.cards });
    } catch (error) {
      console.error("[payments] Stripe verify error:", error);
      res.status(500).json({ message: "Failed to verify Stripe session" });
    }
  });

  app.post("/api/payments/stripe/webhook", async (req: any, res) => {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return res.status(503).send("Stripe webhook not configured");
      }

      let stripe;
      try {
        stripe = await getUncachableStripeClient();
      } catch {
        return res.status(503).send("Stripe not configured");
      }

      const sig = req.headers["stripe-signature"];
      if (!sig) return res.status(400).send("Missing stripe-signature header");
      const event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, webhookSecret);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const { userId, productId } = session.metadata || {};
        if (userId && productId && session.payment_status === "paid") {
          const product = await getProduct(productId);
          if (product) {
            await fulfillPurchase(userId, product, "stripe", session.id, product.priceUsd, 0);
          }
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("[payments] Webhook error:", error);
      res.status(400).json({ message: "Webhook error" });
    }
  });

  app.get("/api/payments/config", async (_req: any, res) => {
    let stripeEnabled = false;
    let stripePublishableKey: string | null = null;
    try {
      stripePublishableKey = await getStripePublishableKey();
      stripeEnabled = !!stripePublishableKey;
    } catch {}

    res.json({
      paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
      stripePublishableKey,
      paypalEnabled: !!process.env.PAYPAL_CLIENT_ID,
      stripeEnabled,
    });
  });
}
