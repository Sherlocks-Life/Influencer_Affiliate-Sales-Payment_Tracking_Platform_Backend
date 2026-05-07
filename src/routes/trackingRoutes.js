import express from "express";
import { Influencer } from "../models/Influencer.js";
import { Click } from "../models/Click.js";
import { Sale } from "../models/Sale.js";
import { Payment } from "../models/Payment.js";
import { emitEvent } from "../sockets/index.js";

const router = express.Router();

router.post("/click", async (req, res) => {
  const { referralCode } = req.body;
  const influencer = await Influencer.findOne({ referralCode });
  if (!influencer) return res.status(404).json({ message: "Invalid referral code" });
  const click = await Click.create({
    influencerId: influencer._id,
    brandId: influencer.brandId,
    referralCode,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });
  emitEvent("click.created", { influencerId: influencer._id.toString(), referralCode });
  return res.status(201).json(click);
});

router.post("/sale", async (req, res) => {
  const { referralCode, amount, productId, orderId } = req.body;
  const influencer = await Influencer.findOne({ referralCode });
  if (!influencer) return res.status(404).json({ message: "Invalid referral code" });

  const sale = await Sale.create({
    influencerId: influencer._id,
    brandId: influencer.brandId,
    referralCode,
    amount,
    productId,
    orderId
  });
  const commissionPercent = Number(process.env.COMMISSION_PERCENT || 10);
  const commission = (amount * commissionPercent) / 100;
  const payment = await Payment.create({
    influencerId: influencer._id,
    brandId: influencer.brandId,
    totalAmount: amount,
    commission,
    status: "pending"
  });
  emitEvent("sale.created", { saleId: sale._id.toString(), amount, commission });
  return res.status(201).json({ sale, payment });
});

export default router;
