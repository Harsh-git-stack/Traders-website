import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { login, registerUser } from "../services/spring.service.js";
import { sendAccountCreatedEmail, sendWelcomeOtpEmail } from "../services/mail.service.js";
import { PortalUser } from "../models/portal-user.model.js";
import { PortalTradingAccount } from "../models/portal-trading-account.model.js";

const pendingRegistrations = new Map();
const pendingPasswordResets = new Map();
const MAX_OTP_ATTEMPTS = 5;
const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 64;
const HASH_DIGEST = "sha512";

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

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
        .pbkdf2Sync(String(password), salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST)
        .toString("hex");

    return `pbkdf2$${HASH_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash = "") {
    const [scheme, iterations, salt, originalHash] = String(storedHash).split("$");

    if (scheme !== "pbkdf2" || !iterations || !salt || !originalHash) {
        return false;
    }

    const candidateHash = crypto
        .pbkdf2Sync(String(password), salt, Number(iterations), HASH_KEY_LENGTH, HASH_DIGEST)
        .toString("hex");

    const candidateBuffer = Buffer.from(candidateHash, "hex");
    const originalBuffer = Buffer.from(originalHash, "hex");

    return candidateBuffer.length === originalBuffer.length &&
        crypto.timingSafeEqual(candidateBuffer, originalBuffer);
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

function accountDto(account = null) {
    if (!account) return null;

    return {
        id: account._id?.toString?.() || account.id,
        tradingUserId: account.tradingUserId,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        accountPlan: account.accountPlan,
        accountPlanName: account.accountPlanName,
        isBlocked: account.isBlocked
    };
}

function getUser(user = {}, selectedAccount = null, accounts = []) {
    return {
        id: selectedAccount?.tradingUserId || user.tradingUserId || user.id || user._id?.toString(),
        portalUserId: user._id?.toString?.() || user.portalUserId,
        name: user.name,
        email: user.email,
        role: user.role,
        accountNumber: selectedAccount?.accountNumber || user.accountNumber,
        accountType: selectedAccount?.accountType || user.accountType,
        accountPlan: selectedAccount?.accountPlan || user.accountPlan,
        accountPlanName: selectedAccount?.accountPlanName || user.accountPlanName,
        swapValue: user.swapValue,
        isBlocked: selectedAccount?.isBlocked ?? user.isBlocked,
        selectedTradingAccountId: selectedAccount?._id?.toString?.() || user.selectedTradingAccountId || null,
        tradingAccounts: accounts.map(accountDto)
    };
}

function signPortalToken({ portalUser, selectedAccount = null, traderToken = null }) {
    return jwt.sign(
        {
            sub: selectedAccount?.tradingUserId || portalUser.tradingUserId || portalUser.id || portalUser._id?.toString(),
            portalUserId: portalUser._id?.toString?.() || portalUser.portalUserId,
            selectedTradingAccountId: selectedAccount?._id?.toString?.() || null,
            role: portalUser.role || "USER",
            traderToken,
            accountNumber: selectedAccount?.accountNumber || portalUser.accountNumber || null,
            email: portalUser.email,
            hasTradingAccount: Boolean(selectedAccount?.accountNumber && traderToken)
        },
        env.portalJwtSecret,
        { expiresIn: env.portalJwtExpiresIn }
    );
}

function springEmailForAccount(email, accountType) {
    const [localPart, domain] = normalizeEmail(email).split("@");
    if (!localPart || !domain) return normalizeEmail(email);
    return `${localPart}+${String(accountType).toLowerCase()}@${domain}`;
}

async function getPortalAccounts(portalUserId) {
    return PortalTradingAccount.find({ portalUserId: String(portalUserId) })
        .sort({ accountType: 1, createdAt: 1 })
        .lean();
}

async function getSelectedAccount(portalUser, accounts = null) {
    const portalUserId = portalUser._id?.toString?.() || portalUser.portalUserId;
    const list = accounts || await getPortalAccounts(portalUserId);
    return list.find((account) => String(account._id) === String(portalUser.selectedTradingAccountId)) ||
        list[0] ||
        null;
}

async function syncPortalUserFromSpring(user, passwordHash = null) {
    const email = normalizeEmail(user.email);
    const update = {
        name: user.name,
        email,
        role: user.role || "USER",
        tradingUserId: user.id,
        accountNumber: user.accountNumber,
        accountType: user.accountType,
        accountPlan: user.accountPlan,
        accountPlanName: user.accountPlanName,
        swapValue: user.swapValue,
        isBlocked: user.isBlocked
    };

    if (passwordHash) update.passwordHash = passwordHash;

    return PortalUser.findOneAndUpdate(
        { email },
        { $set: update, $setOnInsert: { passwordHash: passwordHash || crypto.randomUUID() } },
        { new: true, upsert: true }
    ).then(async (portalUser) => {
        const account = await PortalTradingAccount.findOneAndUpdate(
            { accountNumber: user.accountNumber },
            {
                $set: {
                    portalUserId: portalUser._id.toString(),
                    tradingUserId: user.id,
                    accountNumber: user.accountNumber,
                    accountType: String(user.accountType || "LIVE").toUpperCase(),
                    accountPlan: user.accountPlan,
                    accountPlanName: user.accountPlanName,
                    springEmail: user.email,
                    isBlocked: user.isBlocked
                }
            },
            { new: true, upsert: true }
        );

        if (!portalUser.selectedTradingAccountId) {
            portalUser.selectedTradingAccountId = account._id.toString();
            await portalUser.save();
        }

        return portalUser;
    });
}

export async function userLogin(req, res) {
    try {
        const { email, id, password } = req.body;

        if ((!email && !id) || !password) {
            return res.status(400).json({
                message: "Email/account ID and password are required."
            });
        }

        const normalizedLogin = normalizeEmail(email || id);
        let accountLogin = null;

        if (/^\d+$/.test(String(id || "").trim())) {
            accountLogin = await PortalTradingAccount.findOne({ accountNumber: Number(id) });
        }

        const portalUser = accountLogin
            ? await PortalUser.findById(accountLogin.portalUserId)
            : await PortalUser.findOne({
            $or: [
                { email: normalizedLogin },
                ...(String(id || "").trim() ? [{ accountNumber: Number(id) || -1 }] : [])
            ]
        });

        if (portalUser && verifyPassword(password, portalUser.passwordHash)) {
            let traderToken = null;
            const accounts = await getPortalAccounts(portalUser._id.toString());
            const selectedAccount = accountLogin || await getSelectedAccount(portalUser, accounts);

            if (selectedAccount?.accountNumber) {
                try {
                    const springLogin = await login({ id: selectedAccount.accountNumber, password });
                    traderToken = springLogin.token;
                } catch {
                    traderToken = null;
                }
            }

            return res.json({
                token: signPortalToken({ portalUser, selectedAccount, traderToken }),
                user: getUser(portalUser, selectedAccount, accounts)
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

        const syncedPortalUser = await syncPortalUserFromSpring(user, hashPassword(password));
        const accounts = await getPortalAccounts(syncedPortalUser._id.toString());
        const selectedAccount = await getSelectedAccount(syncedPortalUser, accounts);
        const portalToken = signPortalToken({ portalUser: syncedPortalUser, selectedAccount, traderToken });

        return res.json({
            token: portalToken,
            user: getUser(syncedPortalUser, selectedAccount, accounts)
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
        const existing = await PortalUser.findOne({ email });

        if (existing) {
            pendingRegistrations.delete(email);
            return res.status(409).json({
                message: "This email is already registered. Please login."
            });
        }

        await PortalUser.create({
            name: pending.payload.name,
            email: pending.payload.email,
            passwordHash: hashPassword(pending.payload.password),
            role: "USER",
            swapValue: pending.payload.swap
        });
        pendingRegistrations.delete(email);

        sendAccountCreatedEmail({
            to: pending.payload.email,
            name: pending.payload.name,
            portalUrl: "https://nexfordmarket.com/login.html"
        }).catch((error) => {
            console.warn("Could not send account-created email:", error.message);
        });

        return res.json({
            message: "Registration complete. Please login and create your Demo or Live trading account from the portal."
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

export async function requestPasswordResetOtp(req, res) {
    const email = normalizeEmail(req.body.email);

    if (!email) {
        return res.status(400).json({ message: "Email is required." });
    }

    try {
        const portalUser = await PortalUser.findOne({ email });

        if (!portalUser) {
            return res.status(404).json({ message: "No portal account found for this email." });
        }

        const otp = generateOtp();
        pendingPasswordResets.set(email, {
            otpHash: hashOtp(otp),
            expiresAt: Date.now() + env.otpExpiresInMinutes * 60 * 1000,
            attempts: 0
        });

        await sendWelcomeOtpEmail({
            to: email,
            name: portalUser.name,
            otp
        });

        return res.json({
            message: "Password reset OTP sent to your email.",
            expiresInMinutes: env.otpExpiresInMinutes
        });
    } catch (error) {
        pendingPasswordResets.delete(email);
        return res.status(500).json({
            message: error.message || "Could not send password reset OTP."
        });
    }
}

export async function resetPassword(req, res) {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: "Email, OTP and new password are required." });
    }

    if (newPassword.length < 12) {
        return res.status(400).json({ message: "Password must be at least 12 characters." });
    }

    const pending = pendingPasswordResets.get(email);

    if (!pending) {
        return res.status(400).json({ message: "OTP expired or not requested. Please request a new OTP." });
    }

    if (Date.now() > pending.expiresAt) {
        pendingPasswordResets.delete(email);
        return res.status(400).json({ message: "OTP expired. Please request a new OTP." });
    }

    if (pending.otpHash !== hashOtp(otp)) {
        pending.attempts += 1;

        if (pending.attempts >= MAX_OTP_ATTEMPTS) {
            pendingPasswordResets.delete(email);
            return res.status(429).json({
                message: "Too many incorrect OTP attempts. Please request a new OTP."
            });
        }

        return res.status(400).json({ message: "Incorrect OTP. Please try again." });
    }

    try {
        const portalUser = await PortalUser.findOne({ email });

        if (!portalUser) {
            pendingPasswordResets.delete(email);
            return res.status(404).json({ message: "No portal account found for this email." });
        }

        portalUser.passwordHash = hashPassword(newPassword);
        await portalUser.save();
        pendingPasswordResets.delete(email);

        return res.json({
            message: "Password reset successful. Please login with your new password."
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Could not reset password."
        });
    }
}

export async function createTradingAccount(req, res) {
    try {
        const accountType = String(req.body.accountType || "").trim().toUpperCase();
        const password = String(req.body.password || "");

        if (!["DEMO", "LIVE"].includes(accountType)) {
            return res.status(400).json({ message: "Choose DEMO or LIVE account." });
        }

        if (!password) {
            return res.status(400).json({ message: "Password is required to create trading account." });
        }

        const portalUser = await PortalUser.findById(req.portalUser.portalUserId);

        if (!portalUser) {
            return res.status(404).json({ message: "Portal user not found." });
        }

        if (!verifyPassword(password, portalUser.passwordHash)) {
            return res.status(401).json({ message: "Invalid password." });
        }

        const existingAccount = await PortalTradingAccount.findOne({
            portalUserId: portalUser._id.toString(),
            accountType
        });

        if (existingAccount) {
            return res.status(409).json({ message: `${accountType} account already exists.` });
        }

        const springEmail = springEmailForAccount(portalUser.email, accountType);
        const registeredUser = await registerUser({
            name: portalUser.name,
            email: springEmail,
            password,
            role: "USER",
            accountType,
            accountPlan: "STANDARD_STP",
            swap: portalUser.swapValue
        });

        const user = registeredUser?.user || registeredUser || {};
        const createdAccount = await PortalTradingAccount.create({
            portalUserId: portalUser._id.toString(),
            tradingUserId: user.id,
            accountNumber: user.accountNumber,
            accountType,
            accountPlan: user.accountPlan,
            accountPlanName: user.accountPlanName,
            springEmail,
            isBlocked: user.isBlocked
        });

        const updatedPortalUser = await PortalUser.findByIdAndUpdate(
            portalUser._id,
            {
                $set: {
                    selectedTradingAccountId: createdAccount._id.toString(),
                    tradingUserId: user.id,
                    accountNumber: user.accountNumber,
                    accountType: user.accountType,
                    accountPlan: user.accountPlan,
                    accountPlanName: user.accountPlanName,
                    swapValue: user.swapValue,
                    isBlocked: user.isBlocked
                }
            },
            { new: true }
        );

        if (accountType === "DEMO" && user.id) {
            const collection = mongoose.connection.collection("user_balances");
            const filters = [{ _id: user.id }, { userId: user.id }];
            if (mongoose.Types.ObjectId.isValid(user.id)) {
                filters.push({ _id: new mongoose.Types.ObjectId(user.id) });
            }
            await collection.updateOne(
                { $or: filters },
                { $set: { balance: 5000, credit: 0, userId: user.id } },
                { upsert: true }
            );
        }

        const springLogin = await login({ id: user.accountNumber, password });
        const accounts = await getPortalAccounts(updatedPortalUser._id.toString());

        return res.status(201).json({
            message: accountType === "DEMO"
                ? "Demo trading account created with $5,000 balance."
                : "Live trading account created with $0 balance.",
            token: signPortalToken({ portalUser: updatedPortalUser, selectedAccount: createdAccount, traderToken: springLogin.token }),
            user: getUser(updatedPortalUser, createdAccount, accounts)
        });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || error.response?.data || "Could not create trading account."
        });
    }
}

export async function listTradingAccounts(req, res) {
    try {
        const portalUser = await PortalUser.findById(req.portalUser.portalUserId);

        if (!portalUser) {
            return res.status(404).json({ message: "Portal user not found." });
        }

        const accounts = await getPortalAccounts(portalUser._id.toString());
        const selectedAccount = await getSelectedAccount(portalUser, accounts);

        return res.json({
            accounts: accounts.map(accountDto),
            selectedTradingAccountId: selectedAccount?._id?.toString?.() || null
        });
    } catch {
        return res.status(500).json({ message: "Could not load trading accounts." });
    }
}

export async function selectTradingAccount(req, res) {
    try {
        const accountId = String(req.body.accountId || req.params.accountId || "").trim();
        const password = String(req.body.password || "");

        if (!accountId) {
            return res.status(400).json({ message: "accountId is required." });
        }

        const portalUser = await PortalUser.findById(req.portalUser.portalUserId);

        if (!portalUser) {
            return res.status(404).json({ message: "Portal user not found." });
        }

        if (!verifyPassword(password, portalUser.passwordHash)) {
            return res.status(401).json({ message: "Invalid password." });
        }

        const selectedAccount = await PortalTradingAccount.findOne({
            _id: accountId,
            portalUserId: portalUser._id.toString()
        });

        if (!selectedAccount) {
            return res.status(404).json({ message: "Trading account not found." });
        }

        portalUser.selectedTradingAccountId = selectedAccount._id.toString();
        portalUser.tradingUserId = selectedAccount.tradingUserId;
        portalUser.accountNumber = selectedAccount.accountNumber;
        portalUser.accountType = selectedAccount.accountType;
        portalUser.accountPlan = selectedAccount.accountPlan;
        portalUser.accountPlanName = selectedAccount.accountPlanName;
        portalUser.isBlocked = selectedAccount.isBlocked;
        await portalUser.save();

        const springLogin = await login({ id: selectedAccount.accountNumber, password });
        const accounts = await getPortalAccounts(portalUser._id.toString());

        return res.json({
            message: `${selectedAccount.accountType} account selected.`,
            token: signPortalToken({ portalUser, selectedAccount, traderToken: springLogin.token }),
            user: getUser(portalUser, selectedAccount, accounts)
        });
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || error.response?.data || "Could not select trading account."
        });
    }
}

export function userLogout(req, res) {
    return res.json({
        ok: true,
        message: "Logged out."
    });
}

