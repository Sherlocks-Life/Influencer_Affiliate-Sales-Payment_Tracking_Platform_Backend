import "dotenv/config";
import http from "http";
import { Server } from "socket.io";

import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { setSocket } from "./sockets/index.js";

import {
  ensureJwtSecret,
  seedDefaultAccounts,
  seedDemoAnalyticsData
} from "./services/bootstrapService.js";

const port = process.env.PORT || 5000;

const app = createApp();

const server = http.createServer(app);

/*
|--------------------------------------------------------------------------
| Allowed Frontend URLs
|--------------------------------------------------------------------------
*/

const allowedOrigins = [
  "http://localhost:5173",

  // Main Production Frontend
  "https://influencer-affiliate-sales-payment-six.vercel.app",

  // Other Deployments
  "https://influencer-affiliate-sales-payment-tracking-platform-6oru54zvz.vercel.app",

  "https://influencer-affiliate-sales-payment-tracking-platform-n2fh627pp.vercel.app",

  "https://influencer-affiliate-s-git-4c2f63-akhilthadaka97-3631s-projects.vercel.app"
];

/*
|--------------------------------------------------------------------------
| Socket.IO Setup
|--------------------------------------------------------------------------
*/

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },

  transports: ["websocket", "polling"]
});

/*
|--------------------------------------------------------------------------
| Socket Connection
|--------------------------------------------------------------------------
*/

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

setSocket(io);

/*
|--------------------------------------------------------------------------
| Bootstrap
|--------------------------------------------------------------------------
*/

ensureJwtSecret();

/*
|--------------------------------------------------------------------------
| MongoDB Connection
|--------------------------------------------------------------------------
*/

connectDB(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");

    await seedDefaultAccounts();
    await seedDemoAnalyticsData();

    /*
    |--------------------------------------------------------------------------
    | Start Server
    |--------------------------------------------------------------------------
    */

    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  });
