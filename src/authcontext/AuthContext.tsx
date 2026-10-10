import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest, CUSTOMER_TOKEN_KEY } from "../api/api";

interface Customer {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
  phone?: string;
  deliveryCity?: string;
  deliveryResidence?: string;
}

interface CustomerProfile {
  name: string;
  phone: string;
  deliveryCity: string;
  deliveryResidence: string;
  profilePicture: string;
}

interface AuthResponse {
  token: string;
  customer: Customer;
}

type LoginResult =
  | { verificationRequired: true }
  | { verificationRequired: false; customer: Customer };

interface AuthContextValue {
  customer: Customer | null;
  isLoading: boolean;
  sessionError: string;
  requestSignupCode: (credentials: { name: string; email: string; password: string; profilePicture?: string }) => Promise<void>;
  signup: (credentials: { email: string; code: string }) => Promise<Customer>;
  login: (credentials: { email: string; password: string }) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateProfile: (profile: CustomerProfile) => Promise<Customer>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
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
      .then(({ customer: account }: { customer: Customer }) => {
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

  async function authenticate(path: string, credentials: Record<string, string>) {
    const result = await apiRequest<AuthResponse>(path, {
      method: "POST",
      body: credentials,
    });
    sessionStorage.setItem(CUSTOMER_TOKEN_KEY, result.token);
    setToken(result.token);
    setCustomer(result.customer);
    setSessionError("");
    return result.customer;
  }

  async function requestSignupCode({ name, email, password, profilePicture = "" }: { name: string; email: string; password: string; profilePicture?: string }) {
    await apiRequest("/auth/register/code", {
      method: "POST",
      body: { name, email, password, profilePicture },
    });
  }

  function signup({ email, code }: { email: string; code: string }) {
    return authenticate("/auth/register/verify", { email, code });
  }

  async function login({ email, password }: { email: string; password: string }): Promise<LoginResult> {
    const result = await apiRequest<AuthResponse & { verificationRequired?: false } | { verificationRequired: true }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (!result) throw new Error("The API server returned an empty response.");
    if (result.verificationRequired === true) return { verificationRequired: true };

    sessionStorage.setItem(CUSTOMER_TOKEN_KEY, result.token);
    setToken(result.token);
    setCustomer(result.customer);
    setSessionError("");
    return { verificationRequired: false, customer: result.customer };
  }

  async function updateProfile(profile: CustomerProfile) {
    const result = await apiRequest<{ customer: Customer }>("/auth/profile", {
      method: "PUT",
      token,
      body: profile,
    });
    setCustomer(result.customer);
    return result.customer;
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
      value={{ customer, isLoading, sessionError, requestSignupCode, signup, login, logout, updateProfile }}
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
