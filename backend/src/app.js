import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import { requirePortalAuth } from "./middleware/auth.middleware.js";
import { resolveTenant } from "./middleware/tenant.middleware.js";
import tradesRoutes from "./routes/trades.routes.js";
import clientRequestRoutes from "./routes/client-requests.routes.js";
import transferRoutes from "./routes/transfers.routes.js";



export const app = express();

app.use(helmet());

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        try {
            const host = new URL(origin).hostname.toLowerCase();
            return callback(null, env.tenantDomains.has(host) || origin === env.frontendOrigin);
        } catch { return callback(null, false); }
    },
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "trading-portal-backend"
    });
});

app.use(resolveTenant);

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        service: "trading-portal-backend"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/trades", tradesRoutes);
app.use("/api/client-requests", clientRequestRoutes);
app.use("/api/transfers", transferRoutes);


app.get("/api/test/me", requirePortalAuth, (req, res) => {
    res.json({
        ok: true,
        user: {
            id: req.portalUser.id,
            role: req.portalUser.role
        }
    });
});
