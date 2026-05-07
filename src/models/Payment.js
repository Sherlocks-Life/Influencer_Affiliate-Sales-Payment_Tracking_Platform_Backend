import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    influencerId: { type: mongoose.Schema.Types.ObjectId, ref: "Influencer", required: true },
    brandId: { type: String, required: true, index: true },
    totalAmount: { type: Number, required: true },
    commission: { type: Number, required: true },

    status: {
      type: String,
      enum: ["initiated", "pending", "approved", "processing", "paid", "failed", "cancelled"],
      default: "initiated",
      index: true
    },

    // Checkout/payment gateway tracking
    orderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },
    paymentCapturedAt: { type: Date },

    // Payout tracking
    razorpayPayoutId: { type: String, index: true },
    payoutDate: { type: Date },

    // Failure/cancellation metadata
    failureReason: { type: String },
    cancelledReason: { type: String },

    // Status lifecycle timeline
    initiatedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    processingAt: { type: Date },
    failedAt: { type: Date },
    cancelledAt: { type: Date },
    paidAt: { type: Date },

    // Extensible event metadata
    gatewayMeta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export const Payment = mongoose.model("Payment", paymentSchema);
