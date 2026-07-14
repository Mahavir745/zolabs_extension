import { useEffect, useMemo, useState } from "react";
import { api } from "./services/api";
import {
  getCreatorContext,
  getCreatorFields,
  getCreatorForms
} from "./services/creator";
import {
  generateCallObjective,
  normaliseCreatorFields
} from "./services/schema";
import { useSpeechInput } from "./hooks/useSpeechInput";
import StepHeader from "./components/StepHeader";
import FormSelector from "./components/FormSelector";
import CallStatus from "./components/CallStatus";
import ReviewResult from "./components/ReviewResult";
import ConnectZolabs from "./components/ConnectZolabs";

const demoForms = [
  {
    display_name: "Scholarship Follow-up",
    link_name: "Scholarship_Follow_Up"
  },
  {
    display_name: "New Appointment",
    link_name: "New_Appointment"
  },
  {
    display_name: "Student Intake",
    link_name: "Student_Intake"
  }
];

const demoFields = [
  {
    link_name: "Student_Name",
    display_name: "Student Name",
    type: 29,
    mandatory: true,
    subfields: [
      { link_name: "first_name", display_name: "First Name", mandatory: true },
      { link_name: "last_name", display_name: "Last Name", mandatory: true }
    ]
  },
  {
    link_name: "Current_Course",
    display_name: "Current Course",
    type: 1,
    mandatory: true
  },
  {
    link_name: "Current_Year",
    display_name: "Current Year",
    type: 1,
    mandatory: true
  },
  {
    link_name: "Continuation_Status",
    display_name: "Continuation Status",
    type: 12,
    mandatory: true,
    choices: ["Continuing", "Completed", "Discontinued"]
  },
  {
    link_name: "Support_Required",
    display_name: "Support Required",
    type: 2,
    mandatory: false
  }
];

export default function App() {
  const [context, setContext] = useState(null);
  const [session, setSession] = useState(null);
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [fields, setFields] = useState([]);
  const [mapping, setMapping] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [query, setQuery] = useState("");
  const [step, setStep] = useState("forms");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [call, setCall] = useState(null);
  const [callStatus, setCallStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [recordId, setRecordId] = useState("");
  const [creatingRecord, setCreatingRecord] = useState(false);

  const speech = useSpeechInput({ timeoutMs: 12000 });

  useEffect(() => {
    async function initialise() {
      setLoading(true);
      setError("");

      try {
        const [creatorContext, authSession] = await Promise.all([
          getCreatorContext(),
          api.session()
        ]);

        setContext(creatorContext);
        setSession(authSession);

        const creatorForms = creatorContext.available
          ? await getCreatorForms(creatorContext.appLinkName)
          : demoForms;

        setForms(creatorForms.length ? creatorForms : demoForms);
      } catch (initialiseError) {
        setError(initialiseError.message);
      } finally {
        setLoading(false);
      }
    }

    initialise();
  }, []);

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
      const rawFields = context?.available
        ? await getCreatorFields(context.appLinkName, form.link_name)
        : demoFields;

      const normalisedFields = normaliseCreatorFields(
        rawFields.length ? rawFields : demoFields
      );

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
      const response = await api.createRecord(call.callLogId, {
        appLinkName: context?.appLinkName,
        formLinkName: selectedForm?.link_name,
        accountOwnerName: context?.accountOwnerName || "",
        parsedAnswers: result?.parsedAnswers
      });

      setRecordId(response.creatorRecordId);
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

  if (!session?.authenticated && !loading) {
    return (
      <main className="app-shell">
        <section className="card auth-card">
          <div className="brand-mark">Z</div>
          <h1>Connect ZoLabs with Zoho</h1>
          <p>
            Authenticate once to connect this Creator organisation with the
            ZoLabs extension.
          </p>
          <a className="primary-button link-button" href={api.connectZohoUrl()}>
            Continue with Zoho
          </a>
        </section>
      </main>
    );
  }

  if (session?.authenticated && !session?.zolabs?.connected && !loading) {
    return (
      <ConnectZolabs
        onConnected={async () => {
          try {
            const refreshedSession = await api.session();
            setSession(refreshedSession);
          } catch (refreshError) {
            setError(refreshError.message);
          }
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand">
          <div className="brand-mark">Z</div>
          <div>
            <strong>ZoLabs for Zoho Creator</strong>
            <span>{session?.organisation?.name || "Loading organisation…"}</span>
          </div>
        </div>

        {step !== "forms" ? (
          <button type="button" className="text-button" onClick={reset}>
            Start again
          </button>
        ) : null}
      </nav>

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
