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

// Frontend URL
const allowedOrigins = [
  "http://localhost:5173",
  "https://influencer-affiliate-sales-payment-tracking-platform-6oru54zvz.vercel.app"
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
});

setSocket(io);

ensureJwtSecret();

// MongoDB Connection
connectDB(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");

    await seedDefaultAccounts();
    await seedDemoAnalyticsData();

    // IMPORTANT: Start Server
    server.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });
