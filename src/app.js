import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import influencerRoutes from "./routes/influencerRoutes.js";
import trackingRoutes from "./routes/trackingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

function getAllowedOrigins() {
  return [
    "http://localhost:5173",
    "https://influencer-affiliate-sales-payment-six.vercel.app",
    "https://influencer-affiliate-sales-payment-tracking-platform-6oru54zvz.vercel.app"
  ];
}

export function createApp() {
  const app = express();

  const allowedOrigins = getAllowedOrigins();

  // CORS Setup
  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests without origin (Postman, health checks)
        if (!origin) {
          return callback(null, true);
        }

        // Allow frontend URLs
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.log("Blocked Origin:", origin);

        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },

      credentials: true
    })
  );

  // JSON Parser
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  // Health Route
  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      message: "API Running Successfully"
    });
  });

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/influencer", influencerRoutes);
  app.use("/api/track", trackingRoutes);
  app.use("/api/payment", paymentRoutes);
  app.use("/api/analytics", analyticsRoutes);

  return app;
}
