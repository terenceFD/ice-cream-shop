import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest, CUSTOMER_TOKEN_KEY } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(
    () => sessionStorage.getItem(CUSTOMER_TOKEN_KEY) || "",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setCustomer(null);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    apiRequest("/auth/me", { token })
      .then(({ customer: account }) => {
        if (!cancelled) {
          setCustomer(account);
          setSessionError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCustomer(null);
          setSessionError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    function clearExpiredSession() {
      setToken("");
      setCustomer(null);
      setSessionError("Your session expired. Please sign in again.");
    }
    window.addEventListener("customer-session-expired", clearExpiredSession);
    return () =>
      window.removeEventListener(
        "customer-session-expired",
        clearExpiredSession,
      );
  }, []);

  async function authenticate(path, credentials) {
    const result = await apiRequest(path, {
      method: "POST",
      body: credentials,
    });
    sessionStorage.setItem(CUSTOMER_TOKEN_KEY, result.token);
    setToken(result.token);
    setCustomer(result.customer);
    setSessionError("");
    return result.customer;
  }

  function signup({ name, email, password }) {
    return authenticate("/auth/register", { name, email, password });
  }

  function login({ email, password }) {
    return authenticate("/auth/login", { email, password });
  }

  async function logout() {
    try {
      if (token) await apiRequest("/auth/logout", { method: "POST", token });
    } finally {
      sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
      setToken("");
      setCustomer(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{ customer, isLoading, sessionError, signup, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
