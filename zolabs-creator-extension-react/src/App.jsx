import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { api } from "./services/api";
import {
  getCreatorContext,
  getCreatorFields,
  getCreatorForms,
  createCreatorRecord
} from "./services/creator";
import {
  generateCallObjective,
  normaliseCreatorFields
} from "./services/schema";
import { useAuth } from "./contexts/AuthContext";
import { useSpeechInput } from "./hooks/useSpeechInput";
import StepHeader from "./components/StepHeader";
import FormSelector from "./components/FormSelector";
import ConnectZolabs from "./components/ConnectZolabs";

export default function App() {
  const { context, session, setSession, loading, error: authError, refreshSession } = useAuth();
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [mapping, setMapping] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [query, setQuery] = useState("");
  const [step, setStep] = useState("forms");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeSpeechField, setActiveSpeechField] = useState(null);

  // Array of active/past calls
  const [calls, setCalls] = useState([]);
  const callsRef = useRef(calls);

  useEffect(() => {
    callsRef.current = calls;
  }, [calls]);

  const speech = useSpeechInput();

  useEffect(() => {
    if (!speech.isListening) {
      setActiveSpeechField(null);
    }
  }, [speech.isListening]);

  useEffect(() => {
    if (context?.available && !forms.length) {
      getCreatorForms(context.appLinkName).then(creatorForms => {
        setForms(creatorForms || []);
      }).catch(err => {
        setError(err.message);
        setForms([]);
      });
    }
  }, [context, forms.length]);

  // Polling Effect for multiple calls
  useEffect(() => {
    const timer = window.setInterval(async () => {
      const activeCalls = callsRef.current.filter(c =>
        !["failed", "completed_with_record", "record_failed", "no_answer", "busy", "disconnected", "canceled", "completed"].includes(c.internalStatus)
      );

      if (activeCalls.length === 0) return;

      for (const call of activeCalls) {
        try {
          const status = await api.getCallStatus(call.callLogId);

          setCalls(prev => prev.map(c => {
            if (c.callLogId === call.callLogId) {
              return { ...c, status: status.status, durationSeconds: status.durationSeconds };
            }
            return c;
          }));

          if (status.readyForReview && call.internalStatus !== "creating_record") {
            // Immediately kick off record creation
            setCalls(prev => prev.map(c => c.callLogId === call.callLogId ? { ...c, internalStatus: "creating_record" } : c));

            const callResult = await api.getCallResult(call.callLogId);
            await handleCreateRecord(callResult, call);
          } else if (["failed", "busy", "no_answer", "disconnected", "canceled", "completed"].includes(status.status)) {
            setCalls(prev => prev.map(c => c.callLogId === call.callLogId ? { ...c, internalStatus: status.status } : c));
          }
        } catch (pollError) {
          console.error("Poll error for call", call.callLogId, pollError);
        }
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

  async function handleCreateRecord(result, callData) {
    try {
      const mappedAnswers = {};
      for (const [key, value] of Object.entries(result.parsedAnswers || {})) {
        if (key.toLowerCase().replace(/[^a-z0-9]/g, "") === "zolabscallsummary") continue;
        if (!value || value === "<N/A>" || value === "Not captured") continue;

        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
        const field = callData.fields.find(f =>
          f.linkName.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedKey ||
          (f.label && f.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedKey)
        );

        let mappedValue = value;
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [yyyy, mm, dd] = value.split("-");
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const monthStr = months[parseInt(mm, 10) - 1];
          mappedValue = `${dd}-${monthStr}-${yyyy}`;
        }

        if (field) {
          mappedAnswers[field.linkName] = mappedValue;
        } else {
          mappedAnswers[key] = mappedValue;
        }
      }

      const creatorRecordResponse = await createCreatorRecord(
        context.appLinkName,
        callData.formLinkName,
        mappedAnswers
      );

      const id =
        creatorRecordResponse?.result?.[0]?.data?.ID ||
        creatorRecordResponse?.result?.[0]?.data?.id ||
        creatorRecordResponse?.data?.ID ||
        creatorRecordResponse?.data?.id ||
        creatorRecordResponse?.data?.[0]?.ID ||
        creatorRecordResponse?.data?.[0]?.id ||
        null;

      if (!id) {
        throw new Error("Failed to get a recognisable record ID from Creator.");
      }

      await api.recordCreated(callData.callLogId, { creatorRecordId: String(id) });

      setCalls(prev => prev.map(c =>
        c.callLogId === callData.callLogId
          ? { ...c, internalStatus: "completed_with_record", recordId: String(id), summary: result.summary }
          : c
      ));
    } catch (recordError) {
      setCalls(prev => prev.map(c =>
        c.callLogId === callData.callLogId
          ? { ...c, internalStatus: "record_failed", error: recordError.message }
          : c
      ));
    }
  }

  const supportedFieldCount = useMemo(
    () => fields.filter((field) => field.type).length - 1, // Subtract the injected summary field
    [fields]
  );

  async function selectForm(form) {
    setBusy(true);
    setError("");
    setSelectedForm(form);

    try {
      let rawFields = [];
      if (context?.available) {
        rawFields = await getCreatorFields(
          context.appLinkName,
          form.link_name
        );
      }

      const normalisedFields = normaliseCreatorFields(rawFields);

      // Inject Summary Field to force ZoLabs to output a call summary in parsedAnswers
      normalisedFields.push({
        linkName: "zolabs_call_summary",
        label: "Call Summary",
        type: "long_text",
        required: false,
        description: "A detailed summary of the entire conversation."
      });

      setFields(normalisedFields);

      const syncResponse = await api.syncForm({
        organisationId: session?.organisation?.id,
        accountOwnerName: context?.accountOwnerName || "",
        creatorEnvironment: context?.creatorEnvironment || "production",
        creatorApp: {
          linkName: context?.appLinkName,
          displayName: context?.appDisplayName
        },
        creatorForm: {
          linkName: form.link_name,
          displayName: form.display_name
        },
        fields: normalisedFields
      });

      setMapping(syncResponse);
      setQuery(
        generateCallObjective(
          form.display_name || form.link_name,
          normalisedFields
        )
      );
      setStep("prepare");
    } catch (selectError) {
      setError(selectError.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleVoice(fieldId, setter, currentValue) {
    if (speech.isListening && activeSpeechField === fieldId) {
      speech.stop();
      setActiveSpeechField(null);
    } else {
      setActiveSpeechField(fieldId);
      speech.start((newTranscript) => {
        setter(currentValue ? currentValue.trim() + " " + newTranscript : newTranscript);
      });
    }
  }

  async function startCall() {
    setError("");

    if (!/^\+?[1-9]\d{7,14}$/.test(phoneNumber.replace(/\s/g, ""))) {
      setError(
        "Enter a valid phone number — a 10-digit Indian mobile number is fine, " +
        "or use full E.164 format with country code for other countries (e.g. +14155551234)."
      );
      return;
    }

    setBusy(true);

    try {
      const response = await api.createCall({
        organisationId: session?.organisation?.id,
        creator: {
          appLinkName: context?.appLinkName,
          formLinkName: selectedForm?.link_name,
          formDisplayName: selectedForm?.display_name
        },
        mappingId: mapping?.mappingId,
        zolabsFormId: mapping?.zolabsForm?.id,
        phoneNumber: phoneNumber.replace(/\s/g, ""),
        query,
        fields
      });

      setCalls(prev => [{
        callLogId: response.callLogId,
        phoneNumber: phoneNumber.replace(/\s/g, ""),
        formDisplayName: selectedForm.display_name,
        formLinkName: selectedForm.link_name,
        status: response.status,
        internalStatus: "polling", // polling, creating_record, completed_with_record, record_failed, failed, busy, no_answer
        durationSeconds: 0,
        fields: fields
      }, ...prev]);

      reset();
    } catch (callError) {
      setError(callError.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSelectedForm(null);
    setFields([]);
    setMapping(null);
    setPhoneNumber("");
    setQuery("");
    setError("");
    setStep("forms");
  }

  if ((!session?.authenticated || !session?.zolabs?.connected) && !loading) {
    return <ConnectZolabs onConnected={refreshSession} />;
  }

  function getStatusLabel(call) {
    if (call.internalStatus === "creating_record") return "Creating record...";
    if (call.internalStatus === "completed_with_record") return "Record Created";
    if (call.internalStatus === "record_failed") return "Record Failed";
    if (call.status === "completed") return "Processing transcript...";
    return call.status ? call.status.charAt(0).toUpperCase() + call.status.slice(1) : "Connecting...";
  }

  return (
    <main className="app-shell dashboard-app">
      <nav className="topbar">
        <div className="brand">
          <div className="brand-mark">Z</div>
          <div>
            <strong>ZoLabs for Zoho Creator</strong>
            <span>{session?.user?.display_name || session?.user?.email || "Loading user…"}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {step !== "forms" ? (
            <button type="button" className="text-button" onClick={reset}>
              Change Form
            </button>
          ) : null}

          <button
            type="button"
            className="text-button"
            style={{ color: '#ff6b6b' }}
            onClick={async () => {
              try {
                await api.zolabsDisconnect();
              } catch (e) {
                console.error("Logout failed:", e);
              } finally {
                refreshSession();
                setSession({ authenticated: false });
              }
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      {authError ? (
        <div className="error-banner">
          <span style={{ flexGrow: 1 }}>{authError}</span>
        </div>
      ) : null}

      {error ? (
        <div className="error-banner">
          <span style={{ flexGrow: 1 }}>{error}</span>
          <button className="close-btn" onClick={() => setError("")}>&times;</button>
        </div>
      ) : null}

      {speech.error ? (
        <div className="error-banner">
          <span style={{ flexGrow: 1 }}>{speech.error}</span>
          <button className="close-btn" onClick={speech.clearError}>&times;</button>
        </div>
      ) : null}

      <div className="dashboard-layout">
        {/* Sidebar Call Queue */}
        <aside className="calls-sidebar">
          <h3 className="sidebar-title">Active & Past Calls</h3>
          {calls.length === 0 ? (
            <div className="empty-state">
              <p>No calls yet.</p>
              <span>Connect a call to see status here.</span>
            </div>
          ) : (
            <div className="call-list">
              {calls.map(c => (
                <div className={`call-card status-${c.internalStatus === 'completed_with_record' ? 'success' : c.internalStatus === 'record_failed' ? 'failed' : 'active'}`} key={c.callLogId}>
                  <div className="call-card-header">
                    <strong>{c.phoneNumber}</strong>
                    <span className="call-duration">{c.durationSeconds ? `${c.durationSeconds}s` : ""}</span>
                  </div>
                  <div className="call-card-form">{c.formDisplayName}</div>

                  <div className="call-card-status">
                    <span className={`status-indicator indicator-${c.status || 'default'}`}></span>
                    {getStatusLabel(c)}
                  </div>

                  {c.recordId && (
                    <div className="call-card-record">
                      ID: {c.recordId}
                    </div>
                  )}
                  {c.summary && (
                    <div className="call-card-summary">
                      <details>
                        <summary>View Call Summary</summary>
                        <p>{c.summary}</p>
                      </details>
                    </div>
                  )}
                  {c.error && (
                    <div className="call-card-error">
                      {c.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="dashboard-main">
          {step === "forms" ? (
            <>
              <StepHeader
                step="1"
                title="Select the Creator form"
                subtitle="ZoLabs will reuse a mapped voice form or create one automatically from the selected Creator schema."
              />
              <FormSelector forms={forms} onSelect={selectForm} loading={loading || busy} />
            </>
          ) : null}

          {step === "prepare" ? (
            <>
              <StepHeader
                step="2"
                title="Prepare the call"
                subtitle="Provide the phone number, review the generated call objective, and connect the call."
              />

              <section className="card">
                <div className="mapping-summary">
                  <div>
                    <p className="eyebrow">Creator form</p>
                    <h2>{selectedForm?.display_name}</h2>
                    <p className="muted">{selectedForm?.link_name}</p>
                  </div>

                  <div>
                    <p className="eyebrow">ZoLabs voice form</p>
                    <h2>{mapping?.zolabsForm?.name || "Preparing…"}</h2>
                    <p className="muted">
                      {mapping?.action === "created"
                        ? "Created automatically"
                        : "Existing mapping reused"}
                    </p>
                  </div>
                </div>

                <div className="field-summary">
                  <span>{supportedFieldCount} supported fields</span>
                  <span>{fields.filter((field) => field.required).length} required</span>
                </div>

                <label className="field-label" htmlFor="phone-number">
                  Phone number
                </label>
                <div className="input-with-action">
                  <input
                    id="phone-number"
                    className="text-input"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+919876543210"
                  />
                  <button
                    type="button"
                    className={speech.isListening && activeSpeechField === 'phone' ? "mic-button active" : "mic-button"}
                    onClick={() => toggleVoice('phone', setPhoneNumber, phoneNumber)}
                  >
                    {speech.isListening && activeSpeechField === 'phone' ? "Stop" : "Speak"}
                  </button>
                </div>

                <label className="field-label" htmlFor="call-query">
                  Call objective
                </label>
                <div className="input-with-action align-start">
                  <textarea
                    id="call-query"
                    className="text-input textarea"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    rows="6"
                  />
                  <button
                    type="button"
                    className={speech.isListening && activeSpeechField === 'query' ? "mic-button active" : "mic-button"}
                    onClick={() => toggleVoice('query', setQuery, query)}
                  >
                    {speech.isListening && activeSpeechField === 'query' ? "Stop" : "Speak"}
                  </button>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={startCall}
                  disabled={busy}
                >
                  {busy ? "Connecting…" : "Connect Call"}
                </button>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
