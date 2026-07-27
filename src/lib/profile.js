// src/lib/profile.js
import { supabase } from "./supabase.client"; // adjust to your supabase client path

export async function getProfileCompletion() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { isComplete: false, redirectTo: "/setup/basics" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, dob, gender, interests, avatar_url")
    .eq("id", user.id)
    .single();

  // Adjust field names to match your actual DB columns
  if (!profile?.name)       return { isComplete: false, redirectTo: "/setup/basics" };
  if (!profile?.dob)        return { isComplete: false, redirectTo: "/setup/dob" };
  if (!profile?.gender)     return { isComplete: false, redirectTo: "/setup/gender" };
  if (!profile?.interests)  return { isComplete: false, redirectTo: "/setup/interests" };
  if (!profile?.avatar_url) return { isComplete: false, redirectTo: "/setup/photo" };

  return { isComplete: true, redirectTo: "/discover" };
}