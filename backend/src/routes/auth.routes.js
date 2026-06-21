import { Router } from "express";
import { userLogin, userLogout } from "../controllers/auth.controller.js";


const router = Router();

router.post("/userLogin", userLogin);
router.post("/userLogout", userLogout);

export default router;
