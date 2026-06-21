import { Router } from "express";
import { requirePortalAuth } from "../middleware/auth.middleware.js";
import { getAccount, getTrades } from "../controllers/trades.controller.js";

const router = Router();

router.get("/", requirePortalAuth, getTrades);
router.get("/account", requirePortalAuth, getAccount);

export default router;