import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatScreen from "../components/ChatScreen.jsx";
import LoaderOverlay from "../components/LoaderOverlay.jsx";
import { chatService } from "../services/chat.service.js";
import { supabase } from "../lib/supabase.client.js";
import { ChatCache } from "../lib/cache.js";

const sanitize = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, "-");
const fmtTime = (iso) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};

export default function Chat(){
  const nav = useNavigate();
  const { id } = useParams(); // conversation id
  const [meId, setMeId] = useState(null);
  const [other, setOther] = useState({ name: "User", avatar: "", online: false });
  const [status, setStatus] = useState(""); // 'Typing…' | '' | 'Online'
  const [msgs, setMsgs] = useState([]);
  const [blurred, setBlurred] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const fileRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingIdleRef = useRef(null);
  const channelRef = useRef(null);

  // 1) Load cached + remote + mark read; set presence & typing
  useEffect(()=>{
    let mounted = true;

    (async ()=>{
      // identify me
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setMeId(user?.id || null);

      // show cached first
      const cached = ChatCache.loadMessages(id).map(m => ({
        id: m.id, me: m.me, text: m.text, time: m.time, attachmentUrl: m.attachmentUrl, attachmentType: m.attachmentType
      }));
      if (cached.length) setMsgs(cached);

      // load other header
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

      let otherId = null, name = "User", avatar = "";
      if (meta.data) {
        const c = meta.data;
        if (c.user_a_id && c.user_b_id) {
          otherId = c.user_a_id === user?.id ? c.user_b_id : c.user_a_id;
        } else if (c.match) {
          const op = c.match.user_a_id === user?.id ? c.match.b : c.match.a;
          if (op) { otherId = op.id; name = op.display_name || name; avatar = op.avatar_url || avatar; }
        }
      }
      if (otherId && (!name || !avatar)) {
        const prof = await supabase.from("profiles").select("display_name, avatar_url").eq("id", otherId).maybeSingle();
        if (!prof.error) { name = prof.data?.display_name || name; avatar = prof.data?.avatar_url || avatar; }
      }
      if (!mounted) return;
      setOther(prev => ({ ...prev, name, avatar }));

      // fetch remote messages
      try {
        const r = await chatService.getConversation(id);
        if (!mounted) return;
        const arr = Array.isArray(r) ? r : (r.items || []);
        setBlurred(!!r.blurred);
        const mapped = arr.map(m => ({
          id: m.id,
          me: m.sender_id === user?.id,
          text: m.blurred ? "•••••••••• (Premium)" : (m.text || ""),
          time: fmtTime(m.created_at),
          attachmentUrl: m.attachment_url || null,
          attachmentType: null, // fill if you store mime types
        }));
        setMsgs(mapped);
        ChatCache.saveMessages(id, mapped);
        // mark as read
        if (arr.length) await chatService.markRead({ id, lastMessageId: arr[arr.length-1].id }).catch(()=>{});
      } catch (e) {
        console.error("[Chat] load error:", e);
      } finally {
        if (mounted) setInitialLoading(false);
      }

      // realtime messages
      const ch = supabase
        .channel(`conv:${id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
          async (payload) => {
            setMsgs(prev => {
              const next = [...prev, {
                id: payload.new.id,
                me: payload.new.sender_id === user?.id,
                text: blurred ? "•••••••••• (Premium)" : (payload.new.text || ""),
                time: fmtTime(payload.new.created_at),
                attachmentUrl: payload.new.attachment_url || null,
              }];
              ChatCache.saveMessages(id, next);
              return next;
            });
            await chatService.markRead({ id, lastMessageId: payload.new.id }).catch(()=>{});
          }
        )
        // presence+typing in same channel via Realtime broadcast
        .on("presence", { event: "sync" }, () => {
          const state = ch.presenceState();
          // if other present, mark online
          const others = Object.keys(state).filter(k => k !== user?.id);
          setOther(o => ({ ...o, online: others.length > 0 }));
        })
        .on("broadcast", { event: "typing" }, (e) => {
          if (e.payload?.userId !== user?.id) {
            setStatus("Typing…");
            clearTimeout(typingTimerRef.current);
            typingTimerRef.current = setTimeout(() => setStatus(other.online ? "Online" : ""), 1500);
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.track({ userId: user?.id, typing: false });
          }
        });

      channelRef.current = ch;
    })();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      clearTimeout(typingTimerRef.current);
      clearTimeout(typingIdleRef.current);
    };
  }, [id]);

  // typing: broadcast events on input changes (throttled)
  const notifyTyping = () => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: "broadcast", event: "typing", payload: { userId: meId, typing: true } });
    clearTimeout(typingIdleRef.current);
    typingIdleRef.current = setTimeout(() => {
      ch.send({ type: "broadcast", event: "typing", payload: { userId: meId, typing: false } });
    }, 1200);
  };

  // send text
  const handleSend = async (text) => {
    try {
      const m = await chatService.sendToConversation({ id, text });
      if (!m) return;
      const msg = { id: m.id, me: true, text: m.text || "", time: fmtTime(m.created_at) };
      setMsgs(prev => { const next = [...prev, msg]; ChatCache.saveMessages(id, next); return next; });
      await chatService.markRead({ id, lastMessageId: m.id }).catch(()=>{});
    } catch (e) {
      console.error("[Chat] send error:", e);
      alert(e.message || "Failed to send");
    }
  };

  // attachments (image/video)
  const onOpenAttachment = (type) => {
    if (type === "gallery" || type === "camera") fileRef.current?.click();
    else if (type === "location") handleSend("Shared a location");
    else alert(`${type} not implemented yet`);
  };
  const onPickFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const path = `${user.id}/${id}/${Date.now()}-${sanitize(f.name)}`;
      const up = await supabase.storage.from("chat").upload(path, f, { upsert: false });
      if (up.error) throw up.error;
      const pub = supabase.storage.from("chat").getPublicUrl(path).data.publicUrl;
      await chatService.sendToConversation({ id, text: "Attachment", attachment_url: pub });
      // realtime will append
    } catch (e) {
      console.error("[Chat] attach error:", e);
      alert(e.message || "Failed to upload");
    }
  };

  const headerUser = useMemo(() => ({
    name: other.name || "User",
    avatar: other.avatar || "https://picsum.photos/120",
    online: other.online || false,
  }), [other]);

  return (
    <>
      {initialLoading && msgs.length === 0 && <LoaderOverlay text="Loading chat…" />}
      <ChatScreen
        user={headerUser}
        status={status}
        messages={msgs}
        onBack={()=>nav(-1)}
        onCall={()=>alert("Call not implemented")}
        onMore={()=>alert("More")}
        onOpenAttachment={onOpenAttachment}
        onOpenAttachmentItem={(m)=> window.open(m.attachmentUrl, "_blank")}
        onSend={(t)=>{ notifyTyping(); handleSend(t); }}
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