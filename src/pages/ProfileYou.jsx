// src/pages/ProfileYou.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import TextField from "../components/TextField.jsx";
import Tag from "../components/Tag.jsx";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

// ── Skeletons ────────────────────────────────────────────────────────────────
const Sk = {
  block: ({ className = "" }) => (
    <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
  ),
  line: ({ w = "w-40", h = "h-4", className = "" }) => (
    <div className={`animate-pulse rounded ${w} ${h} bg-gray-200 ${className}`} />
  ),
  chip: () => <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />,
  tile: ({ ratio = "aspect-square" }) => (
    <div className={`animate-pulse rounded-xl bg-gray-200 ${ratio}`} />
  ),
};

const sanitizeName = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, "-");

// Supabase read timeout (prevents stuck loading spinners)
const withTimeout = (promise, ms, label = "timeout") => {
  let timer;
  const race = Promise.race([
    promise,
    new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
  return race.finally(() => clearTimeout(timer));
};

export default function ProfileYou() {
  const nav = useNavigate();
  const { profile: me, user, signOut, reloadProfile } = useAuth();

  // ── UI state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  // ── Logout ────────────────────────────────────────────────────────────────
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (!confirm("Log out of this device?")) return;
    try {
      setLoggingOut(true);
      await signOut(); // uses AuthContext — clears state + localStorage + supabase
      nav("/auth", { replace: true });
    } catch (e) {
      console.error("[ProfileYou] logout error:", e);
      setErr(e.message || "Failed to log out");
    } finally {
      setLoggingOut(false);
    }
  };

  // ── Editable fields ───────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [profession, setProfession] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  // ── Interests ─────────────────────────────────────────────────────────────
  const [allInterests, setAllInterests] = useState([]);
  const [picked, setPicked] = useState([]);
  const [savingInterests, setSavingInterests] = useState(false);

  // ── Photos ────────────────────────────────────────────────────────────────
  const [heroUrl, setHeroUrl] = useState(null);
  const [gallery, setGallery] = useState([]);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // ── Geolocation ───────────────────────────────────────────────────────────
  const [locating, setLocating] = useState(false);

  // ── Race guard ────────────────────────────────────────────────────────────
  const reqIdRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? "" : t)), 3000);
  }, []);

  // ── Load profile + interests + photos ─────────────────────────────────────
  useEffect(() => {
    if (!me?.id) {
      // No profile yet — stop loading so page isn't stuck on spinner
      setLoading(false);
      return;
    }

    let cancelled = false;
    const rid = ++reqIdRef.current;

    (async () => {
      try {
        setErr("");

        // Fresh profile row (private fields)
        const { data: p, error: e1 } = await withTimeout(
          supabase
            .from("profiles")
            .select("id, display_name, profession, bio, city, avatar_url, lat, lng")
            .eq("id", me.id)
            .maybeSingle(),
          10000,
          "profile"
        );
        if (e1) throw e1;

        // Interest catalog
        const { data: cat } = await withTimeout(
          supabase.from("interests").select("id,label").order("label", { ascending: true }),
          10000,
          "interests"
        );

        // User's current picks
        const { data: mine } = await withTimeout(
          supabase
            .from("user_interests")
            .select("interests:interests(label)")
            .eq("user_id", me.id),
          10000,
          "user_interests"
        );

        // Photos
        const { data: photos } = await withTimeout(
          supabase
            .from("photos")
            .select("path, is_primary, sort, created_at")
            .eq("user_id", me.id)
            .order("is_primary", { ascending: false })
            .order("sort", { ascending: true })
            .order("created_at", { ascending: true }),
          10000,
          "photos"
        );

        if (cancelled || reqIdRef.current !== rid || !mountedRef.current) return;

        // Fill editable fields
        setDisplayName(p?.display_name || "");
        setProfession(p?.profession || "");
        setCity(p?.city || "");
        setBio(p?.bio || "");

        // Interests
        setAllInterests(cat || []);
        setPicked((mine || []).map((r) => r.interests?.label).filter(Boolean));

        // Dedup photos by path
        const byPath = new Map();
        for (const ph of photos || []) {
          if (!byPath.has(ph.path)) byPath.set(ph.path, ph);
        }
        const unique = Array.from(byPath.values());

        const toUrl = (path) =>
          supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;

        const primary = unique.find((ph) => ph.is_primary) || unique[0];
        const hero = primary?.path ? toUrl(primary.path) : p?.avatar_url || null;
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
        if (!cancelled && reqIdRef.current === rid && mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me?.id]);

  // ── Completeness ──────────────────────────────────────────────────────────
  const completeness = useMemo(() => {
    let score = 0;
    const hints = [];

    if (displayName?.trim()) score += 25;
    else hints.push("Add your name");

    if (heroUrl) score += 25;
    else hints.push("Add a primary photo");

    if (picked.length >= 3) score += 25;
    else hints.push("Pick at least 3 interests");

    if (bio?.trim()) score += 10;
    else hints.push("Write a short bio");

    if (city?.trim()) score += 15;
    else hints.push("Set your city");

    return { score: Math.min(score, 100), hints };
  }, [displayName, heroUrl, picked.length, bio, city]);

  // ── Save profile fields ───────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!me?.id) return;
    setSaving(true);
    setErr("");
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
        .eq("id", me.id);
      if (error) throw error;
      await reloadProfile();
      showToast("Profile saved ✓");
    } catch (e) {
      console.error("[ProfileYou] save error:", e);
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Geolocation ───────────────────────────────────────────────────────────
  const setMyLocation = async () => {
    if (!me?.id) return;
    setLocating(true);
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        });
      });
      const { latitude, longitude } = pos.coords;
      const { error } = await supabase
        .from("profiles")
        .update({ lat: latitude, lng: longitude })
        .eq("id", me.id);
      if (error) throw error;
      await reloadProfile();
      showToast("Location updated ✓");
    } catch (e) {
      setErr(e.message || "Could not set location");
    } finally {
      setLocating(false);
    }
  };

  // ── Interests ─────────────────────────────────────────────────────────────
  const toggleInterest = (label) =>
    setPicked((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );

  const saveInterests = async () => {
    if (!me?.id) return;
    setSavingInterests(true);
    try {
      const { data: cat } = await supabase.from("interests").select("id,label");
      const idByLabel = Object.fromEntries(
        (cat || []).map((i) => [String(i.label).toLowerCase(), i.id])
      );
      const ids = picked
        .map((l) => idByLabel[String(l).toLowerCase()])
        .filter(Boolean);

      // Replace all in one go
      const { error: delErr } = await supabase
        .from("user_interests")
        .delete()
        .eq("user_id", me.id);
      if (delErr) throw delErr;

      if (ids.length) {
        const { error: insErr } = await supabase
          .from("user_interests")
          .insert(ids.map((id) => ({ user_id: me.id, interest_id: id })));
        if (insErr) throw insErr;
      }
      showToast("Interests saved ✓");
    } catch (e) {
      console.error("[ProfileYou] save interests error:", e);
      setErr(e.message || "Failed to save interests");
    } finally {
      setSavingInterests(false);
    }
  };

  // ── Photos ────────────────────────────────────────────────────────────────
  const onPickFiles = () => fileRef.current?.click();

  const uploadFiles = async (files) => {
    if (!files?.length || !user?.id) return;
    setUploading(true);
    setErr("");
    try {
      const newEntries = []; // { path, url }

      for (const f of files) {
        const path = `${user.id}/${Date.now()}-${sanitizeName(f.name)}`;
        const up = await supabase.storage.from("profiles").upload(path, f, { upsert: false });
        if (up.error) throw up.error;

        const { error: insErr } = await supabase
          .from("photos")
          .insert({ user_id: user.id, path, is_primary: false });
        if (insErr) throw insErr;

        const url = supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;
        if (url) newEntries.push({ path, url });
      }

      // If no hero yet, promote first upload to primary
      if (!heroUrl && newEntries.length) {
        await makePrimaryByPath(newEntries[0].path, { silent: true });
      }

      // Add to gallery
      setGallery((prev) => {
        const existing = new Set(prev);
        return [...prev, ...newEntries.map((n) => n.url).filter((u) => !existing.has(u))];
      });

      showToast(`${newEntries.length} photo${newEntries.length > 1 ? "s" : ""} uploaded ✓`);
    } catch (e) {
      console.error("[ProfileYou] upload error:", e);
      setErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
      // Reset file input so re-selecting the same file fires onChange
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const makePrimaryByPath = async (path, { silent } = {}) => {
    if (!user?.id) return;
    try {
      // Demote all, then promote the chosen one
      await supabase
        .from("photos")
        .update({ is_primary: false })
        .eq("user_id", user.id);

      const { error } = await supabase
        .from("photos")
        .update({ is_primary: true })
        .eq("user_id", user.id)
        .eq("path", path);
      if (error) throw error;

      const url =
        supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;

      // Sync avatar_url on profile row
      await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);

      setHeroUrl(url);
      setGallery((prev) => prev.filter((u) => u !== url));

      if (!silent) showToast("Primary photo updated ✓");
    } catch (e) {
      console.error("[ProfileYou] set primary error:", e);
      if (!silent) setErr(e.message || "Failed to set primary");
    }
  };

  const deleteByPath = async (path) => {
    if (!me?.id) return;
    try {
      const { error: storErr } = await supabase.storage.from("profiles").remove([path]);
      if (storErr) throw storErr;

      const { error: dbErr } = await supabase
        .from("photos")
        .delete()
        .eq("path", path)
        .eq("user_id", me.id);
      if (dbErr) throw dbErr;

      const url =
        supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;

      if (url === heroUrl) {
        setHeroUrl(null);
        await supabase
          .from("profiles")
          .update({ avatar_url: null })
          .eq("id", me.id);
      } else {
        setGallery((prev) => prev.filter((u) => u !== url));
      }
      showToast("Photo deleted ✓");
    } catch (e) {
      console.error("[ProfileYou] delete photo error:", e);
      setErr(e.message || "Failed to delete photo");
    }
  };

  // ── URL → path helpers ────────────────────────────────────────────────────
  const urlToPath = (url) => {
    // Public URL looks like …/storage/v1/object/public/profiles/{userId}/{file}
    const marker = "/public/profiles/";
    const idx = url.lastIndexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  };

  const setPrimaryFromUrl = async (url) => {
    const path = urlToPath(url);
    if (!path) return setErr("Cannot resolve image path");
    await makePrimaryByPath(path);
  };

  const deleteFromUrl = async (url) => {
    const path = urlToPath(url);
    if (!path) return setErr("Cannot resolve image path");
    await deleteByPath(path);
  };

  // ── Preview ───────────────────────────────────────────────────────────────
  const previewProfile = useCallback(() => {
    if (me?.id) nav(`/profile/${me.id}`);
  }, [me?.id, nav]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-white">
      <TopBar title="" />

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 animate-[fadeSlide_300ms_ease] rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* ── Hero strap ────────────────────────────────────────────────────── */}
      <div className="relative h-[36vh] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-200 via-pink-200 to-violet-200" />

        {loading ? (
          <Sk.block className="absolute inset-0" />
        ) : heroUrl ? (
          <img
            src={heroUrl}
            alt="Hero"
            className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-fuchsia-600/60">
            <div className="flex flex-col items-center gap-2">
              <i className="lni lni-image text-4xl" />
              <span className="text-sm">No photo yet</span>
            </div>
          </div>
        )}

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

        {/* Name + progress */}
        <div className="absolute bottom-4 left-4 right-4 text-white drop-shadow">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">{displayName || "Your name"}</div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-white/90 transition-[width] duration-300"
                  style={{ width: `${completeness.score}%` }}
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

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="-mt-5 space-y-8 p-5">
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        {/* ── Basics card ─────────────────────────────────────────────────── */}
        <section className="relative rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(124,58,237,0.08)] ring-1 ring-gray-100">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Basics</h2>
            {saving && <span className="text-[11px] text-violet-600">Saving…</span>}
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
                    className="self-end rounded-xl border border-gray-200 px-3 py-2 text-sm text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
                  >
                    <i className="lni lni-map-marker" />{" "}
                    {locating ? "Locating…" : "Use location"}
                  </button>
                </div>
                <div className="mt-1">
                  <label className="text-sm font-semibold text-gray-900">About</label>
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
                      className="mt-2 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                      placeholder="Tell people about yourself"
                    />
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            <Button
              className="w-full !bg-gradient-to-r !from-fuchsia-600 !to-violet-600"
              disabled={saving || loading}
              onClick={saveProfile}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </section>

        {/* ── Interests ───────────────────────────────────────────────────── */}
        <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(124,58,237,0.08)] ring-1 ring-gray-100">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Interests</h2>
            <span className="text-xs text-gray-500">{picked.length} selected</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {loading && !allInterests.length
              ? Array.from({ length: 10 }).map((_, i) => <Sk.chip key={i} />)
              : allInterests.map((i) => (
                  <Tag
                    key={i.id}
                    label={i.label}
                    active={picked.includes(i.label)}
                    onClick={() => toggleInterest(i.label)}
                  />
                ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button
              className="flex-1"
              onClick={saveInterests}
              disabled={loading || savingInterests}
            >
              {savingInterests ? "Saving…" : "Save interests"}
            </Button>
            <span className="text-[11px] text-gray-500">Tip: choose 3+ to stand out</span>
          </div>
        </section>

        {/* ── Gallery ─────────────────────────────────────────────────────── */}
        <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(124,58,237,0.08)] ring-1 ring-gray-100">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Gallery</h2>
            <button
              onClick={onPickFiles}
              className="text-sm font-medium text-violet-700 disabled:opacity-50"
              disabled={uploading}
            >
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
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              <i className="lni lni-image text-3xl text-gray-300" />
              <p className="mt-2">No gallery photos yet.</p>
              <p className="text-xs text-gray-400">Tap "Add" to upload more.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3">
                {gallery.slice(0, 2).map((src, i) => (
                  <PhotoTile
                    key={`g-top-${i}`}
                    src={src}
                    label={i + 1}
                    onMakePrimary={() => setPrimaryFromUrl(src)}
                    onDelete={() => deleteFromUrl(src)}
                  />
                ))}
              </div>
              {gallery.length > 2 && (
                <div className="grid grid-cols-3 gap-3">
                  {gallery.slice(2, 11).map((src, i) => (
                    <PhotoTile
                      key={`g-bot-${i}`}
                      src={src}
                      label={i + 3}
                      onMakePrimary={() => setPrimaryFromUrl(src)}
                      onDelete={() => deleteFromUrl(src)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Account ─────────────────────────────────────────────────────── */}
        <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(124,58,237,0.08)] ring-1 ring-gray-100">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Account</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button className="w-full" onClick={handleLogout} disabled={loggingOut}>
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

      {/* Toast animation keyframes */}
      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Photo tile (extracted to reduce duplication) ──────────────────────────── */
function PhotoTile({ src, label, onMakePrimary, onDelete }) {
  return (
    <div className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-gray-100">
      <img
        src={src}
        alt={`Gallery ${label}`}
        className="h-full w-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0 flex items-end justify-between gap-2 p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onMakePrimary}
          className="rounded-lg bg-white/90 px-2 py-1 text-xs text-gray-800 shadow-card"
        >
          Make primary
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg bg-white/90 px-2 py-1 text-xs text-red-600 shadow-card"
        >
          Delete
        </button>
      </div>
    </div>
  );
}