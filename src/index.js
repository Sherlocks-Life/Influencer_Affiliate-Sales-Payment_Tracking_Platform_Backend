import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { setSocket } from "./sockets/index.js";
import { ensureJwtSecret, seedDefaultAccounts, seedDemoAnalyticsData } from "./services/bootstrapService.js";

const port = Number(process.env.PORT || 5000);
const app = createApp();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected", socket.id);
});

setSocket(io);
ensureJwtSecret();

connectDB(process.env.MONGO_URI)
  .then(async () => {
    await seedDefaultAccounts();
    await seedDemoAnalyticsData();
    server.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed", err.message);
    process.exit(1);
  });
