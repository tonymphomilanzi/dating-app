// src/lib/authActions.js
// Single source for all auth operations
// Components call these — never call supabase.auth directly in components

import { supabase } from "./supabase.client.js";
import { authStore } from "./authStore.js";

// ─── Email / Password ─────────────────────────────────────────────

/**
 * Register with email + password.
 * Supabase sends a confirmation email automatically.
 * User lands on EmailVerify page to wait for confirmation.
 */
export async function signUpWithEmail({ email, password, displayName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        full_name:    displayName,
      },
      // Redirect after email confirmation click
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with email + password.
 * On success AuthContext.onAuthStateChange fires → loads profile → router navigates.
 */
export async function signInWithEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Send password reset email.
 */
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
  });

  if (error) throw error;
}

// ─── Google OAuth ─────────────────────────────────────────────────

/**
 * Start Google sign-in/sign-up flow.
 * Redirects to Google → comes back to /auth/callback.
 * Works for both new and existing users.
 */
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account", // Always show account picker
      },
    },
  });

  if (error) throw error;
}

// ─── Sign out ─────────────────────────────────────────────────────

/**
 * Sign out current user.
 * AuthContext.signOut() should be called instead of this directly
 * so React state is also cleared.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── Session helpers ──────────────────────────────────────────────

/**
 * Exchange the ?code= param from email confirmation / OAuth callback.
 * Called by AuthCallback page.
 */
export async function exchangeCodeForSession(code) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data;
}

/**
 * Update password (used on recovery flow after reset email click).
 */
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}