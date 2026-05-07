import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Influencer } from "../models/Influencer.js";
import { seedDemoDataForBrand } from "../services/bootstrapService.js";

const router = express.Router();
const validRoles = new Set(["admin", "influencer", "finance"]);

function buildReferralCode(email) {
  const prefix = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8) || "INF";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

router.post("/signup", async (req, res) => {
  try {
    const { email, password, role = "influencer", brandName, brandId } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (!validRoles.has(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: "Email already exists" });
    const passwordHash = await bcrypt.hash(password, 10);
    const computedBrandId =
      role === "admin" ? brandId || `brand_${normalizedEmail.split("@")[0]}` : brandId || "brand_default";
    const user = await User.create({ email: normalizedEmail, passwordHash, role, brandName, brandId: computedBrandId });

    // Auto-create influencer profile so influencer dashboard works immediately after signup.
    if (role === "influencer") {
      const displayName = normalizedEmail.split("@")[0];
      let referralCode = buildReferralCode(normalizedEmail);
      while (await Influencer.findOne({ referralCode })) {
        referralCode = buildReferralCode(normalizedEmail);
      }
      await Influencer.create({
        userId: user._id,
        brandId: computedBrandId || "brand_default",
        displayName,
        referralCode
      });
    }

    // Seed demo analytics data for this brand so new users see data immediately
    try {
      await seedDemoDataForBrand(computedBrandId);
    } catch (e) {
      console.log("Demo data seeding skipped:", e.message);
    }

    return res.status(201).json({ id: user._id, role: user.role, brandId: computedBrandId });
  } catch (error) {
    return res.status(500).json({ message: "Signup failed", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: user._id.toString(), role: user.role, brandId: user.brandId || null }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });
    return res.json({ token, role: user.role, userId: user._id, brandId: user.brandId || null });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

export default router;
