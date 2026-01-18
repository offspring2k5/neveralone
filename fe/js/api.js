/**
 * fe/api.js
 * Central HTTP wrapper for JSON requests.
 * - Unified error handling (incl. HTTP status codes)
 * - No authentication logic (tokens, etc.) -> belongs in auth.js
 */

function makeHttpError(res, data) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    return err;
}

async function requestJson(method, url, body, headers = {}) {
    const opts = {
        method,
        headers: { ...headers },
    };

    if (body !== undefined) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw makeHttpError(res, data);
    return data;
}

export function getJson(url, headers = {}) {
    return requestJson("GET", url, undefined, headers);
}

export function postJson(url, body, headers = {}) {
    return requestJson("POST", url, body, headers);
}

export function patchJson(url, body, headers = {}) {
    return requestJson("PATCH", url, body, headers);
}
