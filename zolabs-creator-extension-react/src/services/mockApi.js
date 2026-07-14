const calls = new Map();

const demoResult = {
  status: "completed",
  transcript:
    "Agent: Hello, I am calling to collect the requested details. Respondent: My name is Ravi Kumar and I am continuing my second year of B.Com.",
  summary: "Respondent is continuing the second year of B.Com and requires laptop support.",
  parsedAnswers: {
    Student_Name: { first_name: "Ravi", last_name: "Kumar" },
    Current_Course: "B.Com",
    Current_Year: "Second Year",
    Continuation_Status: "Continuing",
    Support_Required: "Laptop assistance"
  },
  unresolvedFields: []
};

export async function mockApi(path, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 450));

  if (path === "/api/auth/session") {
    return {
      authenticated: true,
      organisation: {
        id: "org-demo",
        name: "Demo Foundation"
      },
      user: {
        id: "user-demo",
        email: "demo@example.org"
      }
    };
  }

  if (path === "/api/forms/sync") {
    const payload = JSON.parse(options.body || "{}");
    return {
      mappingId: "map-demo-001",
      action: "created",
      creatorForm: payload.creatorForm,
      zolabsForm: {
        id: 328,
        name: payload.creatorForm?.displayName || "Demo ZoLabs Form",
        status: "active"
      },
      supportedFields: payload.fields || [],
      unsupportedFields: []
    };
  }

  if (path === "/api/calls" && options.method === "POST") {
    const id = `call-${Date.now()}`;
    calls.set(id, {
      startedAt: Date.now(),
      status: "queued"
    });

    return {
      callLogId: id,
      zolabsCallId: `ZL-${Date.now()}`,
      status: "queued"
    };
  }

  const statusMatch = path.match(/^\/api\/calls\/([^/]+)\/status$/);
  if (statusMatch) {
    const id = decodeURIComponent(statusMatch[1]);
    const call = calls.get(id) || { startedAt: Date.now() };
    const elapsed = Date.now() - call.startedAt;

    let status = "queued";
    if (elapsed > 2500) status = "calling";
    if (elapsed > 5500) status = "connected";
    if (elapsed > 9500) status = "processing";
    if (elapsed > 13000) status = "completed";

    return {
      callLogId: id,
      status,
      durationSeconds: Math.max(0, Math.floor(elapsed / 1000)),
      language: "Auto"
    };
  }

  const resultMatch = path.match(/^\/api\/calls\/([^/]+)\/result$/);
  if (resultMatch) {
    return demoResult;
  }

  const recordMatch = path.match(/^\/api\/calls\/([^/]+)\/create-record$/);
  if (recordMatch) {
    return {
      success: true,
      creatorRecordId: "DEMO-RECORD-001"
    };
  }

  throw new Error(`Mock route not implemented: ${path}`);
}
