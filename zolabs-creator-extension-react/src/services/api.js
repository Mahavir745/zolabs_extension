import { config } from "../config";
import { mockApi } from "./mockApi";

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
    throw new Error(body?.message || body?.error || `Request failed: ${response.status}`);
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

  createRecord: (callLogId, payload) =>
    request(`/api/calls/${encodeURIComponent(callLogId)}/create-record`, {
      method: "POST",
      body: JSON.stringify(payload)
    })
};
