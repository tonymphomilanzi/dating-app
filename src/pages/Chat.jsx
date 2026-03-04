import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatScreen from "../components/ChatScreen.jsx"; // your design component
import { chatService } from "../services/chat.service.js";
import { supabase } from "../lib/supabase.client.js";

// tiny helpers
const sanitize = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, "-");
const fmtTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

export default function Chat(){
  const nav = useNavigate();
  const { id } = useParams(); // conversation id
  const [meId, setMeId] = useState(null);
  const [other, setOther] = useState({ name: "User", avatar: "" });
  const [msgs, setMsgs] = useState([]);
  const [blurred, setBlurred] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  // 1) Load meta + messages + mark-as-read
  useEffect(()=>{
    let mounted = true;

    (async ()=>{
      // who am I
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setMeId(user?.id || null);

      // try fetch other participant from conversations + profiles
      // (fallback to /api/chat list enrichment if needed)
      const meta = await supabase
        .from("conversations")
        .select(`
          id, user_a_id, user_b_id, match_id,
          match:matches(
            id, user_a_id, user_b_id,
            a:profiles!matches_user_a_id_fkey(id, display_name, avatar_url),
            b:profiles!matches_user_b_id_fkey(id, display_name, avatar_url)
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (meta.error) console.warn("[Chat] conv meta error:", meta.error.message);
      let otherId = null;
      let name = "User", avatar = "";

      if (meta.data) {
        const c = meta.data;
        if (c.user_a_id && c.user_b_id) {
          otherId = c.user_a_id === user?.id ? c.user_b_id : c.user_a_id;
        } else if (c.match) {
          const op = c.match.user_a_id === user?.id ? c.match.b : c.match.a;
          if (op) {
            otherId = op.id; name = op.display_name || name; avatar = op.avatar_url || avatar;
          }
        }
      }
      if (otherId && (!name || !avatar)) {
        const prof = await supabase.from("profiles").select("display_name, avatar_url").eq("id", otherId).maybeSingle();
        if (!prof.error) {
          name = prof.data?.display_name || name;
          avatar = prof.data?.avatar_url || avatar;
        }
      }
      if (!mounted) return;
      setOther({ name, avatar });

      // fetch messages via API (blur handled server-side)
      try {
        const r = await chatService.getConversation(id);
        if (!mounted) return;
        setBlurred(!!r.blurred); // if service returns {items, blurred}, tweak service or handle here
        // Map to ChatScreen format
        const mapped = (Array.isArray(r) ? r : (r.items || [])).map(m => ({
          id: m.id,
          me: m.sender_id === user?.id,
          text: m.blurred ? "•••••••••• (Premium)" : (m.text || ""),
          time: fmtTime(m.created_at),
        }));
        setMsgs(mapped);
        // mark as read up to latest
        const last = Array.isArray(r) ? r[r.length - 1] : (r.items || [])[ (r.items||[]).length - 1 ];
        if (last) {
          await chatService.markRead({ id, lastMessageId: last.id }).catch(()=>{});
        }
      } catch (e) {
        console.error("[Chat] load error:", e);
      } finally {
        if (mounted) setLoading(false);
      }

      // realtime new messages
      const ch = supabase
        .channel(`conv:${id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
          async (payload) => {
            // append
            setMsgs(prev => [...prev, {
              id: payload.new.id,
              me: payload.new.sender_id === user?.id,
              text: blurred ? "•••••••••• (Premium)" : (payload.new.text || ""),
              time: fmtTime(payload.new.created_at),
            }]);
            // mark read
            await chatService.markRead({ id, lastMessageId: payload.new.id }).catch(()=>{});
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(ch); };
    })();

    return () => { mounted = false; };
  }, [id]);

  // 2) Send text
  const handleSend = async (text) => {
    try {
      const m = await chatService.sendToConversation({ id, text });
      if (!m) return;
      setMsgs(prev => [...prev, { id: m.id, me: true, text: m.text || "", time: fmtTime(m.created_at) }]);
      await chatService.markRead({ id, lastMessageId: m.id }).catch(()=>{});
    } catch (e) {
      console.error("[Chat] send error:", e);
      alert(e.message || "Failed to send");
    }
  };

  // 3) Attachments
  const onOpenAttachment = (type) => {
    if (type === "gallery" || type === "camera") {
      fileRef.current?.click();
      return;
    }
    if (type === "location") {
      // optional: implement sending a maps url
      handleSend("📍 Shared a location");
      return;
    }
    if (type === "document" || type === "audio" || type === "contact") {
      alert(`${type} not implemented yet`);
    }
  };

  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // reset for next pick
    if (!f) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${user.id}/${id}/${Date.now()}-${sanitize(f.name)}`;
      const up = await supabase.storage.from("chat").upload(path, f, { upsert: false });
      if (up.error) throw up.error;
      const pub = supabase.storage.from("chat").getPublicUrl(path).data.publicUrl;
      await chatService.sendToConversation({ id, text: "📎 Attachment", attachment_url: pub });
      // we optimistically append a helper text; realtime will also push
    } catch (e) {
      console.error("[Chat] attach error:", e);
      alert(e.message || "Failed to upload");
    }
  };

  const headerUser = useMemo(() => ({
    name: other.name || "User",
    avatar: other.avatar || "https://picsum.photos/120",
  }), [other]);

  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-gray-600">Loading…</div>;
  }

  return (
    <>
      <ChatScreen
        user={headerUser}
        messages={msgs}
        onBack={()=>nav(-1)}
        onCall={()=>alert("Call not implemented")}
        onOpenAttachment={onOpenAttachment}
        onSend={handleSend}
      />
      <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onPickFile}/>
      {blurred && (
        <div className="pointer-events-none fixed inset-x-0 top-12 z-10 mx-auto w-full max-w-md px-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 shadow-sm">
            This conversation is locked. Upgrade to see all messages.
          </div>
        </div>
      )}
    </>
  );
}