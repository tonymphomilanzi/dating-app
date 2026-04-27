// src/contexts/AuthFlowContext.jsx
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from "react";

// Constants for session storage keys
const STORAGE_KEYS = {
  EMAIL: "AF_email",
  DISPLAY_NAME: "AF_name",
  PENDING_PASSWORD: "AF_pwd",
  OTP_TYPE: "AF_type",
};

// Safe storage helpers for private/incognito mode
function safeGet(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch (e) {
    console.warn("SessionStorage read failed:", e.message);
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch (e) {
    console.warn("SessionStorage write failed:", e.message);
  }
}

function safeRemove(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch (e) {
    console.warn("SessionStorage remove failed:", e.message);
  }
}

// Create context
const AuthFlowContext = createContext(null);

// Provider Component
export function AuthFlowProvider({ children }) {
  // Hydrate state from session storage
  const [email, setEmail] = useState(() => safeGet(STORAGE_KEYS.EMAIL) || "");
  const [displayName, setDisplayName] = useState(
    () => safeGet(STORAGE_KEYS.DISPLAY_NAME) || ""
  );
  const [pendingPassword, setPendingPassword] = useState(
    () => safeGet(STORAGE_KEYS.PENDING_PASSWORD) || ""
  );
  const [otpType, setOtpType] = useState(
    () => safeGet(STORAGE_KEYS.OTP_TYPE) || "signup"
  );

  // Initialize auth flow with provided data
  const startSignupFlow = useCallback(
    ({
      email: em = "",
      displayName: dn = "",
      password: pw = "",
      type = "signup",
    }) => {
      // Update React state
      setEmail(em);
      setDisplayName(dn);
      setPendingPassword(pw);
      setOtpType(type);

      // Persist to session storage
      safeSet(STORAGE_KEYS.EMAIL, em);
      safeSet(STORAGE_KEYS.DISPLAY_NAME, dn);
      safeSet(STORAGE_KEYS.PENDING_PASSWORD, pw);
      safeSet(STORAGE_KEYS.OTP_TYPE, type);
    },
    []
  );

  // Clear all auth flow data
  const clearFlow = useCallback(() => {
    // Update React state
    setEmail("");
    setDisplayName("");
    setPendingPassword("");
    setOtpType("signup");

    // Clear storage
    safeRemove(STORAGE_KEYS.EMAIL);
    safeRemove(STORAGE_KEYS.DISPLAY_NAME);
    safeRemove(STORAGE_KEYS.PENDING_PASSWORD);
    safeRemove(STORAGE_KEYS.OTP_TYPE);
  }, []);

  // Update individual email field
  const updateEmail = useCallback((newEmail) => {
    setEmail(newEmail);
    safeSet(STORAGE_KEYS.EMAIL, newEmail);
  }, []);

  // Update individual display name field
  const updateDisplayName = useCallback((newName) => {
    setDisplayName(newName);
    safeSet(STORAGE_KEYS.DISPLAY_NAME, newName);
  }, []);

  // Update individual password field
  const updatePassword = useCallback((newPassword) => {
    setPendingPassword(newPassword);
    safeSet(STORAGE_KEYS.PENDING_PASSWORD, newPassword);
  }, []);

  // Memoized context value
  const value = useMemo(
    () => ({
      // State values
      email,
      displayName,
      pendingPassword,
      otpType,

      // Individual update functions
      updateEmail,
      updateDisplayName,
      updatePassword,

      // Actions
      startSignupFlow,
      clearFlow,
    }),
    [
      email,
      displayName,
      pendingPassword,
      otpType,
      updateEmail,
      updateDisplayName,
      updatePassword,
      startSignupFlow,
      clearFlow,
    ]
  );

  return (
    <AuthFlowContext.Provider value={value}>
      {children}
    </AuthFlowContext.Provider>
  );
}

// Custom hook to use auth flow context
export function useAuthFlow() {
  const context = useContext(AuthFlowContext);

  if (!context) {
    throw new Error(
      "useAuthFlow must be used within an AuthFlowProvider component"
    );
  }

  return context;
}

// Optional: Export context for advanced use cases
export { AuthFlowContext };