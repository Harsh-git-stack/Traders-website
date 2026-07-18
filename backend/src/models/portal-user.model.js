import mongoose from "mongoose";

const portalUserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
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

export const PortalUser = mongoose.model("PortalUser", portalUserSchema);
