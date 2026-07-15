import { useState, useEffect } from "react";
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

  const [useEmailFallback, setUseEmailFallback] = useState(false);
  const [zohoEmail, setZohoEmail] = useState("");
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    try {
      if (window.ZOHO && window.ZOHO.CREATOR) {
        window.ZOHO.CREATOR.UTIL.getInitParams().then((params) => {
          if (params && params.loginUser) {
            setZohoEmail(params.loginUser);
          }
        });
      }
    } catch (e) {
      console.warn("Zoho SDK not available yet.");
    }
  }, []);

  async function signInWithZoho() {
    setBusy(true);
    setError("");
    setInfo("");

    if (!termsAccepted) {
      setError("Please accept the Terms & Conditions before continuing.");
      setBusy(false);
      return;
    }

    try {
      let emailToUse = zohoEmail;
      
      if (!emailToUse && window.ZOHO && window.ZOHO.CREATOR) {
        const params = await window.ZOHO.CREATOR.UTIL.getInitParams();
        emailToUse = params.loginUser;
      }

      if (!emailToUse) {
        throw new Error("We couldn't automatically retrieve your Zoho email. Please use the email login option below.");
      }

      const response = await api.zolabsZohoSSO({ email: emailToUse, termsAccepted: true });
      
      if (response.activationRequired) {
        setInfo(
          `🎉 Almost there! We've created your account.\n\nFor your security, please check your inbox (${emailToUse}) and click the activation link.\n\nOnce activated, simply click 'Sign in with Zoho' again to jump right in!`
        );
        setUseEmailFallback(false);
      } else {
        onConnected();
      }
    } catch (err) {
      setError(
        err.message || "We couldn't securely sign you in with Zoho right now. Please use the email login option."
      );
      setUseEmailFallback(true);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (!termsAccepted) {
      setError("Please accept the Terms & Conditions before continuing.");
      return;
    }

    if (!email || password.length < 8 || (mode === "signup" && !username)) {
      setError(
        mode === "signup"
          ? "Please provide a valid username, email, and a password of at least 8 characters."
          : "Please provide a valid email and a password of at least 8 characters."
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
            "🎉 Account successfully created! Please check your email for an activation link, then switch to 'Log in' below."
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

        {!useEmailFallback ? (
          <div className="sso-container">
            <div className="terms-container" style={{ width: "100%", marginTop: "8px" }}>
              <button 
                type="button" 
                className="terms-toggle" 
                onClick={() => setShowTerms(!showTerms)}
              >
                Read Terms & Conditions
                <span className={`terms-arrow ${showTerms ? 'open' : ''}`}>▼</span>
              </button>
              
              <div className={`terms-box ${showTerms ? 'open' : ''}`} style={{ whiteSpace: "pre-wrap" }}>
                {TERMS_TEXT}
              </div>
            </div>

            <label className="checkbox-row" style={{ marginBottom: "24px", justifyContent: "center", width: "100%" }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>I have read and accept the Terms & Conditions.</span>
            </label>

            {error ? <div className="error-banner">{error}</div> : null}
            {info ? <div className="info-banner">{info}</div> : null}

            <button
              type="button"
              className="zoho-sso-button"
              onClick={signInWithZoho}
              disabled={busy}
            >
              <div className="zoho-logo-container">
                <span className="zoho-c-red">Z</span>
                <span className="zoho-c-green">O</span>
                <span className="zoho-c-yellow">H</span>
                <span className="zoho-c-blue">O</span>
              </div>
              <span className="zoho-sso-text">
                {busy ? "Signing in..." : zohoEmail ? `Continue as ${zohoEmail}` : "Sign in with Zoho"}
              </span>
            </button>
            <button
              type="button"
              className="text-button small-text"
              onClick={() => setUseEmailFallback(true)}
            >
              Use Email & Password instead
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="fallback-form">
            <button
              type="button"
              className="back-button-styled"
              onClick={() => {
                setUseEmailFallback(false);
                setError("");
              }}
            >
              <div className="zoho-logo-container" style={{ fontSize: '0.9rem', marginRight: '8px' }}>
                <span className="zoho-c-red">Z</span>
                <span className="zoho-c-green">O</span>
                <span className="zoho-c-yellow">H</span>
                <span className="zoho-c-blue">O</span>
              </div>
            </button>
            
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

            <div className="terms-container" style={{ marginTop: "24px" }}>
              <button 
                type="button" 
                className="terms-toggle" 
                onClick={() => setShowTerms(!showTerms)}
              >
                Read Terms & Conditions
                <span className={`terms-arrow ${showTerms ? 'open' : ''}`}>▼</span>
              </button>
              
              <div className={`terms-box ${showTerms ? 'open' : ''}`} style={{ whiteSpace: "pre-wrap" }}>
                {TERMS_TEXT}
              </div>
            </div>

            <label className="checkbox-row" style={{ marginBottom: "24px", justifyContent: "center" }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>I have read and accept the Terms & Conditions.</span>
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

            <button
              type="button"
              className="text-button"
              style={{ marginBottom: '16px' }}
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
          </form>
        )}
      </section>
    </main>
  );
}
