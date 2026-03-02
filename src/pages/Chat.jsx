import { useParams } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import Avatar from "../components/Avatar.jsx";
import { useState } from "react";

export default function Chat(){
  const { id } = useParams();
  const [text, setText] = useState("");
  const msgs = [
    { id:1, me:false, text:"Hi there! 👋" },
    { id:2, me:true, text:"Hey! Your profile looks awesome." },
    { id:3, me:false, text:"Aww thanks! Want to grab coffee?" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Grace" right={<Avatar size={32}/>}/>
      <div className="flex-1 space-y-3 bg-gray-50 p-4">
        {msgs.map(m=>(
          <div key={m.id} className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${m.me?"ml-auto bg-violet-600 text-white":"bg-white shadow-card"}`}>{m.text}</div>
        ))}
      </div>
      <div className="sticky bottom-0 flex items-center gap-2 border-t bg-white p-3">
        <button className="rounded-full p-2 hover:bg-gray-100" aria-label="Camera"><i className="lni lni-camera text-xl" /></button>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Your message..." className="field flex-1"/>
        <button className="rounded-full bg-violet-600 p-3 text-white" aria-label="Send"><i className="lni lni-telegram text-xl -rotate-12" /></button>
      </div>
    </div>
  );
}