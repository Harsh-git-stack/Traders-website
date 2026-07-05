import { Router } from "express";
import {
    requestRegistrationOtp,
    userLogin,
    userLogout,
    verifyRegistrationOtp
} from "../controllers/auth.controller.js";


const router = Router();

router.post("/register", requestRegistrationOtp);
router.post("/verify-registration", verifyRegistrationOtp);
router.post("/userLogin", userLogin);
router.post("/userLogout", userLogout);

export default router;
