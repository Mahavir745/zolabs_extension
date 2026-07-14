import { config } from "../config";
import { mockApi } from "./mockApi";

function cleanErrorMessage(message, status) {
  const text = String(message || "");

  // If a server ever returns a raw HTML error page, never render it.
  if (/<\/?(!doctype|html|head|body|h1|p|title)\b/i.test(text)) {
    return `Request failed (${status}). The server returned an unexpected error page.`;
  }

  return text || `Request failed: ${status}`;
}

async function request(path, options = {}) {
  if (config.enableMock || !config.apiBaseUrl) {
    return mockApi(path, options);
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      cleanErrorMessage(body?.message || body?.error, response.status)
    );
  }

  return body;
}

export const api = {
  session: () => request("/api/auth/session"),

  connectZohoUrl: () =>
    `${config.apiBaseUrl}/api/auth/zoho/start?return_to=${encodeURIComponent(window.location.href)}`,

  syncForm: (payload) =>
    request("/api/forms/sync", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  createCall: (payload) =>
    request("/api/calls", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  getCallStatus: (callLogId) =>
    request(`/api/calls/${encodeURIComponent(callLogId)}/status`),

  getCallResult: (callLogId) =>
    request(`/api/calls/${encodeURIComponent(callLogId)}/result`),

  createRecord: (callLogId) =>
    request(`/api/calls/${encodeURIComponent(callLogId)}/create-record`, {
      method: "POST"
    }),

  zolabsHealth: () => request("/api/forms/zolabs-health"),

  zolabsStatus: () => request("/api/auth/zolabs/status"),

  zolabsSignup: (payload) =>
    request("/api/auth/zolabs/signup", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  zolabsLogin: (payload) =>
    request("/api/auth/zolabs/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  zolabsDisconnect: () =>
    request("/api/auth/zolabs/disconnect", { method: "POST" })
};
