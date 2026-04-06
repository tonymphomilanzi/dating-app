// src/pages/ProfileYou.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

// Supabase read timeout helper (prevents stuck loading)
const withSupaTimeout = async (promise, ms, label = "timeout") => {
  let t;
  try {
    const out = await Promise.race([
      promise,
      new Promise((_, rej) => (t = setTimeout(() => rej(new Error(`${label}:${ms}`)), ms))),
    ]);
    return out; // { data, error }
  } finally {
    clearTimeout(t);
  }
};

export default function ProfileYou() {
  const { profile: me, reloadProfile } = useAuth();

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Logout
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    if (!confirm("Log out of this device?")) return;
    try {
      setLoggingOut(true);
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      window.location.assign("/auth");
    } catch (e) {
      console.error("[ProfileYou] logout error:", e);
      alert(e.message || "Failed to log out");
    } finally {
      setLoggingOut(false);
    }
  };

  // Editable fields
  const [displayName, setDisplayName] = useState("");
  const [profession, setProfession] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  // Interests
  const [allInterests, setAllInterests] = useState([]);
  const [picked, setPicked] = useState([]); // labels
  const [savingInterests, setSavingInterests] = useState(false);

  // Photos
  const [heroUrl, setHeroUrl] = useState(null);
  const [gallery, setGallery] = useState([]); // grid URLs (hero excluded)
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // Geolocation
  const [locating, setLocating] = useState(false);

  // Race guard
  const reqIdRef = useRef(0);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Load my profile + interests + photos
  useEffect(() => {
    let cancelled = false;
    const rid = ++reqIdRef.current;

    (async () => {
      try {
        setErr("");
        // Fresh profile (private)
        const { data: p, error: e1 } = await withSupaTimeout(
          supabase
            .from("profiles")
            .select("id, display_name, profession, bio, city, avatar_url, lat, lng")
            .eq("id", me?.id)
            .maybeSingle(),
          9000,
          "profile"
        );
        if (e1) throw e1;

        // Interest catalog
        const { data: cat } = await withSupaTimeout(
          supabase
            .from("interests")
            .select("id,label")
            .order("label", { ascending: true }),
          9000,
          "interests"
        );

        // My picks
        const { data: mine } = await withSupaTimeout(
          supabase
            .from("user_interests")
            .select("interests:interests(label)")
            .eq("user_id", me?.id),
          9000,
          "user_interests"
        );

        // Photos
        const { data: photos } = await withSupaTimeout(
          supabase
            .from("photos")
            .select("path, is_primary, sort, created_at")
            .eq("user_id", me?.id)
            .order("is_primary", { ascending: false })
            .order("sort", { ascending: true })
            .order("created_at", { ascending: true }),
          9000,
          "photos"
        );

        if (cancelled || reqIdRef.current !== rid || !isMountedRef.current) return;

        setDisplayName(p?.display_name || "");
        setProfession(p?.profession || "");
        setCity(p?.city || "");
        setBio(p?.bio || "");

        setAllInterests(cat || []);
        setPicked((mine || []).map((r) => r.interests?.label).filter(Boolean));

        // Dedup photos by path, pick hero, exclude from grid
        const byPath = new Map();
        for (const ph of photos || []) if (!byPath.has(ph.path)) byPath.set(ph.path, ph);
        const unique = Array.from(byPath.values());

        const primary = unique.find((ph) => ph.is_primary) || unique[0];
        const toUrl = (path) => supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;
        const hero = primary?.path ? toUrl(primary.path) : (p?.avatar_url || null);
        const rest = unique
          .filter((ph) => ph.path !== primary?.path)
          .map((ph) => toUrl(ph.path))
          .filter(Boolean);

        setHeroUrl(hero);
        setGallery(rest);
      } catch (e) {
        console.error("[ProfileYou] load error:", e);
        if (reqIdRef.current === rid) setErr(e.message || "Failed to load profile");
      } finally {
        if (!cancelled && reqIdRef.current === rid && isMountedRef.current) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [me?.id]);

  // Completeness (Tinder-like: show progress + hints)
  const completeness = useMemo(() => {
    let score = 0;
    const hints = [];

    if (displayName?.trim()) score += 25; else hints.push("Add your name");
    if (heroUrl) score += 25; else hints.push("Add a primary photo");
    if (picked.length >= 3) score += 25; else hints.push("Pick at least 3 interests");
    if (bio?.trim()) score += 10; else hints.push("Write a short bio");
    if (city?.trim()) score += 15; else hints.push("Set your city");

    if (score > 100) score = 100;
    return { score, hints };
  }, [displayName, heroUrl, picked.length, bio, city]);

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
    setLocating(true);
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
      });
      const { latitude, longitude } = pos.coords;
      const { error } = await supabase.from("profiles").update({ lat: latitude, lng: longitude }).eq("id", me?.id);
      if (error) throw error;
      await reloadProfile();
      alert("Location saved");
    } catch (e) {
      alert(e.message || "Could not set location");
    } finally {
      setLocating(false);
    }
  };

  // Interests toggle + save
  const toggleInterest = (label) => {
    setPicked((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  };

  const saveInterests = async () => {
    setSavingInterests(true);
    try {
      const { data: cat } = await supabase.from("interests").select("id,label");
      const idByLabel = Object.fromEntries((cat || []).map((i) => [String(i.label).toLowerCase(), i.id]));
      const ids = picked.map((l) => idByLabel[String(l).toLowerCase()]).filter(Boolean);

      await supabase.from("user_interests").delete().eq("user_id", me?.id);
      if (ids.length) {
        const rows = ids.map((id) => ({ user_id: me?.id, interest_id: id }));
        const { error } = await supabase.from("user_interests").insert(rows);
        if (error) throw error;
      }
      alert("Interests saved");
    } catch (e) {
      console.error("[ProfileYou] save interests error:", e);
      alert(e.message || "Failed to save interests");
    } finally {
      setSavingInterests(false);
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

      // merge into grid
      setGallery((prev) => {
        const seen = new Set(prev);
        const toAdd = newUrls.map((n) => n.url).filter((u) => u && !seen.has(u));
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
      await supabase.from("photos").update({ is_primary: false }).eq("user_id", user.id);
      const { data: ph, error } = await supabase
        .from("photos")
        .update({ is_primary: true })
        .eq("user_id", user.id)
        .eq("path", path)
        .select("*")
        .single();
      if (error) throw error;

      const url = supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      setHeroUrl(url);
      setGallery((prev) => prev.filter((u) => u !== url));
      if (!silent) alert("Primary photo set");
    } catch (e) {
      console.error("[ProfileYou] set primary error:", e);
      if (!silent) alert(e.message || "Failed to set primary");
    }
  };

  const deleteByPath = async (path) => {
    try {
      const url = supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;
      const rm = await supabase.storage.from("profiles").remove([path]);
      if (rm.error) throw rm.error;

      const del = await supabase.from("photos").delete().eq("path", path).eq("user_id", me?.id);
      if (del.error) throw del.error;

      if (url && url === heroUrl) {
        setHeroUrl(null);
        await supabase.from("profiles").update({ avatar_url: null }).eq("id", me?.id);
      } else {
        setGallery((prev) => prev.filter((u) => u !== url));
      }
      alert("Photo deleted");
    } catch (e) {
      console.error("[ProfileYou] delete photo error:", e);
      alert(e.message || "Failed to delete photo");
    }
  };

  // Helpers mapping URL back to path for primary/delete
  function urlToPath(url) {
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

  // Tinder-ish gradient header styling + preview
  const previewProfile = useCallback(() => {
    if (!me?.id) return;
    window.open(`/profile/${me.id}`, "_self");
  }, [me?.id]);

  return (
    <div className="min-h-dvh bg-white">
      <TopBar title="" />

      {/* Hero - Tinder-like gradient strap with photo */}
      <div className="relative h-[36vh] w-full overflow-hidden">
        {/* background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-200 via-pink-200 to-violet-200" />

        {/* photo */}
        {loading ? (
          <Sk.block className="absolute inset-0" />
        ) : heroUrl ? (
          <img src={heroUrl} alt="Hero" className="absolute inset-0 h-full w-full object-cover mix-blend-multiply" draggable={false} />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-fuchsia-600/60">No photo</div>
        )}

        {/* overlay scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

        {/* Top actions */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <div className="rounded-full bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-sm ring-1 ring-white/10">
            My Profile
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={previewProfile}
              className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm ring-1 ring-white/10"
              title="Preview"
            >
              <i className="lni lni-eye" /> Preview
            </button>
            <button
              onClick={onPickFiles}
              className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-900 shadow-card hover:bg-white"
              title="Add photos"
            >
              <i className="lni lni-camera mr-1" /> Add photos
            </button>
          </div>
        </div>

        {/* name & progress */}
        <div className="absolute bottom-4 left-4 right-4 text-white drop-shadow">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">{displayName || "Your name"}</div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full bg-white/90"
                  style={{ width: `${completeness.score}%`, transition: "width 300ms ease" }}
                />
              </div>
              <span className="text-xs font-medium">{completeness.score}%</span>
            </div>
          </div>
          {completeness.hints.length > 0 && (
            <div className="mt-1 text-[11px] opacity-90">
              {completeness.hints.slice(0, 2).join(" • ")}
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
          className="hidden"
        />
      </div>

      {/* Content */}
      <div className="space-y-8 -mt-5 p-5">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

        {/* Basics - card */}
        <section className="relative rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(124,58,237,0.08)] ring-1 ring-gray-100">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Basics</h2>
            <span className="text-[11px] text-gray-500">{saving ? "Saving…" : ""}</span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3">
            {loading ? (
              <>
                <Sk.line w="w-64" h="h-10" />
                <Sk.line w="w-64" h="h-10" />
                <Sk.line w="w-64" h="h-10" />
              </>
            ) : (
              <>
                <TextField
                  label="Display name"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <TextField
                  label="Profession"
                  placeholder="What do you do?"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <TextField
                    label="City"
                    placeholder="City, Country"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  <button
                    onClick={setMyLocation}
                    disabled={locating}
                    className="self-end rounded-xl border border-gray-200 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                  >
                    <i className="lni lni-map-marker" /> {locating ? "Locating…" : "Use location"}
                  </button>
                </div>
                <div className="mt-1">
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
                      onChange={(e) => setBio(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                      placeholder="Tell people about yourself"
                    />
                  )}
                </div>
              </>
            )}
          </div>
          <div className="mt-4">
            <Button className="w-full !bg-gradient-to-r !from-fuchsia-600 !to-violet-600" disabled={saving || loading} onClick={saveProfile}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </section>

        {/* Interests - pills like Tinder */}
        <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(124,58,237,0.08)] ring-1 ring-gray-100">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Interests</h2>
            <span className="text-xs text-gray-500">{picked.length} selected</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {loading && !allInterests.length
              ? Array.from({ length: 10 }).map((_, i) => <Sk.chip key={i} />)
              : (allInterests || []).map((i) => (
                  <Tag
                    key={i.id}
                    label={i.label}
                    active={picked.includes(i.label)}
                    onClick={() => toggleInterest(i.label)}
                  />
                ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button className="flex-1" onClick={saveInterests} disabled={loading || savingInterests}>
              {savingInterests ? "Saving…" : "Save interests"}
            </Button>
            <span className="text-[11px] text-gray-500">Tip: choose 3+ to stand out</span>
          </div>
        </section>

        {/* Gallery grid (Tinder-like tiles, hero excluded, actions on hover) */}
        <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(124,58,237,0.08)] ring-1 ring-gray-100">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Gallery</h2>
            <button onClick={onPickFiles} className="text-sm font-medium text-violet-700" disabled={uploading}>
              <i className="lni lni-plus" /> {uploading ? "Uploading…" : "Add"}
            </button>
          </div>

          {loading ? (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <Sk.tile ratio="aspect-[4/5]" />
                <Sk.tile ratio="aspect-[4/5]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Sk.tile /> <Sk.tile /> <Sk.tile />
              </div>
            </>
          ) : !gallery.length ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
              No gallery photos yet. Use “Add” to upload more.
            </div>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3">
                {gallery.slice(0, 2).map((src, i) => (
                  <div key={`g-top-${i}`} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-100">
                    <img src={src} alt={`Gallery ${i + 1}`} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-end justify-between gap-2 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => setPrimaryFromUrl(src)}
                        className="rounded-lg bg-white/90 px-2 py-1 text-xs text-gray-800 shadow-card"
                      >
                        Make primary
                      </button>
                      <button
                        onClick={() => deleteFromUrl(src)}
                        className="rounded-lg bg-white/90 px-2 py-1 text-xs text-red-600 shadow-card"
                      >
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
                      <img src={src} alt={`Gallery ${i + 3}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-end justify-between gap-2 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => setPrimaryFromUrl(src)}
                          className="rounded-lg bg-white/90 px-2 py-1 text-xs text-gray-800 shadow-card"
                        >
                          Make primary
                        </button>
                        <button
                          onClick={() => deleteFromUrl(src)}
                          className="rounded-lg bg-white/90 px-2 py-1 text-xs text-red-600 shadow-card"
                        >
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

        {/* Account */}
        <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(124,58,237,0.08)] ring-1 ring-gray-100">
          <h2 className="mb-3 text-sm font-semibold">Account</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="w-full"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <i className="lni lni-exit mr-1" />
              {loggingOut ? "Logging out…" : "Log out"}
            </Button>
            <Button
              className="w-full !bg-white !text-gray-800 border border-gray-200 hover:!bg-gray-50"
              onClick={previewProfile}
            >
              <i className="lni lni-eye mr-1" />
              Preview profile
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}