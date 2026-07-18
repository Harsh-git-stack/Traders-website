import { Router } from "express";
import { requirePortalAuth, requireTradingAccount } from "../middleware/auth.middleware.js";
import { getAccount, getTrades } from "../controllers/trades.controller.js";

const router = Router();

router.get("/", requirePortalAuth, requireTradingAccount, getTrades);
router.get("/account", requirePortalAuth, requireTradingAccount, getAccount);

export default router;
