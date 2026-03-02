import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Gender(){
  const [val, setVal] = useState(null);
  const nav = useNavigate();

  const Item = ({label})=>(
    <button
      onClick={()=>setVal(label)}
      className={`w-full rounded-xl border px-4 py-3 text-left ${val===label?"border-transparent bg-violet-600 text-white":"border-gray-200"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-dvh">
      <TopBar title="I am a" />
      <div className="space-y-4 p-6">
        <Item label="Woman"/>
        <Item label="Man"/>
        <Item label="Choose another" />
        <Button className="mt-2 w-full" disabled={!val} onClick={()=>nav("/profile/interests")}>Continue</Button>
      </div>
    </div>
  );
}