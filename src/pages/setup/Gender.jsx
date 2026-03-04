import { useState } from "react";
import TopBar from "../../components/TopBar.jsx";
import Button from "../../components/Button.jsx";
import { supabase } from "../../lib/supabase.client.js";
import { useNavigate } from "react-router-dom";

export default function SetupGender(){
  const nav = useNavigate();
  const [val, setVal] = useState(null);
  const [saving, setSaving] = useState(false);

  const Item = ({label, value})=>(
    <button
      onClick={()=>setVal(value)}
      className={`w-full rounded-xl border px-4 py-3 text-left ${val===value?"border-transparent bg-violet-600 text-white":"border-gray-200"}`}
    >
      {label}
    </button>
  );

  const save = async ()=>{
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("profiles").update({ gender: val }).eq("id", user.id).throwOnError();
      nav("/setup/interests");
    } catch(e) { alert(e.message || "Failed to save"); } finally { setSaving(false); }
  };

  return (
    <div className="min-h-dvh">
      <TopBar title="I am a" />
      <div className="space-y-4 p-6">
        <Item label="Woman" value="woman"/>
        <Item label="Man" value="man"/>
        <Item label="Non-binary" value="nonbinary"/>
        <Item label="Other" value="other"/>
        <Button className="mt-2 w-full" disabled={!val || saving} onClick={save}>{saving?"Saving...":"Continue"}</Button>
      </div>
    </div>
  );
}