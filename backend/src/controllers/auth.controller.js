import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { login, registerUser } from "../services/spring.service.js";
import { sendAccountCreatedEmail, sendWelcomeOtpEmail } from "../services/mail.service.js";

const pendingRegistrations = new Map();
const MAX_OTP_ATTEMPTS = 5;

function normalizeEmail(email = "") {
    return String(email).trim().toLowerCase();
}

function hashOtp(otp) {
    return crypto
        .createHmac("sha256", env.portalJwtSecret)
        .update(String(otp))
        .digest("hex");
}

function generateOtp() {
    return String(crypto.randomInt(100000, 1000000));
}

function getRegistrationPayload(body = {}) {
    return {
        name: String(body.name || "").trim(),
        email: normalizeEmail(body.email),
        password: String(body.password || ""),
        role: body.role || "USER",
        accountType: body.accountType || "LIVE",
        accountPlan: body.accountPlan || body.brokerAccountType || body.plan || body.accountCategory || "Standard STP",
        swap: Boolean(body.swap)
    };
}

function requireRegistrationFields(payload) {
    if (!payload.name || !payload.email || !payload.password) {
        return "Name, email and password are required.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        return "Enter a valid email address.";
    }

    if (payload.password.length < 12) {
        return "Password must be at least 12 characters.";
    }

    return "";
}

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

export async function requestRegistrationOtp(req, res) {
    const payload = getRegistrationPayload(req.body);
    const validationMessage = requireRegistrationFields(payload);

    if (validationMessage) {
        return res.status(400).json({ message: validationMessage });
    }

    try {
        const otp = generateOtp();
        const expiresAt = Date.now() + env.otpExpiresInMinutes * 60 * 1000;

        pendingRegistrations.set(payload.email, {
            payload,
            otpHash: hashOtp(otp),
            expiresAt,
            attempts: 0
        });

        await sendWelcomeOtpEmail({
            to: payload.email,
            name: payload.name,
            otp
        });

        return res.json({
            message: "Welcome to Nex Ford. OTP sent to your email.",
            expiresInMinutes: env.otpExpiresInMinutes
        });
    } catch (error) {
        pendingRegistrations.delete(payload.email);

        return res.status(500).json({
            message: error.message || "Could not send OTP email."
        });
    }
}

export async function verifyRegistrationOtp(req, res) {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
        return res.status(400).json({
            message: "Email and OTP are required."
        });
    }

    const pending = pendingRegistrations.get(email);

    if (!pending) {
        return res.status(400).json({
            message: "OTP expired or not requested. Please request a new OTP."
        });
    }

    if (Date.now() > pending.expiresAt) {
        pendingRegistrations.delete(email);
        return res.status(400).json({
            message: "OTP expired. Please request a new OTP."
        });
    }

    if (pending.otpHash !== hashOtp(otp)) {
        pending.attempts += 1;

        if (pending.attempts >= MAX_OTP_ATTEMPTS) {
            pendingRegistrations.delete(email);
            return res.status(429).json({
                message: "Too many incorrect OTP attempts. Please request a new OTP."
            });
        }

        return res.status(400).json({
            message: "Incorrect OTP. Please try again."
        });
    }

    try {
        const registeredUser = await registerUser(pending.payload);
        pendingRegistrations.delete(email);

        const user = registeredUser?.user || registeredUser || {};
        sendAccountCreatedEmail({
            to: pending.payload.email,
            name: pending.payload.name,
            loginId: user.accountNumber || user.id || registeredUser?.userId,
            password: pending.payload.password
        }).catch((error) => {
            console.warn("Could not send account-created email:", error.message);
        });

        return res.json({
            message: "User has been created."
        });
    } catch (error) {
        const status = error.response?.status || 500;
        const message =
            error.response?.data?.message ||
            error.response?.data ||
            "OTP verified, but registration failed.";

        return res.status(status).json({ message });
    }
}

export function userLogout(req, res) {
    return res.json({
        ok: true,
        message: "Logged out."
    });
}

