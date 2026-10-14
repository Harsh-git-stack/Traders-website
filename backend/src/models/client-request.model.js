import mongoose from "mongoose";

const clientRequestSchema = new mongoose.Schema(
    {
        tenantId: { type: String, required: true, index: true },
        userId: {
            type: String,
            required: true,
            index: true
        },
        // The portal profile owns the cash wallet. userId above identifies the
        // selected trading account and is intentionally kept for core services.
        portalUserId: {
            type: String,
            default: null,
            index: true
        },
        accountNumber: {
            type: Number
        },
        email: {
            type: String,
            trim: true
        },
        type: {
            type: String,
            enum: ["DEPOSIT", "WITHDRAWAL", "SUPPORT", "REWARD_REDEMPTION"],
            required: true
        },
        method: {
            type: String,
            required: true,
            trim: true
        },
        amount: {
            type: Number,
            required: true,
            min: 1
        },
        utr: {
            type: String,
            required: true,
            trim: true
        },
        payerName: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            trim: true
        },
        payload: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING",
            index: true
        },
        reviewedBy: {
            type: String,
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        adminNote: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true,
        collection: "client_requests"
    }
);

clientRequestSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
clientRequestSchema.index({ tenantId: 1, portalUserId: 1, createdAt: -1 });

export const ClientRequest = mongoose.model("ClientRequest", clientRequestSchema);
