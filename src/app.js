import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import influencerRoutes from "./routes/influencerRoutes.js";
import trackingRoutes from "./routes/trackingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";

export function createApp() {
  const app = express();

  // Allowed Frontend URLs
  const allowedOrigins = [
    "http://localhost:5173",

    // Production Vercel URL
    "https://influencer-affiliate-sales-payment-six.vercel.app",

    // Preview URL
    "https://influencer-affiliate-s-git-4c2f63-akhilthadaka97-3631s-projects.vercel.app",

    // New Deployment URL
    "https://influencer-affiliate-sales-payment-tracking-platform-n2fh627pp.vercel.app"
  ];

  // CORS Configuration
  app.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests without origin
        if (!origin) {
          return callback(null, true);
        }

        // Allow frontend domains
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.log("Blocked by CORS:", origin);

        return callback(
          new Error(`CORS blocked for origin: ${origin}`)
        );
      },

      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  );

  // JSON Middleware
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  // Health Route
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "API Running Successfully"
    });
  });

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/influencer", influencerRoutes);
  app.use("/api/track", trackingRoutes);
  app.use("/api/payment", paymentRoutes);
  app.use("/api/analytics", analyticsRoutes);

  return app;
}
