import { Router } from "express";
import { requirePortalAuth } from "../middleware/auth.middleware.js";
import {
    createClientRequest,
    getMyClientRequests,
    getReferralSummary,
    getRewardSummary
} from "../controllers/client-requests.controller.js";

const router = Router();

router.post("/", requirePortalAuth, createClientRequest);
router.get("/my", requirePortalAuth, getMyClientRequests);
router.get("/rewards", requirePortalAuth, getRewardSummary);
router.get("/referrals", requirePortalAuth, getReferralSummary);

export default router;
