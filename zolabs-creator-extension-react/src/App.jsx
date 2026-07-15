import { useEffect, useMemo, useState } from "react";
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
import CallStatus from "./components/CallStatus";
import ReviewResult from "./components/ReviewResult";
import ConnectZolabs from "./components/ConnectZolabs";

export default function App() {
  const { context, session, loading, error: authError, refreshSession } = useAuth();
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [mapping, setMapping] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [query, setQuery] = useState("");
  const [step, setStep] = useState("forms");
  const [error, setError] = useState("");
  const [call, setCall] = useState(null);
  const [callStatus, setCallStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [recordId, setRecordId] = useState("");
  const [creatingRecord, setCreatingRecord] = useState(false);
  const [busy, setBusy] = useState(false);

  const speech = useSpeechInput({ timeoutMs: 12000 });

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

  useEffect(() => {
    if (!call?.callLogId || step !== "call") return;

    const timer = window.setInterval(async () => {
      try {
        const status = await api.getCallStatus(call.callLogId);
        setCallStatus(status);

        if (status.readyForReview) {
          window.clearInterval(timer);
          const callResult = await api.getCallResult(call.callLogId);
          setResult(callResult);
          setStep("result");
        }

        if (["failed", "busy", "no_answer"].includes(status.status)) {
          window.clearInterval(timer);
        }
      } catch (pollError) {
        setError(pollError.message);
        window.clearInterval(timer);
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [call, step]);

  const supportedFieldCount = useMemo(
    () => fields.filter((field) => field.type).length,
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

  function captureVoice(setter) {
    speech.start((transcript) => setter(transcript));
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

      setCall(response);
      setCallStatus({
        status: response.status,
        durationSeconds: 0
      });
      setStep("call");
    } catch (callError) {
      setError(callError.message);
    } finally {
      setBusy(false);
    }
  }

  async function createRecord() {
    setCreatingRecord(true);
    setError("");

    try {
      // Map ZoLabs parsed answers to strict Creator link names
      // ZoLabs keys often come back lowercased or slightly modified from the label.
      const mappedAnswers = {};
      for (const [key, value] of Object.entries(result.parsedAnswers)) {
        if (!value || value === "<N/A>" || value === "Not captured") continue;
        
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
        const field = fields.find(f => 
          f.linkName.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedKey ||
          (f.label && f.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedKey)
        );
        
        let mappedValue = value;
        
        // Auto-format YYYY-MM-DD dates to DD-MMM-YYYY as expected by Creator
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [yyyy, mm, dd] = value.split("-");
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const monthStr = months[parseInt(mm, 10) - 1];
          mappedValue = `${dd}-${monthStr}-${yyyy}`;
        }

        if (field) {
          mappedAnswers[field.linkName] = mappedValue;
        } else {
          // Fallback if no match found
          mappedAnswers[key] = mappedValue;
        }
      }

      const creatorRecordResponse = await createCreatorRecord(
        context.appLinkName,
        selectedForm.link_name,
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

      await api.recordCreated(call.callLogId, { creatorRecordId: String(id) });
      setRecordId(String(id));
    } catch (recordError) {
      setError(recordError.message);
    } finally {
      setCreatingRecord(false);
    }
  }

  function reset() {
    setSelectedForm(null);
    setFields([]);
    setMapping(null);
    setPhoneNumber("");
    setQuery("");
    setCall(null);
    setCallStatus(null);
    setResult(null);
    setRecordId("");
    setError("");
    setStep("forms");
  }

  if ((!session?.authenticated || !session?.zolabs?.connected) && !loading) {
    return <ConnectZolabs onConnected={refreshSession} />;
  }

  return (
    <main className="app-shell">
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
              Start again
            </button>
          ) : null}
          
          <button 
            type="button" 
            className="text-button" 
            style={{ color: '#ff6b6b' }}
            onClick={async () => {
              try {
                await api.zolabsDisconnect();
                refreshSession();
              } catch (e) {
                console.error("Logout failed:", e);
              }
            }}
          >
            Logout
          </button>
        </div>
      </nav>

      {authError ? <div className="error-banner">{authError}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      {speech.error ? <div className="error-banner">{speech.error}</div> : null}

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
                className={speech.isListening ? "mic-button active" : "mic-button"}
                onClick={() => captureVoice(setPhoneNumber)}
              >
                {speech.isListening ? "Stop" : "Speak"}
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
                className={speech.isListening ? "mic-button active" : "mic-button"}
                onClick={() => captureVoice(setQuery)}
              >
                {speech.isListening ? "Stop" : "Speak"}
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

      {step === "call" ? (
        <>
          <StepHeader
            step="3"
            title="Call in progress"
            subtitle="The status will update automatically while ZoLabs conducts the conversation."
          />
          <CallStatus
            status={callStatus?.status}
            durationSeconds={callStatus?.durationSeconds}
            phoneNumber={phoneNumber}
          />
        </>
      ) : null}

      {step === "result" ? (
        <>
          <StepHeader
            step="4"
            title="Review and create the record"
            subtitle="Validate the extracted values before creating the new record in Zoho Creator."
          />
          <ReviewResult
            result={result}
            onCreateRecord={createRecord}
            creatingRecord={creatingRecord}
            recordId={recordId}
          />
        </>
      ) : null}
    </main>
  );
}
