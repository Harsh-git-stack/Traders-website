import { springGet } from "../services/spring.service.js";

export async function getAccount(req, res) {
    try {
        const account = await springGet("/trades/account", req.portalUser.traderToken);
        return res.json(account);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || error.response?.data || "Account unavailable."
        });
    }
}

export async function getTrades(req, res) {
    try {
        const trades = await springGet("/trades", req.portalUser.traderToken);
        return res.json(trades);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || error.response?.data || "Trades unavailable."
        });
    }
}