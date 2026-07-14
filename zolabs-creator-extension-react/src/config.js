export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "",
  enableMock: String(import.meta.env.VITE_ENABLE_MOCK || "true") === "true",
  statusPollMs: 4000,
  supportedFields: [
    "text",
    "textarea",
    "email",
    "phone",
    "number",
    "decimal",
    "currency",
    "date",
    "datetime",
    "picklist",
    "radio",
    "multiselect",
    "boolean",
    "name",
    "address",
    "url"
  ]
};
