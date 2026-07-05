import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDir, "../../.env") });

const otpExpiresInMinutes = Number(process.env.OTP_EXPIRES_IN_MINUTES || 5);
const skipMongo = process.env.SKIP_MONGO === "true";

export const env = {
    port: process.env.PORT || 4000,
    nodeEnv: process.env.NODE_ENV || "development",
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5500",

    springApiBaseUrl: process.env.SPRING_API_BASE_URL,
    springServerName: process.env.SPRING_SERVER_NAME,

    portalJwtSecret: process.env.PORTAL_JWT_SECRET,
    portalJwtExpiresIn: process.env.PORTAL_JWT_EXPIRES_IN || "1d",

    mongoUri: process.env.MONGO_URI,
    skipMongo,

    mailFromName: process.env.MAIL_FROM_NAME || "NexfordMarket",
    smtpHost: process.env.SMTP_HOST || "smtp.titan.email",
    smtpPort: Number(process.env.SMTP_PORT || 465),
    smtpSecure: process.env.SMTP_SECURE !== "false",
    smtpUser: process.env.SMTP_USER || process.env.GMAIL_USER || "support@nexfordmarket.com",
    smtpPass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD,
    otpExpiresInMinutes: Number.isFinite(otpExpiresInMinutes) && otpExpiresInMinutes > 0
        ? otpExpiresInMinutes
        : 5
};

if (!env.springApiBaseUrl) {
    throw new Error("SPRING_API_BASE_URL is required");
}

if (!env.springServerName) {
    throw new Error("SPRING_SERVER_NAME is required");
}

if (!env.portalJwtSecret) {
    throw new Error("PORTAL_JWT_SECRET is required");
}

if (!env.skipMongo && !env.mongoUri) {
    throw new Error("MONGO_URI is required");
}
