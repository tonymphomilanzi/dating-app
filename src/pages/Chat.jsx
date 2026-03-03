import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import Avatar from "../components/Avatar.jsx";
import { chatService } from "../services/chat.service.js";
import { supabase } from "../lib/supabase";

export default function Chat(){
  const { id } = useParams();
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [meId, setMeId] = useState(null);
  const bottomRef = useRef(null);

  const markAsRead = async (messages) => {
    if (!messages?.length) return;
    const last = messages[messages.length - 1];
    try { await chatService.markRead({ id, lastMessageId: last.id }); } catch {}
  };

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      setMeId(user?.id || null);
      try {
        const data = await chatService.getConversation(id);
        if (!mounted) return;
        setMsgs(data);
        // mark as read up to latest
        await markAsRead(data);
      } catch (e) { console.error("[Chat] load conv error:", e); }

      const ch = supabase
        .channel(`conv:${id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
          (payload) => {
            setMsgs(prev => {
              const next = [...prev, payload.new];
              // mark as read when new arrives and chat is open
              markAsRead(next);
              return next;
            });
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim()) return;
    const t = text; setText("");
    try { await chatService.sendToConversation({ id, text: t }); }
    catch (e) { console.error("[Chat] send error:", e); setText(t); }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Chat" right={<Avatar size={32}/>}/>
      <div className="flex-1 space-y-3 bg-gray-50 p-4 overflow-y-auto">
        {msgs.map(m=>(
          <div key={m.id} className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${m.sender_id === meId ? "ml-auto bg-violet-600 text-white" : "bg-white shadow-card"}`}>
            {m.blurred ? "•••••••••• (Premium)" : m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-white p-3">
        <button className="rounded-full p-2 hover:bg-gray-100" aria-label="Camera"><i className="lni lni-camera text-xl" /></button>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Your message..." className="field flex-1"/>
        <button onClick={send} className="rounded-full bg-violet-600 p-3 text-white" aria-label="Send">
          <i className="lni lni-telegram text-xl -rotate-12" />
        </button>
      </div>
    </div>
  );
}