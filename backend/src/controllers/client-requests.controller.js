import { ClientRequest } from "../models/client-request.model.js";

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

        if (!["DEPOSIT", "WITHDRAWAL"].includes(normalizedType)) {
            return res.status(400).json({
                message: "Only DEPOSIT and WITHDRAWAL requests are supported right now."
            });
        }

        if (normalizedType === "DEPOSIT" && (!utr || !payerName)) {
            return res.status(400).json({
                message: "utr and payerName are required for deposit requests."
            });
        }

        const numericAmount = Number(amount);

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

            if (!Number.isFinite(tradingAccountNumber) || tradingAccountNumber !== req.portalUser.accountNumber) {
                return res.status(400).json({
                    message: "Trading account number does not match your logged-in account."
                });
            }
        }

        const request = await ClientRequest.create({
            userId: req.portalUser.id,
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

        const label = normalizedType === "WITHDRAWAL" ? "Withdrawal" : "Deposit";
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
        const requests = await ClientRequest.find({
            userId: req.portalUser.id
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
