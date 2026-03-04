import { useState } from "react";
import TopBar from "../../components/TopBar.jsx";
import Button from "../../components/Button.jsx";
import { supabase } from "../../../api/lib/supabase.js";
import { useNavigate } from "react-router-dom";

const years = Array.from({length: 70}, (_,i)=> new Date().getFullYear()-i-18);
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const days = Array.from({length: 31}, (_,i)=> i+1);

export default function SetupDOB(){
  const nav = useNavigate();
  const [m, setM] = useState(0);
  const [d, setD] = useState(1);
  const [y, setY] = useState(years[0]);
  const [saving, setSaving] = useState(false);

  const save = async ()=>{
    setSaving(true);
    try {
      const dob = new Date(y, m, d).toISOString().slice(0,10);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("profiles").update({ dob }).eq("id", user.id).throwOnError();
      nav("/setup/gender");
    } catch(e) {
      alert(e.message || "Failed to save");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-dvh">
      <TopBar title="Your birthday" />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-3 gap-3">
          <select className="field" value={m} onChange={e=>setM(Number(e.target.value))}>
            {months.map((mm,idx)=><option key={mm} value={idx}>{mm}</option>)}
          </select>
          <select className="field" value={d} onChange={e=>setD(Number(e.target.value))}>
            {days.map(dd=><option key={dd} value={dd}>{dd}</option>)}
          </select>
          <select className="field" value={y} onChange={e=>setY(Number(e.target.value))}>
            {years.map(yy=><option key={yy} value={yy}>{yy}</option>)}
          </select>
        </div>
        <Button className="w-full" onClick={save} disabled={saving}>{saving?"Saving...":"Save"}</Button>
      </div>
    </div>
  );
}