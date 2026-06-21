import axios from "axios";
import { env } from "../config/env.js";


export const api = axios.create({
    baseURL: env.springApiBaseUrl,
    timeout: 15000,
    headers: {
        "Content-Type": "application/json"
    }
});

export async function login({ email, id, password }) {
    const response = await api.post("/auth/login", {
        email,
        id,
        password,
        serverName: env.springServerName
    });

    return response.data;
}

export async function springGet(path, traderToken, params = {}) {
    const response = await api.get(path, {
        params,
        headers: {
            Authorization: `Bearer ${traderToken}`
        }
    });

    return response.data;
}

export async function springRequest(path, traderToken, options = {}) {
    const response = await api.request({
        url: path,
        method: options.method || "GET",
        data: options.data,
        params: options.params,
        headers: {
            Authorization: `Bearer ${traderToken}`
        }
    });

    return response.data;
}