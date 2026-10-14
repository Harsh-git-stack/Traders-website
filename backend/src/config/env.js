import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDir, "../../.env") });

const otpExpiresInMinutes = Number(process.env.OTP_EXPIRES_IN_MINUTES || 5);
const skipMongo = process.env.SKIP_MONGO === "true";

function parseTenantDomains(value) {
    const entries = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
    return new Map(entries.map((entry) => {
        const [host, tenantId] = entry.split("=").map((part) => part.trim().toLowerCase());
        return [host, tenantId];
    }).filter(([host, tenantId]) => host && tenantId));
}

function parseTenantServerNames(value) {
    const entries = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
    return new Map(entries.map((entry) => {
        const separator = entry.indexOf("=");
        if (separator < 1) return ["", ""];

        // Tenant IDs are case-insensitive; Spring server names are not.
        const tenantId = entry.slice(0, separator).trim().toLowerCase();
        const serverName = entry.slice(separator + 1).trim();
        return [tenantId, serverName];
    }).filter(([tenantId, serverName]) => tenantId && serverName));
}

export const env = {
    port: process.env.PORT || 4000,
    nodeEnv: process.env.NODE_ENV || "development",
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5500",

    springApiBaseUrl: process.env.SPRING_API_BASE_URL,
    springTenantServerNames: parseTenantServerNames(process.env.SPRING_TENANT_SERVER_NAMES || [
        "nexford=NexfordMarkets-2390",
        "trade4worldfx=Trade4WorldFX-2390"
    ].join(",")),
    tenantDomains: parseTenantDomains(process.env.PORTAL_TENANT_DOMAINS || [
        "app.nexfordmarket.com=nexford",
        "nexfordmarket.com=nexford",
        "trade4worldfx.com=trade4worldfx",
        "www.trade4worldfx.com=trade4worldfx"
    ].join(",")),
    defaultTenantId: String(process.env.PORTAL_DEFAULT_TENANT_ID || "").trim().toLowerCase(),

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

if (env.tenantDomains.size === 0) {
    throw new Error("PORTAL_TENANT_DOMAINS must contain at least one host=tenantId mapping");
}

if (env.springTenantServerNames.size === 0) {
    throw new Error("SPRING_TENANT_SERVER_NAMES must contain at least one tenantId=serverName mapping");
}

if (!env.portalJwtSecret) {
    throw new Error("PORTAL_JWT_SECRET is required");
}

if (!env.skipMongo && !env.mongoUri) {
    throw new Error("MONGO_URI is required");
}
