import { useState, useEffect } from "react";
import TopBar from "../../components/TopBar.jsx";
import TextField from "../../components/TextField.jsx";
import Button from "../../components/Button.jsx";
import { supabase } from "../../../api/lib/supabase.js";
import { useNavigate } from "react-router-dom";

export default function SetupBasics(){
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    (async ()=>{
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("display_name, city").eq("id", user.id).single();
      setName(data?.display_name || "");
      setCity(data?.city || "");
    })();
  },[]);

  const save = async ()=>{
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("profiles").update({ display_name: name, city }).eq("id", user.id).throwOnError();
      nav("/setup/dob");
    } catch(e) {
      alert(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <TopBar title="Profile: Basics"/>
      <div className="space-y-6 p-6">
        <TextField label="Display name" placeholder="Jess" value={name} onChange={e=>setName(e.target.value)}/>
        <TextField label="City" placeholder="San Diego" value={city} onChange={e=>setCity(e.target.value)}/>
        <Button className="w-full" onClick={save} disabled={!name || saving}>{saving ? "Saving..." : "Continue"}</Button>
      </div>
    </div>
  );
}