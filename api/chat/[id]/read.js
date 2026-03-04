// api/chat/[id]/read.js
import { requireUser } from "../../lib/_supabase.js";
export default async function handler(req, res) {
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;
  const { id } = req.query;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST"); return res.status(405).end();
  }

  const { lastMessageId } = req.body || {};
  try {
    // upsert last_read row
    const up = await supabase
      .from("conversation_reads")
      .upsert(
        { conversation_id: id, user_id: user.id, last_read_message_id: lastMessageId || null, last_read_at: new Date().toISOString() },
        { onConflict: "conversation_id,user_id" }
      )
      .select("*")
      .single();
    if (up.error) throw up.error;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Failed to mark read" });
  }
}