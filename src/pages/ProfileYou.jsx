import React, { useEffect, useMemo, useRef, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import TextField from "../components/TextField.jsx";
import Tag from "../components/Tag.jsx";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

// Skeletons
const Sk = {
  block: ({ className = "" }) => <div className={`animate-pulse rounded bg-gray-200 ${className}`} />,
  line: ({ w = "w-40", h = "h-4", className = "" }) => <div className={`animate-pulse rounded ${w} ${h} bg-gray-200 ${className}`} />,
  chip: () => <div className="animate-pulse rounded-full bg-gray-200 h-6 w-20" />,
  tile: ({ ratio = "aspect-square" }) => <div className={`animate-pulse rounded-xl bg-gray-200 ${ratio}`} />,
};

const sanitizeName = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, "-");

export default function ProfileYou(){
  const { profile: me, reloadProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [profession, setProfession] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  // Interests
  const [allInterests, setAllInterests] = useState([]);
  const [picked, setPicked] = useState([]); // labels

  // Photos
  const [heroUrl, setHeroUrl] = useState(null);
  const [gallery, setGallery] = useState([]); // grid URLs (hero excluded)
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // Load my profile + interests + photos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr("");
        // Fresh profile (private)
        const { data: p, error: e1 } = await supabase
          .from("profiles")
          .select("id, display_name, profession, bio, city, avatar_url, lat, lng")
          .eq("id", me?.id)
          .maybeSingle();
        if (e1) throw e1;

        // Interest catalog
        const { data: cat } = await supabase
          .from("interests")
          .select("id,label")
          .order("label", { ascending: true });

        // My picks
        const { data: mine } = await supabase
          .from("user_interests")
          .select("interests:interests(label)")
          .eq("user_id", me?.id);

        // Photos
        const { data: photos } = await supabase
          .from("photos")
          .select("path, is_primary, sort, created_at")
          .eq("user_id", me?.id)
          .order("is_primary", { ascending: false })
          .order("sort", { ascending: true })
          .order("created_at", { ascending: true });

        if (cancelled) return;

        setDisplayName(p?.display_name || "");
        setProfession(p?.profession || "");
        setCity(p?.city || "");
        setBio(p?.bio || "");

        setAllInterests(cat || []);
        setPicked((mine || []).map(r => r.interests?.label).filter(Boolean));

        // Dedup photos by path, pick hero, exclude from grid
        const byPath = new Map();
        for (const ph of photos || []) if (!byPath.has(ph.path)) byPath.set(ph.path, ph);
        const unique = Array.from(byPath.values());

        const primary = unique.find(ph => ph.is_primary) || unique[0];
        const toUrl = (path) => supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;
        const hero = primary?.path ? toUrl(primary.path) : (p?.avatar_url || null);
        const rest = unique.filter(ph => ph.path !== primary?.path).map(ph => toUrl(ph.path)).filter(Boolean);

        setHeroUrl(hero);
        setGallery(rest);
      } catch (e) {
        console.error("[ProfileYou] load error:", e);
        setErr(e.message || "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [me?.id]);

  // Save profile core fields
  const saveProfile = async () => {
    setSaving(true); setErr("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          profession: profession.trim() || null,
          city: city.trim(),
          bio: bio.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", me?.id);
      if (error) throw error;
      await reloadProfile();
    } catch (e) {
      console.error("[ProfileYou] save error:", e);
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Use current location
  const setMyLocation = async () => {
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const { latitude, longitude } = pos.coords;
      const { error } = await supabase.from("profiles").update({ lat: latitude, lng: longitude }).eq("id", me?.id);
      if (error) throw error;
      await reloadProfile();
      alert("Location saved");
    } catch (e) {
      alert(e.message || "Could not set location");
    }
  };

  // Interests toggle + save
  const toggleInterest = (label) => {
    setPicked((prev) => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  const saveInterests = async () => {
    try {
      const { data: cat } = await supabase.from("interests").select("id,label");
      const idByLabel = Object.fromEntries((cat || []).map(i => [String(i.label).toLowerCase(), i.id]));
      const ids = picked.map(l => idByLabel[String(l).toLowerCase()]).filter(Boolean);

      await supabase.from("user_interests").delete().eq("user_id", me?.id);
      if (ids.length) {
        const rows = ids.map(id => ({ user_id: me?.id, interest_id: id }));
        const { error } = await supabase.from("user_interests").insert(rows);
        if (error) throw error;
      }
      alert("Interests saved");
    } catch (e) {
      console.error("[ProfileYou] save interests error:", e);
      alert(e.message || "Failed to save interests");
    }
  };

  // Photos: add
  const onPickFiles = () => fileRef.current?.click();

  const uploadFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true); setErr("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newUrls = [];
      for (const f of files) {
        const path = `${user.id}/${Date.now()}-${sanitizeName(f.name)}`;
        const up = await supabase.storage.from("profiles").upload(path, f, { upsert: false });
        if (up.error) throw up.error;

        // insert photo row
        const ins = await supabase.from("photos").insert({ user_id: user.id, path, is_primary: false }).select("*").single();
        if (ins.error) throw ins.error;

        // build URL
        const url = supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;
        if (url) newUrls.push({ path, url });
      }

      // If no hero yet, make first new one primary + update avatar_url
      if (!heroUrl && newUrls.length) {
        const primaryPath = newUrls[0].path;
        await setPrimaryByPath(primaryPath, { silent: true });
      }

      // merge into grid (hero remains as-is unless set primary above)
      setGallery((prev) => {
        const seen = new Set(prev);
        const toAdd = newUrls.map(n => n.url).filter(u => u && !seen.has(u));
        return [...prev, ...toAdd];
      });

      alert("Photos uploaded");
    } catch (e) {
      console.error("[ProfileYou] upload error:", e);
      setErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const setPrimaryByPath = async (path, { silent } = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // set all to false
      await supabase.from("photos").update({ is_primary: false }).eq("user_id", user.id);
      // set selected to true
      const { data: ph, error } = await supabase.from("photos").update({ is_primary: true }).eq("user_id", user.id).eq("path", path).select("*").single();
      if (error) throw error;
      // update profiles.avatar_url
      const url = supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      setHeroUrl(url);
      // also remove from grid if present
      setGallery((prev) => prev.filter(u => u !== url));
      if (!silent) alert("Primary photo set");
    } catch (e) {
      console.error("[ProfileYou] set primary error:", e);
      if (!silent) alert(e.message || "Failed to set primary");
    }
  };

  const deleteByPath = async (path) => {
    try {
      const url = supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;
      // delete storage
      const rm = await supabase.storage.from("profiles").remove([path]);
      if (rm.error) throw rm.error;
      // delete row
      const del = await supabase.from("photos").delete().eq("path", path).eq("user_id", me?.id);
      if (del.error) throw del.error;

      // update UI
      if (url && url === heroUrl) {
        setHeroUrl(null);
        await supabase.from("profiles").update({ avatar_url: null }).eq("id", me?.id);
      } else {
        setGallery((prev) => prev.filter(u => u !== url));
      }
      alert("Photo deleted");
    } catch (e) {
      console.error("[ProfileYou] delete photo error:", e);
      alert(e.message || "Failed to delete photo");
    }
  };

  return (
    <div className="min-h-dvh bg-white">
      <TopBar title="Your profile" />
      {/* Hero */}
      <div className="relative h-[32vh] w-full overflow-hidden">
        {loading ? (
          <Sk.block className="h-full w-full" />
        ) : heroUrl ? (
          <img src={heroUrl} alt="Hero" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gray-100 text-gray-400">No photo</div>
        )}

        {/* Edit actions on hero */}
        <div className="absolute bottom-3 right-3 flex gap-2">
          <button onClick={onPickFiles} className="rounded-full bg-white/90 px-3 py-2 text-sm text-gray-800 shadow-card">
            <i className="lni lni-camera mr-1" /> Add photos
          </button>
          {heroUrl && (
            <button className="rounded-full bg-white/90 px-3 py-2 text-sm text-gray-800 shadow-card" onClick={() => window.open(heroUrl, "_blank")}>
              View
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e)=>uploadFiles(Array.from(e.target.files||[]))} className="hidden" />
      </div>

      {/* Content */}
      <div className="space-y-8 p-5">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

        {/* Basic info */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="text-sm font-semibold">Basics</h2>
          <div className="mt-3 grid grid-cols-1 gap-3">
            {loading ? (
              <>
                <Sk.line w="w-64" h="h-10" />
                <Sk.line w="w-64" h="h-10" />
                <Sk.line w="w-64" h="h-10" />
              </>
            ) : (
              <>
                <TextField label="Display name" placeholder="Your name" value={displayName} onChange={(e)=>setDisplayName(e.target.value)} />
                <TextField label="Profession" placeholder="What do you do?" value={profession} onChange={(e)=>setProfession(e.target.value)} />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <TextField label="City" placeholder="City, Country" value={city} onChange={(e)=>setCity(e.target.value)} />
                  <button onClick={setMyLocation} className="self-end rounded-lg border border-gray-200 px-3 py-2 text-sm text-violet-700">
                    <i className="lni lni-map-marker" /> Use location
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="mt-3">
            <label className="text-sm font-semibold">About</label>
            {loading ? (
              <div className="mt-2 space-y-2">
                <Sk.line w="w-full" />
                <Sk.line w="w-5/6" />
                <Sk.line w="w-2/3" />
              </div>
            ) : (
              <textarea
                rows={5}
                value={bio}
                onChange={(e)=>setBio(e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                placeholder="Tell people about yourself (optional)"
              />
            )}
          </div>
          <div className="mt-4">
            <Button className="w-full" disabled={saving || loading} onClick={saveProfile}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </section>

        {/* Interests */}
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Interests</h2>
            <span className="text-xs text-gray-500">{picked.length} selected</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {loading && !allInterests.length
              ? Array.from({ length: 8 }).map((_, i) => <Sk.chip key={i} />)
              : (allInterests || []).map((i) => (
                  <Tag key={i.id} label={i.label} active={picked.includes(i.label)} onClick={()=>toggleInterest(i.label)} />
                ))}
          </div>
          <div className="mt-4">
            <Button className="w-full" onClick={saveInterests} disabled={loading}>
              Save interests
            </Button>
          </div>
        </section>

        {/* Gallery grid (hero excluded, no duplicates) */}
        {loading ? (
          <section className="rounded-2xl bg-white p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <Sk.line w="w-24" />
              <Sk.line w="w-12" />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <Sk.tile ratio="aspect-[4/5]" />
              <Sk.tile ratio="aspect-[4/5]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Sk.tile /><Sk.tile /><Sk.tile />
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Gallery</h2>
              <button onClick={onPickFiles} className="text-sm font-medium text-violet-700" disabled={uploading}>
                <i className="lni lni-plus" /> {uploading ? "Uploading…" : "Add"}
              </button>
            </div>

            {!gallery.length ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                No gallery photos yet. Use “Add” to upload more.
              </div>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  {gallery.slice(0, 2).map((src, i) => (
                    <div key={`g-top-${i}`} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-100">
                      <img src={src} alt={`Gallery ${i+1}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 hidden items-end justify-between gap-2 p-2 group-hover:flex">
                        <button onClick={()=>setPrimaryFromUrl(src)} className="rounded-lg bg-white/90 px-2 py-1 text-xs text-gray-800 shadow-card">
                          Make primary
                        </button>
                        <button onClick={()=>deleteFromUrl(src)} className="rounded-lg bg-white/90 px-2 py-1 text-xs text-red-600 shadow-card">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {gallery.length > 2 && (
                  <div className="grid grid-cols-3 gap-3">
                    {gallery.slice(2, 11).map((src, i) => (
                      <div key={`g-bot-${i}`} className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                        <img src={src} alt={`Gallery ${i+3}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 hidden items-end justify-between gap-2 p-2 group-hover:flex">
                          <button onClick={()=>setPrimaryFromUrl(src)} className="rounded-lg bg-white/90 px-2 py-1 text-xs text-gray-800 shadow-card">
                            Make primary
                          </button>
                          <button onClick={()=>deleteFromUrl(src)} className="rounded-lg bg-white/90 px-2 py-1 text-xs text-red-600 shadow-card">
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );

  // Helpers mapping URL back to path for primary/delete
  function urlToPath(url) {
    // Your public URL likely ends with /object/public/profiles/<path> or /profiles/<path>
    // Easiest: find suffix after /profiles/
    const idx = url.lastIndexOf("/profiles/");
    if (idx === -1) return null;
    return url.slice(idx + "/profiles/".length);
  }
  async function setPrimaryFromUrl(url) {
    const path = urlToPath(url);
    if (!path) return alert("Cannot resolve path for this image");
    await setPrimaryByPath(path);
  }
  async function deleteFromUrl(url) {
    const path = urlToPath(url);
    if (!path) return alert("Cannot resolve path for this image");
    await deleteByPath(path);
  }
}