import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import { requirePortalAuth } from "./middleware/auth.middleware.js";
import tradesRoutes from "./routes/trades.routes.js";
import clientRequestRoutes from "./routes/client-requests.routes.js";
import transferRoutes from "./routes/transfers.routes.js";



export const app = express();

app.use(helmet());

app.use(cors({
    origin: env.frontendOrigin,
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "nexford-backend"
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
