// api/events/[id].js
import { requireUser, getPremiumFlag } from "../../api/lib/_supabase.js";

export default async function handler(req, res) {
  const ctx = await requireUser(req, res); if (!ctx) return;
  const { supabase, user } = ctx;
  const { id } = req.query;

  if (req.method === "GET") {
    const { data: event, error } = await supabase
      .from("events")
      .select("*, creator:profiles!events_creator_id_fkey(id, display_name, avatar_url)")
      .eq("id", id).single();
    if (error) return res.status(404).json({ error: error.message });

    const { data: attendees } = await supabase
      .from("event_attendees")
      .select("user:profiles(id, display_name, avatar_url)")
      .eq("event_id", id);
    return res.json({ event, attendees: attendees?.map(a=>a.user) || [] });
  }

  if (req.method === "POST") {
    // join/leave toggle
    const { action } = req.body || {};
    if (action === "join") {
      const { error } = await supabase.from("event_attendees").insert({ event_id: id, user_id: user.id });
      if (error && error.code !== "23505") return res.status(400).json({ error: error.message }); // ignore unique violation
      return res.json({ ok: true, joined: true });
    } else if (action === "leave") {
      const { error } = await supabase.from("event_attendees").delete().match({ event_id: id, user_id: user.id });
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true, joined: false });
    }
    return res.status(400).json({ error: "Invalid action" });
  }

  res.setHeader("Allow", "GET,POST"); return res.status(405).end();
}