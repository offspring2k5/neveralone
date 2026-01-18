/**
 * fe/auth.js
 * Responsible for:
 * - Persisting the token (localStorage)
 * - Authentication calls + /me
 */

import { postJson, getJson } from "./api.js";

const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/* Registration - Expects: email + password + displayName */
export async function register(email, password, displayName) {
    return postJson("/api/auth/register", { email, password, displayName });
}

/* Login - stores the token (if present) in localStorage. */
export async function login(email, password) {
    const data = await postJson("/api/auth/login", { email, password });
    if (data.token) setToken(data.token);
    return data;
}

/* Returns: { ok: true, user: ... } - throws an error with err.status if HTTP status != 2xx */
export async function me() {
    const token = getToken();
    if (!token) {
        const err = new Error("Kein Token");
        err.status = 401;
        throw err;
    }
    return getJson("/api/auth/me", { Authorization: `Bearer ${token}` });
}
