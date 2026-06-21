import { Router } from "express";
import { requirePortalAuth } from "../middleware/auth.middleware.js";
import {
    createTransfer,
    getWalletSummary,
    listTransfers
} from "../controllers/transfers.controller.js";

const router = Router();

router.get("/wallet", requirePortalAuth, getWalletSummary);
router.get("/", requirePortalAuth, listTransfers);
router.post("/", requirePortalAuth, createTransfer);

export default router;
