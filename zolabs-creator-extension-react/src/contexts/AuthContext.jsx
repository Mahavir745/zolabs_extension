import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
import { getCreatorContext } from "../services/creator";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [context, setContext] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSession() {
    setLoading(true);
    setError("");

    try {
      const [creatorContext, authSession] = await Promise.all([
        getCreatorContext().catch(() => ({ available: false })),
        api.session().catch(() => null)
      ]);

      setContext(creatorContext);
      setSession(authSession || { authenticated: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSession() {
    try {
      const authSession = await api.session();
      setSession(authSession);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        context,
        session,
        setSession,
        loading,
        error,
        refreshSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
