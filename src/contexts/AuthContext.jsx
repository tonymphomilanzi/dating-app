// src/contexts/AuthFlowContext.jsx
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Keys used for persisting temporary auth flow state in session storage.
 * These ensure the flow survives a page reload (e.g. during Magic Link wait).
 */
const STORAGE_KEYS = {
  EMAIL: "AF_email",
  DISPLAY_NAME: "AF_name",
  PENDING_PASSWORD: "AF_pwd", // WARNING: Storing passwords is generally discouraged, but used here for ephemeral flow state.
  OTP_TYPE: "AF_type",
};

// ─── Helpers (Storage Safety) ───────────────────────────────────────────────────

/**
 * Safe wrapper around sessionStorage to handle SecurityError in private modes.
 * Returns null on error.
 */
function safeGet(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch (e) {
    // console.warn("[AuthFlow] SessionStorage read failed:", e.message);
    return null;
  }
}

/**
 * Safe wrapper around sessionStorage to handle SecurityError in private modes.
 */
function safeSet(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch (e) {
    // console.warn("[AuthFlow] SessionStorage write failed:", e.message);
  }
}

/**
 * Safe wrapper to remove a key.
 */
function safeRemove(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch (e) {
    // console.warn("[AuthFlow] SessionStorage remove failed:", e.message);
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

const Ctx = createContext(null);

/**
 * Provider for ephemeral state during the authentication flow.
 *
 * This manages the temporary data required to complete a signup or login
 * sequence (e.g. entering email, name, and password before verifying via OTP
 * or Magic Link). It persists this data to `sessionStorage` so that if the
 * user refreshes the page, they don't lose their progress.
 *
 * NOTE: Data in this context is transient and cleared once the flow completes
 * or is explicitly aborted.
 */
export function AuthFlowProvider({ children }) {
  // ── State Initialization (Hydration) ───────────────────────────────────────
  // We hydrate the state from sessionStorage on mount so page reloads preserve
  // the user's partial input.

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

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Initialize or update the auth flow state.
   * Persists all provided fields to sessionStorage.
   *
   * @param {object} payload
   * @param {string} payload.email
   * @param {string} [payload.displayName]
   * @param {string} [payload.password]
   * @param {"signup"|"magiclink"} [payload.type]
   */
  const startSignupFlow = useCallback(
    ({ email: em, displayName: dn, password: pw, type }) => {
      const nextEmail = em || "";
      const nextName = dn || "";
      const nextPw = pw || "";
      const nextType = type || "signup";

      // Update React State
      setEmail(nextEmail);
      setDisplayName(nextName);
      setPendingPassword(nextPw);
      setOtpType(nextType);

      // Persist to Storage
      safeSet(STORAGE_KEYS.EMAIL, nextEmail);
      safeSet(STORAGE_KEYS.DISPLAY_NAME, nextName);
      safeSet(STORAGE_KEYS.PENDING_PASSWORD, nextPw);
      safeSet(STORAGE_KEYS.OTP_TYPE, nextType);
    },
    []
  );

  /**
   * Reset the flow state.
   * Clears React state and removes all auth-flow keys from sessionStorage.
   */
  const clearFlow = useCallback(() => {
    // Update React State
    setDisplayName("");
    setPendingPassword("");
    setOtpType("signup"); // Reset to default type

    // Clear Storage
    safeRemove(STORAGE_KEYS.DISPLAY_NAME);
    safeRemove(STORAGE_KEYS.PENDING_PASSWORD);
    safeRemove(STORAGE_KEYS.OTP_TYPE);
    // Note: We generally keep the EMAIL in storage or clear it depending on UX preference.
    // Here, we clear everything to ensure a clean slate.
    safeRemove(STORAGE_KEYS.EMAIL);
  }, []);

  // ── Context Value ─────────────────────────────────────────────────────────

  const value = useMemo(
    () => ({
      // Getters
      email,
      displayName,
      pendingPassword,
      otpType, // "signup" | "magiclink"

      // Setters
      setEmail, // Exposed for granular updates if needed (e.g. correcting email typo)

      // Actions
      startSignupFlow,
      clearFlow,
    }),
    [
      email,
      displayName,
      pendingPassword,
      otpType,
      startSignupFlow,
      clearFlow,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the AuthFlow context.
 *
 * @throws {Error} if used outside of AuthFlowProvider
 */
export function useAuthFlow() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useAuthFlow must be used within <AuthFlowProvider>");
  }
  return ctx;
}