import { Link } from "react-router-dom";
import Avatar from "../components/Avatar.jsx";

const chats = [
  { id:"1", name:"Grace", last:"See you tonight? 😊", time:"2m" },
  { id:"2", name:"Annabelle", last:"Loved your photos!", time:"1h" },
  { id:"3", name:"Jake", last:"Coffee tomorrow?", time:"3h" },
];

export default function Messages(){
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold">Messages</h1>
        <div className="flex items-center gap-1">
          <button className="rounded-full p-2 hover:bg-gray-100" aria-label="Search"><i className="lni lni-search text-xl" /></button>
          <button className="rounded-full p-2 hover:bg-gray-100" aria-label="More"><i className="lni lni-more text-xl" /></button>
        </div>
      </header>
      <div className="divide-y">
        {chats.map(c=>(
          <Link key={c.id} to={`/chat/${c.id}`} className="flex items-center gap-3 bg-white px-4 py-3">
            <Avatar size={44}/>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">{c.time}</div>
              </div>
              <div className="text-sm text-gray-600 line-clamp-1">{c.last}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}