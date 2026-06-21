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
            role: payload.role,
            traderToken: payload.traderToken,
            accountNumber: payload.accountNumber,
            email: payload.email
        };

        if (!req.portalUser.traderToken) {
            return res.status(401).json({
                message: "Trading session token missing."
            });
        }

        return next();
    } catch {
        return res.status(401).json({
            message: "Invalid or expired session."
        });
    }
}
