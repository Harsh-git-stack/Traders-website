import { Router } from "express";
import {
    createTradingAccount,
    listTradingAccounts,
    requestPasswordResetOtp,
    requestRegistrationOtp,
    resetPassword,
    selectTradingAccount,
    userLogin,
    userLogout,
    verifyRegistrationOtp
} from "../controllers/auth.controller.js";
import { requirePortalAuth } from "../middleware/auth.middleware.js";


const router = Router();

router.post("/register", requestRegistrationOtp);
router.post("/verify-registration", verifyRegistrationOtp);
router.post("/forgot-password", requestPasswordResetOtp);
router.post("/reset-password", resetPassword);
router.post("/userLogin", userLogin);
router.post("/userLogout", userLogout);
router.get("/trading-accounts", requirePortalAuth, listTradingAccounts);
router.post("/trading-account", requirePortalAuth, createTradingAccount);
router.post("/trading-accounts/:accountId/select", requirePortalAuth, selectTradingAccount);

export default router;
