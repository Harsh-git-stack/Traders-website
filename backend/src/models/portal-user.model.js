import mongoose from "mongoose";

const portalUserSchema = new mongoose.Schema(
    {
        tenantId: {
            type: String,
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        passwordHash: {
            type: String,
            required: true
        },
        role: {
            type: String,
            default: "USER"
        },
        selectedTradingAccountId: {
            type: String,
            default: null,
            index: true
        },
        tradingUserId: {
            type: String,
            default: null,
            index: true
        },
        accountNumber: {
            type: Number,
            default: null,
            index: true
        },
        accountType: {
            type: String,
            default: null
        },
        accountPlan: {
            type: String,
            default: null
        },
        accountPlanName: {
            type: String,
            default: null
        },
        referralCode: {
            type: String,
            trim: true,
            uppercase: true,
            sparse: true,
            index: true
        },
        referredByCode: {
            type: String,
            trim: true,
            uppercase: true,
            default: null,
            index: true
        },
        referredByUserId: {
            type: String,
            default: null,
            index: true
        },
        referredByName: {
            type: String,
            default: null,
            trim: true
        },
        swapValue: {
            type: Boolean,
            default: false
        },
        isBlocked: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        collection: "portal_users"
    }
);

portalUserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
portalUserSchema.index(
    { tenantId: 1, referralCode: 1 },
    { unique: true, partialFilterExpression: { referralCode: { $type: "string" } } }
);

export const PortalUser = mongoose.model("PortalUser", portalUserSchema);
