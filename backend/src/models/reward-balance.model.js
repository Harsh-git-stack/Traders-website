import mongoose from "mongoose";

const rewardBalanceSchema = new mongoose.Schema(
    {
        tenantId: { type: String, required: true, index: true },
        userId: {
            type: String,
            required: true,
            index: true
        },
        accountNumber: {
            type: Number,
            index: true
        },
        email: {
            type: String,
            trim: true
        },
        balance: {
            type: Number,
            default: 0,
            min: 0
        },
        totalEarned: {
            type: Number,
            default: 0
        },
        totalRedeemed: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: "USD"
        }
    },
    {
        timestamps: true,
        collection: "reward_balances"
    }
);

rewardBalanceSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export const RewardBalance = mongoose.model("RewardBalance", rewardBalanceSchema);
