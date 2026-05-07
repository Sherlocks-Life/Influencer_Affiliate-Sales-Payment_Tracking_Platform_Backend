import express from "express";
import { authRequired, allowRoles } from "../middleware/auth.js";
import { Influencer } from "../models/Influencer.js";
import { resolveTenantContext, requireBrand } from "../utils/tenant.js";

const router = express.Router();

router.post("/create", authRequired, allowRoles("admin"), async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const { userId, displayName, referralCode, payoutUpi } = req.body;
    const influencer = await Influencer.create({ userId, brandId, displayName, referralCode, payoutUpi });
    res.status(201).json(influencer);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/profile-by-code/:referralCode", async (req, res) => {
  try {
    const influencer = await Influencer.findOne({ referralCode: req.params.referralCode });
    if (!influencer) return res.status(404).json({ message: "Influencer not found" });
    return res.json({
      _id: influencer._id,
      displayName: influencer.displayName,
      referralCode: influencer.referralCode,
      brandId: influencer.brandId
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

router.get("/list", authRequired, allowRoles("admin", "finance"), async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const influencers = await Influencer.find({ brandId }).sort({ createdAt: -1 });
    res.json(influencers);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/me/:userId", authRequired, async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const influencer = await Influencer.findOne({ userId: req.params.userId, brandId });
    res.json(influencer);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

export default router;
