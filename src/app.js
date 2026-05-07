import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import influencerRoutes from "./routes/influencerRoutes.js";
import trackingRoutes from "./routes/trackingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

function getAllowedOrigins() {
  const raw = process.env.CLIENT_URL || "https://influencer-affiliate-sales-payment-tracking-platform-6oru54zvz.vercel.app/";
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin tools/health checks with no Origin header.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true
    })
  );
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/influencer", influencerRoutes);
  app.use("/api/track", trackingRoutes);
  app.use("/api/payment", paymentRoutes);
  app.use("/api/analytics", analyticsRoutes);

  return app;
}
