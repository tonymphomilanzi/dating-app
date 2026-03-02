import { Link } from "react-router-dom";

const items = Array.from({length:12}).map((_,i)=>({
  id: String(i+1),
  name: ["Jess","Camila","Nina","Lia","Sara","Ava"][i%6],
}));

export default function Matches(){
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="p-4"><h1 className="text-lg font-semibold">Matches</h1></header>
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        {items.map(m=>(
          <Link to={`/profile/${m.id}`} key={m.id} className="overflow-hidden rounded-2xl bg-white shadow-card">
            <img src={`https://images.unsplash.com/photo-1519340${300+m.id.padStart(2,"0")}-2cec6aef0c01?q=80&w=600&auto=format&fit=crop`} className="aspect-[3/4] w-full object-cover"/>
            <div className="p-2 text-sm font-medium">{m.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}