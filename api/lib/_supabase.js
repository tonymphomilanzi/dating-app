// api/_supabase.js
import { createClient } from "@supabase/supabase-js";

export function supabaseFromReq(req) {
  if (!process.env.SUPABASE_URL?.startsWith("https://")) {
    throw new Error("Invalid SUPABASE_URL on server");
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: req.headers.authorization ?? "",
        },
      },
    }
  );
}
export async function requireUser(req, res) {
  const supabase = supabaseFromReq(req);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return { supabase, user };
}

export async function getPremiumFlag(supabase, userId) {
  const { data, error } = await supabase.from("profiles").select("is_premium").eq("id", userId).single();
  if (error) throw error;
  return !!data?.is_premium;
}