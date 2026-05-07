import express from "express";
import mongoose from "mongoose";
import { authRequired } from "../middleware/auth.js";
import { Sale } from "../models/Sale.js";
import { Click } from "../models/Click.js";
import { Influencer } from "../models/Influencer.js";
import { aiFraudSummary, generateInsights, generateInfluencerInsights, predictSales } from "../services/aiService.js";
import { requireBrand, resolveTenantContext } from "../utils/tenant.js";

const router = express.Router();

router.get("/overview", authRequired, async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const [sales, clicks, topInfluencers] = await Promise.all([
      Sale.find({ brandId }),
      Click.find({ brandId }),
      Sale.aggregate([
        { $match: { brandId } },
        { $group: { _id: "$influencerId", revenue: { $sum: "$amount" }, sales: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ])
    ]);
    const totalRevenue = sales.reduce((sum, s) => sum + s.amount, 0);
    const conversionRate = clicks.length ? (sales.length / clicks.length) * 100 : 0;
    const resolvedTop = await Promise.all(
      topInfluencers.map(async (x) => {
        const info = await Influencer.findById(x._id);
        return { name: info?.displayName || x._id, revenue: x.revenue, sales: x.sales };
      })
    );

    const byDay = await Sale.aggregate([
      { $match: { brandId } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" }
          },
          value: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      { $limit: 30 }
    ]);
    const salesOverTime = byDay.map((x) => ({ day: `${x._id.y}-${x._id.m}-${x._id.d}`, value: x.value }));

    res.json({
      totalRevenue,
      totalSales: sales.length,
      totalClicks: clicks.length,
      conversionRate: Number(conversionRate.toFixed(2)),
      topInfluencers: resolvedTop,
      salesOverTime
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/ai-insights", authRequired, async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const [salesCount, clicksCount, weekendSales] = await Promise.all([
      Sale.countDocuments({ brandId }),
      Click.countDocuments({ brandId }),
      Sale.aggregate([
        { $match: { brandId } },
        { $addFields: { dayOfWeek: { $dayOfWeek: "$createdAt" } } },
        { $group: { _id: "$dayOfWeek", revenue: { $sum: "$amount" } } }
      ])
    ]);
    const conversionRate = clicksCount ? (salesCount / clicksCount) * 100 : 0;
    const insights = await generateInsights({ salesCount, clicksCount, conversionRate, weekendSales });
    res.json({ insights });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/sales-prediction", authRequired, async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const days = Number(req.query.days || 7);
    const horizon = days === 30 ? 30 : 7;
    const byDay = await Sale.aggregate([
      { $match: { brandId } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" }
          },
          value: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      { $limit: 30 }
    ]);
    const history = byDay.map((x) => ({ day: `${x._id.y}-${x._id.m}-${x._id.d}`, value: x.value }));
    res.json({ history, prediction: predictSales(history, horizon), horizonDays: horizon });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/fraud-detection", authRequired, async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const [clickAgg, saleAgg, ipAgg] = await Promise.all([
      Click.aggregate([{ $match: { brandId } }, { $group: { _id: "$influencerId", clicks: { $sum: 1 } } }]),
      Sale.aggregate([
        { $match: { brandId } },
        { $group: { _id: "$influencerId", sales: { $sum: 1 }, revenue: { $sum: "$amount" } } }
      ]),
      Click.aggregate([
        { $match: { brandId } },
        { $group: { _id: { influencerId: "$influencerId", ip: "$ipAddress" }, count: { $sum: 1 } } },
        { $match: { count: { $gte: 15 } } }
      ])
    ]);

    const clickMap = new Map(clickAgg.map((x) => [String(x._id), x.clicks]));
    const saleMap = new Map(saleAgg.map((x) => [String(x._id), x]));
    const influencerIds = [...new Set([...clickMap.keys(), ...saleMap.keys()])];

    const findings = [];
    for (const id of influencerIds) {
      const clicks = clickMap.get(id) || 0;
      const sales = saleMap.get(id)?.sales || 0;
      const revenue = saleMap.get(id)?.revenue || 0;
      const conversionRate = clicks ? (sales / clicks) * 100 : 0;
      const repeatedIps = ipAgg.filter((x) => String(x._id.influencerId) === id);
      const repeatedIpCount = repeatedIps.reduce((sum, x) => sum + x.count, 0);

      let risk = null;
      let reason = "";

      if (clicks >= 50 && conversionRate < 0.5) {
        risk = "high";
        reason = "Abnormal click spike with near-zero conversion — possible bot traffic";
      } else if (clicks >= 20 && conversionRate < 1) {
        risk = "medium";
        reason = "High click volume with unusually low conversion";
      } else if (repeatedIpCount >= 30) {
        risk = "high";
        reason = `Repeated clicks from same IPs (${repeatedIpCount} hits) — potential click fraud`;
      }

      if (risk) {
        const influencer = await Influencer.findById(id);
        findings.push({
          influencerId: id,
          name: influencer?.displayName || id,
          clicks,
          sales,
          revenue,
          conversionRate: Number(conversionRate.toFixed(2)),
          risk,
          reason
        });
      }
    }

    const aiSummary = await aiFraudSummary(findings);
    res.json({ findings, totalFlagged: findings.length, aiSummary });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/fraud-trends", authRequired, async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);

    const clickTrends = await Click.aggregate([
      { $match: { brandId } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" }
          },
          clicks: { $sum: 1 },
          uniqueIps: { $addToSet: "$ipAddress" }
        }
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      { $limit: 30 }
    ]);

    const saleTrends = await Sale.aggregate([
      { $match: { brandId } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" }
          },
          sales: { $sum: 1 }
        }
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      { $limit: 30 }
    ]);

    const saleMap = new Map(saleTrends.map((x) => [`${x._id.y}-${x._id.m}-${x._id.d}`, x.sales]));

    const trends = clickTrends.map((x) => {
      const day = `${x._id.y}-${x._id.m}-${x._id.d}`;
      const sales = saleMap.get(day) || 0;
      const uniqueIps = x.uniqueIps?.length || 0;
      const ipRatio = x.clicks > 0 ? x.clicks / Math.max(1, uniqueIps) : 0;
      return {
        day,
        clicks: x.clicks,
        sales,
        uniqueIps,
        ipRatio: Number(ipRatio.toFixed(2)),
        suspicious: ipRatio > 5 || (x.clicks > 50 && sales === 0)
      };
    });

    res.json({ trends });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/influencer/:influencerId/insights", authRequired, async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const influencerId = req.params.influencerId;

    const [clicks, sales, dayOfWeekSales] = await Promise.all([
      Click.countDocuments({ influencerId, brandId }),
      Sale.find({ influencerId, brandId }).sort({ createdAt: -1 }),
      Sale.aggregate([
        { $match: { influencerId: new mongoose.Types.ObjectId(influencerId), brandId } },
        { $addFields: { dayOfWeek: { $dayOfWeek: "$createdAt" } } },
        { $group: { _id: "$dayOfWeek", revenue: { $sum: "$amount" }, sales: { $sum: 1 } } }
      ])
    ]);

    const revenue = sales.reduce((sum, s) => sum + s.amount, 0);
    const conversionRate = clicks ? (sales.length / clicks) * 100 : 0;

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const bestDayEntry = dayOfWeekSales.sort((a, b) => b.revenue - a.revenue)[0];
    const bestDay = bestDayEntry ? dayNames[bestDayEntry._id - 1] : null;

    const weekendRevenue = dayOfWeekSales
      .filter((x) => x._id === 1 || x._id === 7)
      .reduce((sum, x) => sum + x.revenue, 0);
    const weekdayRevenue = dayOfWeekSales
      .filter((x) => x._id >= 2 && x._id <= 6)
      .reduce((sum, x) => sum + x.revenue, 0);

    const insights = generateInfluencerInsights({
      bestDay,
      weekendRevenue,
      weekdayRevenue,
      clicks,
      sales: sales.length,
      conversionRate: Number(conversionRate.toFixed(2))
    });

    const recentSales = sales.slice(0, 10).map((s) => ({
      amount: s.amount,
      orderId: s.orderId,
      date: s.createdAt
    }));

    res.json({
      clicks,
      sales: sales.length,
      revenue,
      conversionRate: Number(conversionRate.toFixed(2)),
      bestDay,
      weekendRevenue,
      weekdayRevenue,
      insights,
      recentSales
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

router.get("/influencer/:influencerId", authRequired, async (req, res) => {
  try {
    const context = await resolveTenantContext(req);
    const brandId = requireBrand(context.brandId);
    const influencerId = req.params.influencerId;
    const [clicks, sales] = await Promise.all([
      Click.countDocuments({ influencerId, brandId }),
      Sale.find({ influencerId, brandId }).sort({ createdAt: -1 })
    ]);
    const revenue = sales.reduce((sum, s) => sum + s.amount, 0);
    const conversionRate = clicks ? (sales.length / clicks) * 100 : 0;
    res.json({
      clicks,
      sales: sales.length,
      revenue,
      conversionRate: Number(conversionRate.toFixed(2)),
      recentSales: sales.slice(0, 10).map((s) => ({
        amount: s.amount,
        productId: s.productId,
        orderId: s.orderId,
        date: s.createdAt
      }))
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
});

export default router;

