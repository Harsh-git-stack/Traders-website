import mongoose from "mongoose";
import { Transfer } from "../models/transfer.model.js";
import { WalletBalance } from "../models/wallet-balance.model.js";

function userBalanceCollection() {
    return mongoose.connection.collection("user_balances");
}

function userBalanceFilter(userId) {
    const filters = [
        { _id: userId },
        { userId }
    ];

    if (mongoose.Types.ObjectId.isValid(userId)) {
        filters.push({ _id: new mongoose.Types.ObjectId(userId) });
    }

    return { $or: filters };
}

function normalizeTradingBalance(doc) {
    return {
        balance: Number(doc?.balance || 0),
        credit: Number(doc?.credit || 0)
    };
}

async function getOrCreateWallet(user) {
    const existing = await WalletBalance.findOne({ userId: user.id });
    if (existing) return existing;

    return WalletBalance.create({
        userId: user.id,
        accountNumber: user.accountNumber,
        email: user.email,
        balance: 0,
        currency: "USD"
    });
}

async function getOrCreateTradingBalance(user) {
    const collection = userBalanceCollection();
    const existing = await collection.findOne(userBalanceFilter(user.id));
    if (existing) return normalizeTradingBalance(existing);

    const inserted = {
        _id: user.id,
        userId: user.id,
        balance: 0,
        credit: 0
    };
    await collection.insertOne(inserted);
    return normalizeTradingBalance(inserted);
}

function parseAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
}

export async function getWalletSummary(req, res) {
    try {
        const [wallet, trading] = await Promise.all([
            getOrCreateWallet(req.portalUser),
            getOrCreateTradingBalance(req.portalUser)
        ]);

        return res.json({
            wallet: {
                balance: wallet.balance,
                currency: wallet.currency
            },
            trading: {
                balance: trading.balance,
                credit: trading.credit
            }
        });
    } catch {
        return res.status(500).json({
            message: "Could not load wallet summary."
        });
    }
}

export async function listTransfers(req, res) {
    try {
        const transfers = await Transfer.find({ userId: req.portalUser.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return res.json({ transfers });
    } catch {
        return res.status(500).json({
            message: "Could not load transfers."
        });
    }
}

export async function createTransfer(req, res) {
    const { type } = req.body;
    const amount = parseAmount(req.body.amount);

    if (!["WALLET_TO_TRADING", "TRADING_TO_WALLET"].includes(type)) {
        return res.status(400).json({
            message: "Invalid transfer type."
        });
    }

    if (!amount || amount <= 0) {
        return res.status(400).json({
            message: "Amount must be a positive number."
        });
    }

    try {
        await getOrCreateWallet(req.portalUser);
        await getOrCreateTradingBalance(req.portalUser);

        const collection = userBalanceCollection();
        let wallet;
        let trading;

        if (type === "WALLET_TO_TRADING") {
            wallet = await WalletBalance.findOneAndUpdate(
                { userId: req.portalUser.id, balance: { $gte: amount } },
                { $inc: { balance: -amount } },
                { new: true }
            );

            if (!wallet) {
                return res.status(409).json({ message: "Insufficient wallet balance." });
            }

            try {
                trading = await collection.findOneAndUpdate(
                    userBalanceFilter(req.portalUser.id),
                    {
                        $inc: { balance: amount },
                        $setOnInsert: { userId: req.portalUser.id, credit: 0 }
                    },
                    { upsert: true, returnDocument: "after" }
                );
            } catch (error) {
                await WalletBalance.updateOne({ userId: req.portalUser.id }, { $inc: { balance: amount } });
                throw error;
            }
        } else {
            trading = await collection.findOneAndUpdate(
                {
                    $and: [
                        userBalanceFilter(req.portalUser.id),
                        { balance: { $gte: amount } }
                    ]
                },
                { $inc: { balance: -amount } },
                { returnDocument: "after" }
            );

            if (!trading) {
                return res.status(409).json({ message: "Insufficient trading balance." });
            }

            try {
                wallet = await WalletBalance.findOneAndUpdate(
                    { userId: req.portalUser.id },
                    {
                        $inc: { balance: amount },
                        $setOnInsert: {
                            accountNumber: req.portalUser.accountNumber,
                            email: req.portalUser.email,
                            currency: "USD"
                        }
                    },
                    { new: true, upsert: true }
                );
            } catch (error) {
                await collection.updateOne(userBalanceFilter(req.portalUser.id), { $inc: { balance: amount } });
                throw error;
            }
        }

        const tradingBalance = normalizeTradingBalance(trading);
        const transfer = await Transfer.create({
            userId: req.portalUser.id,
            accountNumber: req.portalUser.accountNumber,
            email: req.portalUser.email,
            type,
            amount,
            from: type === "WALLET_TO_TRADING" ? "WALLET" : "TRADING",
            to: type === "WALLET_TO_TRADING" ? "TRADING" : "WALLET",
            status: "COMPLETED",
            walletBalanceAfter: wallet.balance,
            tradingBalanceAfter: tradingBalance.balance
        });

        return res.status(201).json({
            message: "Transfer completed.",
            transfer,
            wallet: {
                balance: wallet.balance,
                currency: wallet.currency
            },
            trading: tradingBalance
        });
    } catch (error) {
        return res.status(500).json({
            message: "Transfer failed."
        });
    }
}
