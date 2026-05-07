import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer = null;

export async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected (primary URI)");
    return { mode: "primary" };
  } catch (error) {
    const allowMemoryFallback = process.env.ALLOW_MEMORY_DB_FALLBACK !== "false";
    const isProd = process.env.NODE_ENV === "production";
    if (!allowMemoryFallback || isProd) {
      throw error;
    }

    console.warn(`Primary DB failed: ${error.message}`);
    console.warn("Starting in-memory MongoDB fallback for local development...");
    memoryServer = await MongoMemoryServer.create();
    const inMemoryUri = memoryServer.getUri("Influencer");
    await mongoose.connect(inMemoryUri);
    console.log("MongoDB connected (in-memory fallback)");
    return { mode: "memory" };
  }
}
