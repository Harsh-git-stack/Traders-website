import mongoose from "mongoose";

const portalTradingAccountSchema = new mongoose.Schema(
    {
        portalUserId: {
            type: String,
            required: true,
            index: true
        },
        tradingUserId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        accountNumber: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        accountType: {
            type: String,
            enum: ["DEMO", "LIVE"],
            required: true
        },
        accountPlan: {
            type: String,
            default: "STANDARD_STP"
        },
        accountPlanName: {
            type: String,
            default: "Standard STP"
        },
        springEmail: {
            type: String,
            trim: true
        },
        isBlocked: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        collection: "portal_trading_accounts"
    }
);

portalTradingAccountSchema.index({ portalUserId: 1, accountType: 1 }, { unique: true });

export const PortalTradingAccount = mongoose.model("PortalTradingAccount", portalTradingAccountSchema);
