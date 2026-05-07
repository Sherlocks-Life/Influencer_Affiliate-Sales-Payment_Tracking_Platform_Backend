import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { User } from "../models/User.js";
import { Influencer } from "../models/Influencer.js";
import { Click } from "../models/Click.js";
import { Sale } from "../models/Sale.js";
import { Payment } from "../models/Payment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");

function createSecret() {
  return randomBytes(64).toString("hex");
}

export function ensureJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const generated = createSecret();
  process.env.JWT_SECRET = generated;
  try {
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const next = `${existing.trimEnd()}\nJWT_SECRET=${generated}\n`;
    fs.writeFileSync(envPath, next, "utf8");
    console.log("JWT_SECRET auto-generated and saved to server/.env");
  } catch {
    console.log("JWT_SECRET auto-generated in memory (failed to persist in .env)");
  }
  return generated;
}

function referralForEmail(email) {
  const prefix = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8) || "INF";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

const seedAccounts = [
  { email: "admin1@influencerai.com", password: "Admin@123", role: "admin", brandName: "Brand One", brandId: "brand_one" },
  { email: "admin2@influencerai.com", password: "Admin@123", role: "admin", brandName: "Brand Two", brandId: "brand_two" },
  { email: "finance1@influencerai.com", password: "Finance@123", role: "finance", brandId: "brand_one" },
  { email: "finance2@influencerai.com", password: "Finance@123", role: "finance", brandId: "brand_two" },
  { email: "influencer1@influencerai.com", password: "Influencer@123", role: "influencer", brandId: "brand_one" },
  { email: "influencer2@influencerai.com", password: "Influencer@123", role: "influencer", brandId: "brand_two" }
];

export async function seedDefaultAccounts() {
  for (const account of seedAccounts) {
    const email = account.email.toLowerCase();
    let user = await User.findOne({ email });
    if (!user) {
      const passwordHash = await bcrypt.hash(account.password, 10);
      user = await User.create({
        email,
        passwordHash,
        role: account.role,
        brandName: account.brandName,
        brandId: account.brandId
      });
      console.log(`Seeded ${account.role}: ${email}`);
    }

    if (account.role === "influencer") {
      const existingProfile = await Influencer.findOne({ userId: user._id });
      if (!existingProfile) {
        let referralCode = referralForEmail(email);
        while (await Influencer.findOne({ referralCode })) {
          referralCode = referralForEmail(email);
        }
        await Influencer.create({
          userId: user._id,
          brandId: account.brandId,
          displayName: email.split("@")[0],
          referralCode
        });
        console.log(`Seeded influencer profile: ${email}`);
      }
    }
  }
}

/**
 * Seed realistic demo analytics data (clicks, sales, payments)
 * so dashboards show real values instead of zeros.
 */
