import TopBar from "../components/TopBar.jsx";
import Tag from "../components/Tag.jsx";
import Button from "../components/Button.jsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const all = ["Photography","Art","Travel","Cooking","Dogs","Fitness","Hiking","Music","Yoga","Dancing","Outdoors","Reading","Tech","Gaming"];

export default function Interests(){
  const [setList,setSetList] = useState([]);
  const nav = useNavigate();
  const toggle = (t)=> setSetList(v => v.includes(t) ? v.filter(x=>x!==t) : [...v, t]);

  return (
    <div className="min-h-dvh">
      <TopBar title="Your interests"/>
      <div className="space-y-6 p-6">
        <p className="text-sm text-gray-600">Select at least 5 interests to personalize discovery.</p>
        <div className="flex flex-wrap gap-2">
          {all.map(t=> <Tag key={t} label={t} active={setList.includes(t)} onClick={()=>toggle(t)}/>)}
        </div>
        <Button className="w-full" disabled={setList.length<5} onClick={()=>nav("/permissions/contacts")}>Continue</Button>
      </div>
    </div>
  );
}