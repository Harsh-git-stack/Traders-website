import { Router } from "express";
import { requirePortalAuth } from "../middleware/auth.middleware.js";
import {
    createClientRequest,
    getMyClientRequests
} from "../controllers/client-requests.controller.js";

const router = Router();

router.post("/", requirePortalAuth, createClientRequest);
router.get("/my", requirePortalAuth, getMyClientRequests);

export default router;