export async function seedDemoAnalyticsData() {
  const influencers = await Influencer.find().limit(10);
  if (influencers.length === 0) {
    console.log("No influencers found, skipping demo analytics seed.");
    return;
  }

  const existingClicks = await Click.countDocuments();
  const existingSales = await Sale.countDocuments();
  if (existingClicks > 100 && existingSales > 20) {
    console.log("Demo analytics data already present, skipping re-seed.");
    return;
  }

  const commissionPercent = Number(process.env.COMMISSION_PERCENT || 10);
  const now = new Date();
  const daysBack = 30;

  for (let d = daysBack; d >= 0; d -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const influencer of influencers) {
      const weekendMultiplier = isWeekend ? (influencer.displayName.includes("1") ? 1.8 : 1.3) : 1.0;
      const baseClicks = Math.floor(Math.random() * 15 + 5);
      const clickCount = Math.floor(baseClicks * weekendMultiplier);

      for (let c = 0; c < clickCount; c += 1) {
        const clickDate = new Date(date);
        clickDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
        await Click.create({
          influencerId: influencer._id,
          brandId: influencer.brandId,
          referralCode: influencer.referralCode,
          ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          userAgent: "Mozilla/5.0 (compatible; Bot/0.1)",
          createdAt: clickDate
        });
      }

      let conversionRate = 0.08;
      if (influencer.displayName.includes("2")) conversionRate = 0.03;
      if (influencer.displayName.includes("1")) conversionRate = 0.12;

      const saleCount = Math.floor(clickCount * conversionRate);
      for (let s = 0; s < saleCount; s += 1) {
        const saleDate = new Date(date);
        saleDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
        const amount = Math.floor(Math.random() * 800 + 200);
        const orderId = `ORD-${influencer.brandId}-${Date.now()}-${s}-${d}`;
        const sale = await Sale.create({
          influencerId: influencer._id,
          brandId: influencer.brandId,
          referralCode: influencer.referralCode,
          amount,
          orderId,
          createdAt: saleDate
        });
        const commission = (amount * commissionPercent) / 100;
        await Payment.create({
          influencerId: influencer._id,
          brandId: influencer.brandId,
          totalAmount: amount,
          commission,
          status: Math.random() > 0.5 ? "pending" : (Math.random() > 0.5 ? "approved" : "paid"),
          createdAt: saleDate
        });
      }
    }
  }

  // Seed fraud patterns for both brands
  const fraudInfluencer1 = influencers.find((i) => i.displayName === "influencer1");
  if (fraudInfluencer1) {
    for (let c = 0; c < 250; c += 1) {
      const fraudDate = new Date(now);
      fraudDate.setDate(fraudDate.getDate() - 2);
      fraudDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
      await Click.create({
        influencerId: fraudInfluencer1._id,
        brandId: fraudInfluencer1.brandId,
        referralCode: fraudInfluencer1.referralCode,
        ipAddress: "203.0.113.55",
        userAgent: "Mozilla/5.0 FraudBot/1.0",
        createdAt: fraudDate
      });
    }
  }
  const fraudInfluencer2 = influencers.find((i) => i.displayName === "influencer2");
  if (fraudInfluencer2) {
    for (let c = 0; c < 250; c += 1) {
      const fraudDate = new Date(now);
      fraudDate.setDate(fraudDate.getDate() - 2);
      fraudDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
      await Click.create({
        influencerId: fraudInfluencer2._id,
        brandId: fraudInfluencer2.brandId,
        referralCode: fraudInfluencer2.referralCode,
        ipAddress: "203.0.113.66",
        userAgent: "Mozilla/5.0 FraudBot/1.0",
        createdAt: fraudDate
      });
    }
  }

  console.log("Seeded demo analytics data (clicks, sales, payments).");
}

export async function seedDemoDataForBrand(brandId, daysBack = 14) {
  if (!brandId) return;

  let influencers = await Influencer.find({ brandId }).limit(5);
  if (influencers.length === 0) {
    const dummyUser = await User.findOne({ brandId });
    if (!dummyUser) return;

    const displayName = dummyUser.email.split("@")[0];
    let referralCode = referralForEmail(dummyUser.email);
    while (await Influencer.findOne({ referralCode })) {
      referralCode = referralForEmail(dummyUser.email);
    }
    const influencer = await Influencer.create({
      userId: dummyUser._id,
      brandId,
      displayName,
      referralCode
    });
    influencers = [influencer];
  }

  const existingClicks = await Click.countDocuments({ brandId });
  const existingSales = await Sale.countDocuments({ brandId });
  if (existingClicks > 20 && existingSales > 5) {
    return;
  }

  const commissionPercent = Number(process.env.COMMISSION_PERCENT || 10);
  const now = new Date();

  for (let d = daysBack; d >= 0; d -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const influencer of influencers) {
      const weekendMultiplier = isWeekend ? 1.5 : 1.0;
      const baseClicks = Math.floor(Math.random() * 10 + 3);
      const clickCount = Math.floor(baseClicks * weekendMultiplier);

      for (let c = 0; c < clickCount; c += 1) {
        const clickDate = new Date(date);
        clickDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
        await Click.create({
          influencerId: influencer._id,
          brandId: influencer.brandId,
          referralCode: influencer.referralCode,
          ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          createdAt: clickDate
        });
      }

      const conversionRate = 0.1;
      const saleCount = Math.floor(clickCount * conversionRate);
      for (let s = 0; s < saleCount; s += 1) {
        const saleDate = new Date(date);
        saleDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
        const amount = Math.floor(Math.random() * 800 + 200);
        const orderId = `ORD-${influencer.brandId}-${Date.now()}-${s}-${d}`;
        const sale = await Sale.create({
          influencerId: influencer._id,
          brandId: influencer.brandId,
          referralCode: influencer.referralCode,
          amount,
          orderId,
          createdAt: saleDate
        });
        const commission = (amount * commissionPercent) / 100;
        await Payment.create({
          influencerId: influencer._id,
          brandId: influencer.brandId,
          totalAmount: amount,
          commission,
          status: Math.random() > 0.5 ? "pending" : (Math.random() > 0.5 ? "approved" : "paid"),
          createdAt: saleDate
        });
      }
    }
  }
  console.log(`Seeded demo data for brand: ${brandId}`);
}

