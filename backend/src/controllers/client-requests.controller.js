import { ClientRequest } from "../models/client-request.model.js";
import { PortalUser } from "../models/portal-user.model.js";
import { RewardBalance } from "../models/reward-balance.model.js";

export async function createClientRequest(req, res) {
    try {
        const {
            type,
            method,
            amount,
            utr,
            payerName,
            phone,
            email,
            payload = null
        } = req.body;
        const normalizedType = String(type || "").trim().toUpperCase();
        const normalizedMethod = String(method || "").trim().toUpperCase();

        if (!normalizedType || !normalizedMethod || !amount) {
            return res.status(400).json({
                message: "type, method, and amount are required."
            });
        }

        if (!["DEPOSIT", "WITHDRAWAL", "REWARD_REDEMPTION"].includes(normalizedType)) {
            return res.status(400).json({
                message: "Only DEPOSIT, WITHDRAWAL, and REWARD_REDEMPTION requests are supported right now."
            });
        }

        if (normalizedType === "DEPOSIT" && (!utr || !payerName)) {
            return res.status(400).json({
                message: "utr and payerName are required for deposit requests."
            });
        }

        const numericAmount = Number(amount);
        // userId remains the trading-account identity. The Spring manager uses it
        // for referral rewards and account-level checks. portalUserId is the
        // separate portal-wallet identity used when a deposit is approved.
        const requestUserId = req.portalUser.id || req.portalUser.portalUserId;
        const portalUserId = req.portalUser.portalUserId || req.portalUser.id;

        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                message: "Amount must be a positive number."
            });
        }

        if (normalizedType === "WITHDRAWAL") {
            const bankAccountNumber = String(payload?.accountNumber || utr || "").trim();
            const confirmAccountNumber = String(payload?.confirmAccountNumber || "").trim();
            const tradingAccountNumber = Number(payload?.tradingAccountNumber);
            const requiredFields = [
                payload?.accountHolderName,
                payload?.bankName,
                bankAccountNumber,
                confirmAccountNumber,
                payload?.ifscCode,
                payload?.tradingAccountNumber
            ];

            if (requiredFields.some((value) => !String(value || "").trim())) {
                return res.status(400).json({
                    message: "Bank holder name, bank name, account number, IFSC, trading account number, and amount are required for withdrawal requests."
                });
            }

            if (bankAccountNumber !== confirmAccountNumber) {
                return res.status(400).json({
                    message: "Account number and confirm account number do not match."
                });
            }

            if (!req.portalUser.accountNumber) {
                return res.status(409).json({
                    message: "Please create or select a trading account before requesting withdrawal."
                });
            }

            if (!Number.isFinite(tradingAccountNumber) || tradingAccountNumber !== req.portalUser.accountNumber) {
                return res.status(400).json({
                    message: "Trading account number does not match your logged-in account."
                });
            }
        }

        if (normalizedType === "REWARD_REDEMPTION") {
            if (!req.portalUser.hasTradingAccount) {
                return res.status(409).json({
                    message: "Please create or select a trading account before redeeming rewards."
                });
            }

            const reward = await RewardBalance.findOne({ tenantId: req.tenant.id, userId: requestUserId });
            const available = Number(reward?.balance || 0);

            if (available < numericAmount) {
                return res.status(409).json({
                    message: "Insufficient reward balance."
                });
            }
        }

        const request = await ClientRequest.create({
            tenantId: req.tenant.id,
            userId: requestUserId,
            portalUserId,
            accountNumber: req.portalUser.accountNumber,
            email: email || req.portalUser.email,
            type: normalizedType,
            method: normalizedMethod,
            amount: numericAmount,
            utr: String(utr || payload?.accountNumber || "N/A").trim(),
            payerName: String(payerName || payload?.accountHolderName || "N/A").trim(),
            phone,
            payload,
            status: "PENDING"
        });

        const label = normalizedType === "WITHDRAWAL"
            ? "Withdrawal"
            : normalizedType === "REWARD_REDEMPTION"
                ? "Reward redemption"
                : "Deposit";
        return res.status(201).json({
            message: `${label} request submitted. Status: Pending.`,
            request
        });
    } catch (error) {
        return res.status(500).json({
            message: "Could not create request."
        });
    }
}

export async function getMyClientRequests(req, res) {
    try {
        const userIds = Array.from(new Set([
            req.portalUser.id,
            req.portalUser.portalUserId
        ].filter(Boolean)));
        const requests = await ClientRequest.find({
            tenantId: req.tenant.id,
            userId: { $in: userIds }
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return res.json({
            requests
        });
    } catch {
        return res.status(500).json({
            message: "Could not load requests."
        });
    }
}

export async function getRewardSummary(req, res) {
    try {
        const reward = req.portalUser.id
            ? await RewardBalance.findOne({ tenantId: req.tenant.id, userId: req.portalUser.id }).lean()
            : null;

        return res.json({
            rewards: {
                balance: Number(reward?.balance || 0),
                totalEarned: Number(reward?.totalEarned || 0),
                totalRedeemed: Number(reward?.totalRedeemed || 0),
                currency: reward?.currency || "USD"
            }
        });
    } catch {
        return res.status(500).json({
            message: "Could not load rewards."
        });
    }
}

export async function getReferralSummary(req, res) {
    try {
        const portalUserId = req.portalUser.portalUserId;
        const currentUser = portalUserId
            ? await PortalUser.findOne({ _id: portalUserId, tenantId: req.tenant.id }).lean()
            : null;
        const referredUsers = await PortalUser.find({ tenantId: req.tenant.id, referredByUserId: portalUserId })
            .sort({ createdAt: -1 })
            .lean();

        const summaries = await Promise.all(referredUsers.map(async (user) => {
            const userIds = Array.from(new Set([
                user._id?.toString?.(),
                user.portalUserId,
                user.tradingUserId
            ].filter(Boolean)));

            const requests = await ClientRequest.find({
                tenantId: req.tenant.id,
                userId: { $in: userIds },
                type: { $in: ["DEPOSIT", "WITHDRAWAL"] }
            })
                .sort({ createdAt: -1 })
                .lean();

            const approved = requests.filter((request) =>
                String(request.status || "").toUpperCase() === "APPROVED"
            );
            const totalDeposits = approved
                .filter((request) => String(request.type || "").toUpperCase() === "DEPOSIT")
                .reduce((sum, request) => sum + Number(request.amount || 0), 0);
            const totalWithdrawals = approved
                .filter((request) => String(request.type || "").toUpperCase() === "WITHDRAWAL")
                .reduce((sum, request) => sum + Number(request.amount || 0), 0);

            return {
                id: user._id?.toString?.(),
                name: user.name,
                email: user.email,
                accountNumber: user.accountNumber,
                accountType: user.accountType,
                joinedAt: user.createdAt,
                totalDeposits,
                totalWithdrawals,
                transactions: requests.map((request) => ({
                    id: request._id?.toString?.() || request.id,
                    type: request.type,
                    method: request.method,
                    amount: request.amount,
                    status: request.status,
                    reference: request.type === "WITHDRAWAL"
                        ? request.payload?.accountNumber || request.utr
                        : request.utr,
                    createdAt: request.createdAt,
                    reviewedAt: request.reviewedAt,
                    adminNote: request.adminNote
                }))
            };
        }));

        return res.json({
            referredByName: currentUser?.referredByName || req.portalUser.referredByName || null,
            referrals: summaries
        });
    } catch {
        return res.status(500).json({
            message: "Could not load referrals."
        });
    }
}
