import mongoose from "mongoose";

const walletBalanceSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            unique: true,
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
        currency: {
            type: String,
            default: "USD"
        }
    },
    {
        timestamps: true,
        collection: "wallet_balances"
    }
);

export const WalletBalance = mongoose.model("WalletBalance", walletBalanceSchema);
