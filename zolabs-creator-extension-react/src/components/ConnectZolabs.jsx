import { useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const TERMS_TEXT = `
By connecting a ZoLabs account you agree that:

1. You are creating or linking your own individual ZoLabs account,
   separate from any other user using this widget.
2. Voice forms and outbound calls created through this widget will be
   billed to and run under that ZoLabs account and its subscription plan.
3. Zoho Creator field data sent to ZoLabs is used to generate and run the
   corresponding voice form, and call recordings/transcripts are stored by
   ZoLabs per its own retention policy.
4. You are authorised to accept ZoLabs' own Terms of Service and Privacy
   Policy on your own behalf.

Replace this placeholder text with EdZola's finalised Terms & Conditions
before this ships to real customers.
`.trim();

export default function ConnectZolabs({ onConnected }) {
  const { session } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState(session?.user?.display_name || "");
  const [email, setEmail] = useState(session?.user?.email || "");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!termsAccepted) {
      setError("You must accept the Terms & Conditions to continue.");
      return;
    }

    if (!email || password.length < 8 || (mode === "signup" && !username)) {
      setError(
        mode === "signup"
          ? "Enter a valid username, email, and a password of at least 8 characters."
          : "Enter a valid email and a password of at least 8 characters."
      );
      return;
    }

    setBusy(true);

    try {
      const payload = { username, email, password, termsAccepted: true };

      if (mode === "signup") {
        const response = await api.zolabsSignup(payload);
        setInfo(
          response.message ||
            "Account created. Check your email for a ZoLabs activation link, " +
              "then switch to Log in below."
        );
        setMode("login");
      } else {
        await api.zolabsLogin(payload);
        onConnected();
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="card auth-card">
        <div className="brand-mark">Z</div>
        <h1>Connect a ZoLabs account</h1>
        <p>
          You need your own ZoLabs account before you can create
          voice forms or place calls. Every Zoho Creator user connects
          a separate ZoLabs account of their own.
        </p>

        <div className="terms-box" style={{ whiteSpace: "pre-wrap" }}>
          {TERMS_TEXT}
        </div>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label className="field-label" htmlFor="zolabs-username">
                ZoLabs username
              </label>
              <input
                id="zolabs-username"
                className="text-input"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </>
          )}

          <label className="field-label" htmlFor="zolabs-email">
            ZoLabs email
          </label>
          <input
            id="zolabs-email"
            className="text-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />

          <label className="field-label" htmlFor="zolabs-password">
            ZoLabs password
          </label>
          <input
            id="zolabs-password"
            className="text-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span>I have read and accept the Terms & Conditions above.</span>
          </label>

          {error ? <div className="error-banner">{error}</div> : null}
          {info ? <div className="info-banner">{info}</div> : null}

          <button type="submit" className="primary-button" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create ZoLabs account"
                : "Log in to ZoLabs"}
          </button>
        </form>

        <button
          type="button"
          className="text-button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError("");
            setInfo("");
          }}
        >
          {mode === "signup"
            ? "Already have a ZoLabs account? Log in instead"
            : "New to ZoLabs? Create an account instead"}
        </button>
      </section>
    </main>
  );
}
