import axios from "axios";
import { env } from "../config/env.js";


export const api = axios.create({
    baseURL: env.springApiBaseUrl,
    timeout: 15000,
    headers: {
        "Content-Type": "application/json"
    }
});

function tenantHeaders(tenantId) {
    const host = [...env.tenantDomains.entries()].find(([, id]) => id === tenantId)?.[0];
    if (!host) throw new Error("No Spring host configured for tenant.");
    return { Host: host };
}

function serverNameForTenant(tenantId) {
    const normalizedTenantId = String(tenantId || "").trim().toLowerCase();
    const serverName = env.springTenantServerNames.get(normalizedTenantId);
    if (!serverName) throw new Error("No Spring server name configured for tenant.");
    return serverName;
}

export async function login({ email, id, password }, tenantId) {
    const response = await api.post("/auth/login", {
        email,
        id,
        password,
        serverName: serverNameForTenant(tenantId)
    }, { headers: tenantHeaders(tenantId) });

    return response.data;
}

export async function registerUser(payload, tenantId) {
    const response = await api.post("/auth/register", {
        ...payload,
        serverName: serverNameForTenant(tenantId)
    }, { headers: tenantHeaders(tenantId) });

    return response.data;
}

export async function springGet(path, traderToken, tenantId, params = {}) {
    const response = await api.get(path, {
        params,
        headers: {
            Authorization: `Bearer ${traderToken}`,
            ...tenantHeaders(tenantId)
        }
    });

    return response.data;
}

export async function springRequest(path, traderToken, tenantId, options = {}) {
    const response = await api.request({
        url: path,
        method: options.method || "GET",
        data: options.data,
        params: options.params,
        headers: {
            Authorization: `Bearer ${traderToken}`,
            ...tenantHeaders(tenantId)
        }
    });

    return response.data;
}
