import dotenv from "dotenv";

dotenv.config();

export const env = {
    port: process.env.PORT || 4000,
    nodeEnv: process.env.NODE_ENV || "development",
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5500",

    springApiBaseUrl: process.env.SPRING_API_BASE_URL,
    springServerName: process.env.SPRING_SERVER_NAME,

    portalJwtSecret: process.env.PORTAL_JWT_SECRET,
    portalJwtExpiresIn: process.env.PORTAL_JWT_EXPIRES_IN || "1d",

    mongoUri: process.env.MONGO_URI
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

if (!env.mongoUri) {
    throw new Error("MONGO_URI is required");
}
