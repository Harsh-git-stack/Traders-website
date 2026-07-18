import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function requirePortalAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Missing authorization token."
        });
    }

    const token = authHeader.slice("Bearer ".length).trim(); //start from 7th char 

    try {
        const payload = jwt.verify(token, env.portalJwtSecret);
        req.portalUser = {
            id: payload.sub,
            portalUserId: payload.portalUserId,
            selectedTradingAccountId: payload.selectedTradingAccountId,
            role: payload.role,
            traderToken: payload.traderToken,
            accountNumber: payload.accountNumber,
            email: payload.email,
            hasTradingAccount: Boolean(payload.traderToken && payload.accountNumber)
        };

        return next();
    } catch {
        return res.status(401).json({
            message: "Invalid or expired session."
        });
    }
}

export function requireTradingAccount(req, res, next) {
    if (!req.portalUser?.traderToken || !req.portalUser?.accountNumber) {
        return res.status(409).json({
            message: "Please create a Demo or Live trading account first."
        });
    }

    return next();
}
