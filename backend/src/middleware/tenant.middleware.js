import { env } from "../config/env.js";

function requestHost(req) {
    return String(req.headers.host || "").split(":")[0].trim().toLowerCase();
}

export function resolveTenant(req, res, next) {
    const host = requestHost(req);
    let tenantId = env.tenantDomains.get(host);

    // A local development request has no public host. Production must use a mapped domain.
    if (!tenantId && ["localhost", "127.0.0.1"].includes(host)) {
        tenantId = env.defaultTenantId;
    }

    if (!tenantId) {
        return res.status(421).json({ message: "Unknown portal domain." });
    }

    req.tenant = { id: tenantId, host };
    return next();
}

export function tenantFilter(req) {
    return { tenantId: req.tenant.id };
}
