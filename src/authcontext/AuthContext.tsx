import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "./useAuth";
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

export interface AuthContextValue {
  customer: Customer | null;
  isLoading: boolean;
  sessionError: string;
  signup: (credentials: { name: string; email: string; password: string; profilePicture?: string }) => Promise<Customer>;
  login: (credentials: { email: string; password: string }) => Promise<Customer>;
  logout: () => Promise<void>;
  updateProfile: (profile: CustomerProfile) => Promise<Customer>;
}


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

  function signup({ name, email, password, profilePicture = "" }: { name: string; email: string; password: string; profilePicture?: string }) {
    return authenticate("/auth/register", { name, email, password, profilePicture });
  }

  async function login({ email, password }: { email: string; password: string }): Promise<Customer> {
    const result = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (!result) throw new Error("The API server returned an empty response.");

    sessionStorage.setItem(CUSTOMER_TOKEN_KEY, result.token);
    setToken(result.token);
    setCustomer(result.customer);
    setSessionError("");
    return result.customer;
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
      value={{ customer, isLoading, sessionError, signup, login, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
