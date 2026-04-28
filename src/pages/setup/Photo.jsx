// src/pages/setup/SetupPhoto.jsx
import { useEffect, useRef, useState } from "react";
import TopBar from "../../components/TopBar.jsx";
import Button from "../../components/Button.jsx";
import Avatar from "../../components/Avatar.jsx";
import { supabase } from "../../lib/supabase.client.js";  
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";

const MAX_MB = 10;

export default function SetupPhoto(){
  const nav = useNavigate();
  const { reloadProfile, markSetupComplete } = useAuth();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  const onPick = (e)=>{
    const f = e.target.files?.[0];
    setErr("");
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    const mb = f.size / (1024*1024);
    if (mb > MAX_MB) {
      setErr(`Image is too large (${mb.toFixed(1)}MB). Max ${MAX_MB}MB.`);
      return;
    }
    const url = URL.createObjectURL(f);
    setPreview(url);
    setFile(f);
  };

  const onUpload = async ()=>{
    if (!file) { setErr("Pick a photo first."); return; }
    setUploading(true);
    setErr("");

    let watchdog;
    const failTimeout = (label, extra)=> {
      console.error("[Photo] timeout:", label, extra || {});
      setErr("Upload timed out. Check your connection and try again.");
      setUploading(false);
    };
    
    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error("Not authenticated");

      const path = `${user.id}/${Date.now()}-${file.name}`;
      console.info("[Photo] uploading to:", { bucket: "profiles", path });

      watchdog = setTimeout(()=>failTimeout("storage.upload", { bucket:"profiles", path }), 20000);
      const { data: up, error: upErr } = await supabase.storage
        .from("profiles")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      clearTimeout(watchdog);
      if (upErr) {
        console.error("[Photo] storage.upload error:", upErr);
        throw new Error(upErr.message || "Upload failed (storage).");
      }

      const { data: pub } = supabase.storage.from("profiles").getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) {
        console.warn("[Photo] getPublicUrl returned empty; using signed URL as fallback");
        const { data: signed, error: sErr } = await supabase
          .storage.from("profiles")
          .createSignedUrl(path, 60*60*24*7);
        if (sErr) {
          console.error("[Photo] createSignedUrl error:", sErr);
          throw new Error("Could not create accessible URL for avatar.");
        }
      }

      console.info("[Photo] public URL resolved");

      console.info("[Photo] inserting into photos table…");
      const { error: photoErr } = await supabase
        .from("photos")
        .insert({ user_id: user.id, path, is_primary: true });
      if (photoErr) console.warn("[Photo] photos insert error (non-fatal):", photoErr.message);

      console.info("[Photo] updating profile avatar_url…");
      watchdog = setTimeout(()=>failTimeout("profiles.update avatar_url"), 10000);
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      clearTimeout(watchdog);
      if (profErr) {
        console.error("[Photo] profiles.update error:", profErr);
        throw new Error("Failed to save avatar (profile update blocked by RLS?).");
      }

      console.info("[Photo] verifying avatar_url saved…");
      watchdog = setTimeout(()=>failTimeout("verify avatar_url"), 8000);
      const { data: prof, error: vErr } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      clearTimeout(watchdog);
      if (vErr) {
        console.warn("[Photo] verify select error:", vErr.message);
      }
      if (!prof?.avatar_url) {
        console.error("[Photo] avatar_url missing after update; check RLS/policies");
        throw new Error("Avatar not saved. Check Storage/DB policies.");
      }

      console.info("[Photo] success; navigating → /discover");
      
      // CRITICAL FIX: Use correct flag format and reload profile
      markSetupComplete();
      await reloadProfile();
      
      setUploading(false);
      nav("/discover", { replace: true });

    } catch (e) {
      clearTimeout(watchdog);
      console.error("[Photo] upload failure:", e);
      setErr(e.message || "Upload failed.");
      setUploading(false);
    }
  };

  const skip = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // CRITICAL FIX: Maintain completion flag when skipping
        markSetupComplete();
        await reloadProfile();
      }
      nav("/discover", { replace: true });
    } catch (e) {
      console.warn("Failed to update profile on skip:", e);
      nav("/discover", { replace: true });
    }
  };

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-10 bg-white/90 px-4 pt-4 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center">
          <button
            onClick={() => nav(-1)}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <i className="lni lni-chevron-left text-lg" />
          </button>
          <div className="mx-auto">
            <h1 className="text-lg font-semibold">Add a photo</h1>
          </div>
          <button
            onClick={skip}
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            Skip
          </button>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Avatar size={82} src={preview}/>
          <div className="text-sm text-gray-600">Choose a clear face photo</div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />

        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={()=>inputRef.current?.click()} disabled={uploading}>
            <i className="lni lni-camera text-lg" /> Pick photo
          </Button>
          <Button className="flex-1" onClick={onUpload} disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Finish"}
          </Button>
        </div>

        <div className="text-xs text-gray-500">
          Tip: Max {MAX_MB}MB. Square photos with faces work best. You can add more photos later.
        </div>
      </div>
    </div>
  );
}