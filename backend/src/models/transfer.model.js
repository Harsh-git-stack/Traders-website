import mongoose from "mongoose";

const transferSchema = new mongoose.Schema(
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
        type: {
            type: String,
            enum: ["WALLET_TO_TRADING", "TRADING_TO_WALLET"],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 1
        },
        from: {
            type: String,
            enum: ["WALLET", "TRADING"],
            required: true
        },
        to: {
            type: String,
            enum: ["WALLET", "TRADING"],
            required: true
        },
        status: {
            type: String,
            enum: ["COMPLETED", "FAILED"],
            default: "COMPLETED"
        },
        walletBalanceAfter: {
            type: Number
        },
        tradingBalanceAfter: {
            type: Number
        },
        note: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true,
        collection: "transfers"
    }
);

transferSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });

export const Transfer = mongoose.model("Transfer", transferSchema);
