import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function generateInsights(payload) {
  if (!client) {
    return [
      "OpenAI key missing: showing fallback insight.",
      "Track weekend campaigns for influencers with higher conversion rates."
    ];
  }

  const prompt = `You are a growth analyst for an influencer affiliate platform.
Return exactly 3 concise insights as bullet points with action bias.
Prefer patterns like:
- best performing days
- high clicks but low conversion
- commission efficiency
Data: ${JSON.stringify(payload)}`;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    });
    const text = completion.choices?.[0]?.message?.content || "";
    return text
      .split("\n")
      .map((x) => x.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [
      "AI quota unavailable, using fallback insight logic.",
      "Monitor high-click low-conversion influencers weekly.",
      "Run weekend-first campaigns for top performers."
    ];
  }
}

export function predictSales(history, horizonDays = 7) {
  if (history.length < 2) return [];
  const series = history.map((x) => x.value);
  const step = (series[series.length - 1] - series[0]) / Math.max(1, series.length - 1);
  const next = [];
  for (let i = 1; i <= horizonDays; i += 1) {
    const value = Math.max(0, Math.round((series[series.length - 1] + step * i) * 100) / 100);
    next.push({ dayOffset: i, predictedRevenue: value });
  }
  return next;
}

export function generateInfluencerInsights({ bestDay, weekendRevenue, weekdayRevenue, clicks, sales, conversionRate }) {
  const insights = [];
  const totalRevenue = weekendRevenue + weekdayRevenue;
  const weekendShare = totalRevenue > 0 ? (weekendRevenue / totalRevenue) * 100 : 0;

  if (bestDay) {
    insights.push(`You perform best on ${bestDay}s — schedule more campaigns on this day.`);
  }
  if (weekendShare > 55) {
    insights.push(`Weekend performance is strong (${Math.round(weekendShare)}% of revenue). Consider weekend-exclusive offers.`);
  } else if (weekendShare < 30 && totalRevenue > 0) {
    insights.push(`Weekend revenue is under ${Math.round(weekendShare)}% — test weekend content strategies.`);
  }
  if (conversionRate < 2 && clicks > 50) {
    insights.push(`Low conversion (${conversionRate}%) despite ${clicks} clicks — optimize CTAs and landing pages.`);
  }
  if (conversionRate > 8) {
    insights.push(`Excellent conversion rate (${conversionRate}%). Your audience is highly qualified — scale up!`);
  }
  if (sales === 0 && clicks > 20) {
    insights.push(`High clicks but no sales yet. Verify product-audience fit and pricing.`);
  }
  if (insights.length === 0) {
    insights.push("Keep posting consistently to gather more performance signals.");
  }
  return insights.slice(0, 3);
}

export async function aiFraudSummary(findings) {
  if (!client) {
    return findings.length
      ? ["Potential fraud signals detected. Prioritize manual review for flagged influencers."]
      : ["No high-risk fraud pattern detected in current data."];
  }
  const prompt = `Summarize fraud risk findings in 1-2 actionable bullets.
Findings: ${JSON.stringify(findings)}`;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }]
    });
    const text = completion.choices?.[0]?.message?.content || "";
    return text
      .split("\n")
      .map((x) => x.replace(/^\s*[-*\d.)]+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 2);
  } catch {
    return findings.length
      ? ["Potential fraud signals detected. Prioritize manual review for flagged influencers."]
      : ["No high-risk fraud pattern detected in current data."];
  }
}
