import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { login } from "../services/spring.service.js";

function getUser(user = {}) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountNumber: user.accountNumber,
        accountType: user.accountType,
        accountPlan: user.accountPlan,
        accountPlanName: user.accountPlanName,
        swapValue: user.swapValue,
        isBlocked: user.isBlocked
    };
}

export async function userLogin(req, res) {
    try {
        const { email, id, password } = req.body;

        if ((!email && !id) || !password) {
            return res.status(400).json({
                message: "Email/account ID and password are required."
            });
        }

        const userData = await login({ email, id, password });

        const traderToken = userData.token;
        const user = userData.user;


        if (!traderToken || !user) {
            return res.status(502).json({
                message: "Invalid login response from nexfordServer"
            })
        }

        const portalToken = jwt.sign(
            {
                sub: user.id,
                role: user.role,
                traderToken,
                accountNumber: user.accountNumber,
                email: user.email
            },
            env.portalJwtSecret,
            { expiresIn: env.portalJwtExpiresIn }
        );

        return res.json({
            token: portalToken,
            user: getUser(user)
        })


    } catch (error) {
        const status = error.response?.status || 500;
        const message =
            error.response?.data?.message ||
            error.response?.data ||
            "Login failed.";

        return res.status(status).json({
            message
        });
    }
}

export function userLogout(req, res) {
    return res.json({
        ok: true,
        message: "Logged out."
    });
}

