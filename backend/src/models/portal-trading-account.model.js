import mongoose from "mongoose";

const portalTradingAccountSchema = new mongoose.Schema(
    {
        tenantId: {
            type: String,
            required: true,
            index: true
        },
        portalUserId: {
            type: String,
            required: true,
            index: true
        },
        tradingUserId: {
            type: String,
            required: true,
            index: true
        },
        accountNumber: {
            type: Number,
            required: true,
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

portalTradingAccountSchema.index({ tenantId: 1, tradingUserId: 1 }, { unique: true });
portalTradingAccountSchema.index({ tenantId: 1, accountNumber: 1 }, { unique: true });

export const PortalTradingAccount = mongoose.model("PortalTradingAccount", portalTradingAccountSchema);
