import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "./useAuth";
import { apiRequest, clearCustomerToken, CUSTOMER_TOKEN_KEY, getCustomerToken, setCustomerToken } from "../api/api";
import { disablePromotionAlerts } from "../lib/pushNotifications";

interface Customer {
  id: number;
  name: string;
  email: string;
  profilePicture?: string;
  phone?: string;
  deliveryCity?: string;
  deliveryResidence?: string;
  loyaltyPoints?: number;
  referralCode?: string;
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
  claimedOrderId?: number | null;
}

export interface AuthContextValue {
  customer: Customer | null;
  isLoading: boolean;
  sessionError: string;
  requestSignupVerification: (credentials: { name: string; email: string; password: string; profilePicture?: string; claimOrderId?: number; referralCode?: string }) => Promise<{ verificationId: string; expiresInSeconds: number }>;
  signup: (credentials: { verificationId: string; code: string }) => Promise<Customer & { claimedOrderId?: number | null }>;
  requestPasswordReset: (email: string) => Promise<{ message?: string; verificationId?: string; expiresInSeconds?: number }>;
  confirmPasswordReset: (credentials: { verificationId: string; code: string; password: string }) => Promise<{ message?: string }>;
  login: (credentials: { email: string; password: string }) => Promise<Customer>;
  logout: () => Promise<void>;
  updateProfile: (profile: CustomerProfile) => Promise<Customer>;
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [token, setToken] = useState(
    () => getCustomerToken(),
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
    // Keep other open tabs in step when the customer signs in or out in one of them.
    function syncTokenFromOtherTab(event: StorageEvent) {
      if (event.key === CUSTOMER_TOKEN_KEY || event.key === null) setToken(getCustomerToken());
    }
    window.addEventListener("customer-session-expired", clearExpiredSession);
    window.addEventListener("storage", syncTokenFromOtherTab);
    return () => {
      window.removeEventListener(
        "customer-session-expired",
        clearExpiredSession,
      );
      window.removeEventListener("storage", syncTokenFromOtherTab);
    };
  }, []);

  async function authenticate(path: string, credentials: Record<string, string>) {
    const result = await apiRequest<AuthResponse>(path, {
      method: "POST",
      body: credentials,
    });
    setCustomerToken(result.token);
    setToken(result.token);
    setCustomer(result.customer);
    setSessionError("");
    return result.customer;
  }

  function requestSignupVerification(credentials: { name: string; email: string; password: string; profilePicture?: string; claimOrderId?: number; referralCode?: string }) {
    return apiRequest<{ verificationId: string; expiresInSeconds: number }>("/auth/register/request-verification", {
      method: "POST",
      body: credentials,
    });
  }

  async function signup({ verificationId, code }: { verificationId: string; code: string }) {
    const result = await apiRequest<AuthResponse>("/auth/register/verify", {
      method: "POST",
      body: { verificationId, code },
    });
    setCustomerToken(result.token);
    setToken(result.token);
    setCustomer(result.customer);
    setSessionError("");
    return { ...result.customer, claimedOrderId: result.claimedOrderId ?? null };
  }

  function requestPasswordReset(email: string) {
    return apiRequest<{ message?: string; verificationId?: string; expiresInSeconds?: number }>(
      "/auth/password/reset-request",
      { method: "POST", body: { email } },
    );
  }

  function confirmPasswordReset({ verificationId, code, password }: { verificationId: string; code: string; password: string }) {
    return apiRequest<{ message?: string }>("/auth/password/reset-confirm", {
      method: "POST",
      body: { verificationId, code, password },
    });
  }

  async function login({ email, password }: { email: string; password: string }): Promise<Customer> {
    const result = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (!result) throw new Error("The API server returned an empty response.");

    setCustomerToken(result.token);
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
      // Turn off promotion alerts for this device first, while the session can still do it.
      if (token) {
        await Promise.race([
          disablePromotionAlerts(token),
          new Promise((resolve) => window.setTimeout(resolve, 4000)),
        ]).catch(() => {});
      }
      if (token) await apiRequest("/auth/logout", { method: "POST", token });
    } finally {
      clearCustomerToken();
      setToken("");
      setCustomer(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{ customer, isLoading, sessionError, requestSignupVerification, signup, requestPasswordReset, confirmPasswordReset, login, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
