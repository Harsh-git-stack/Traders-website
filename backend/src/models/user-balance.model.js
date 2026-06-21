import mongoose from "mongoose";

const userBalanceSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true
        },
        balance: {
            type: Number,
            default: 0
        },
        credit: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: false,
        collection: "user_balances"
    }
);

export const UserBalance = mongoose.model("UserBalance", userBalanceSchema);
