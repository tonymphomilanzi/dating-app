// src/lib/auth.js
import { supabase } from "./supabase.client.js"; // adjust to your supabase client path

export async function getAuthSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session; // null = not logged in
}