import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "Influencer", required: true },
    brandId: { type: String, required: true, index: true },
    referralCode: { type: String, required: true },
    amount: { type: Number, required: true },
    productId: { type: String },
    orderId: { type: String, required: true, unique: true }
  },
  { timestamps: true }
);

export const Sale = mongoose.model("Sale", saleSchema);
