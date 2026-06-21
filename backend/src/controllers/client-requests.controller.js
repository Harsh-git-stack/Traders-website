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

        if (!type || !method || !amount) {
            return res.status(400).json({
                message: "type, method, and amount are required."
            });
        }

        if (!["DEPOSIT", "WITHDRAWAL"].includes(type)) {
            return res.status(400).json({
                message: "Only DEPOSIT and WITHDRAWAL requests are supported right now."
            });
        }

        if (type === "DEPOSIT" && (!utr || !payerName)) {
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

        const request = await ClientRequest.create({
            userId: req.portalUser.id,
            accountNumber: req.portalUser.accountNumber,
            email: email || req.portalUser.email,
            type,
            method,
            amount: numericAmount,
            utr: utr || payload?.accountNumber || "N/A",
            payerName: payerName || payload?.accountHolderName || "N/A",
            phone,
            payload,
            status: "PENDING"
        });

        const label = type === "WITHDRAWAL" ? "Withdrawal" : "Deposit";
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
