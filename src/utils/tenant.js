import { User } from "../models/User.js";
import { Influencer } from "../models/Influencer.js";

export async function resolveTenantContext(req) {
  const user = await User.findById(req.user.id);
  if (!user) return { user: null, brandId: null };
  if (user.role === "influencer") {
    const profile = await Influencer.findOne({ userId: user._id });
    return { user, brandId: profile?.brandId || user.brandId || null, influencerId: profile?._id || null };
  }
  return { user, brandId: user.brandId || null, influencerId: null };
}

export function requireBrand(brandId) {
  if (!brandId) {
    const err = new Error("Tenant brand is missing");
    err.status = 400;
    throw err;
  }
  return brandId;
}
