import { useRef, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.client.js";
import { eventsService } from "../services/events.service.js";
import { useNavigate } from "react-router-dom";

const categories = ["Concert", "Exhibition", "Art", "Sport", "Tech", "Other"];
const sanitize = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, "-");

export default function CreateEvent() {
  const nav = useNavigate();
  const fileRef = useRef(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");           // yyyy-MM-dd
  const [time, setTime] = useState("");           // HH:mm
  const [city, setCity] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [category, setCategory] = useState("Concert");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const pickFile = () => fileRef.current?.click();
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const useMyLocation = async () => {
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 });
      });
      setLat(Number(pos.coords.latitude));
      setLng(Number(pos.coords.longitude));
    } catch (e) {
      alert(e.message || "Could not get your location");
    }
  };

  const uploadCover = async (file) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const path = `${user.id}/${Date.now()}-${sanitize(file.name)}`;
    const { error } = await supabase.storage.from("events").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("events").getPublicUrl(path);
    return data.publicUrl;
  };

  const save = async () => {
    setErr("");
    if (!title.trim()) return setErr("Title is required");
    if (!date || !time) return setErr("Date and time are required");
    setSaving(true);

    try {
      const starts_at = new Date(`${date}T${time}:00`);
      let cover_url = null;
      if (coverFile) cover_url = await uploadCover(coverFile);

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        cover_url,
        starts_at: starts_at.toISOString(),
        ends_at: null,
        city: city.trim() || null,
        lat, lng,
        capacity: null,
        category,
        price: price ? Number(price) : null,
      };

      const event = await eventsService.create(payload);

      // Map event to EventsHome card shape and go back
      const dateObj = new Date(event.starts_at);
      const dateLabel = dateObj.toLocaleDateString([], { day: "2-digit", month: "short" });
      const mapped = {
        id: event.id,
        title: event.title,
        dateLabel,
        category: event.category || "Other",
        place: event.city || "Unknown",
        lat: event.lat, lng: event.lng,
        price: event.price || 0,
        img: event.cover_url || "",
        attendees: [],
        short: event.description || "",
        dateISO: event.starts_at,
      };

      nav("/events", { replace: true, state: { created: mapped } });
    } catch (e) {
      console.error("[CreateEvent] error:", e);
      setErr(e.message || "Failed to create event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white">
      <TopBar title="Create event" />
      <div className="space-y-5 p-5">
        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

        {/* Cover */}
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-2 text-sm font-semibold">Cover</div>
          {coverPreview ? (
            <div className="relative overflow-hidden rounded-xl border border-gray-200">
              <img src={coverPreview} className="max-h-60 w-full object-cover" />
            </div>
          ) : (
            <div className="grid h-40 place-items-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-500">
              No cover selected
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={pickFile}><i className="lni lni-image mr-1" /> Choose cover</Button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
          </div>
        </div>

        {/* Details */}
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="mb-3 text-sm font-semibold">Details</div>

          <label className="mb-3 block">
            <span className="text-sm text-gray-600">Title</span>
            <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Event title"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-gray-600">Date</span>
              <input type="date" value={date} onChange={(e)=>setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200" />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Time</span>
              <input type="time" value={time} onChange={(e)=>setTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <label className="block">
              <span className="text-sm text-gray-600">Category</span>
              <select value={category} onChange={(e)=>setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Price (USD)</span>
              <input type="number" min={0} value={price} onChange={(e)=>setPrice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200" />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="text-sm text-gray-600">City / Place</span>
            <input value={city} onChange={(e)=>setCity(e.target.value)} placeholder="City, Place"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200" />
          </label>

          <div className="mt-3 flex items-center gap-2">
            <button onClick={useMyLocation} className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              <i className="lni lni-map-marker text-violet-600" /> Use my location
            </button>
            {(lat != null && lng != null) && (
              <span className="text-xs text-gray-600">Set: {lat.toFixed(4)}, {lng.toFixed(4)}</span>
            )}
          </div>

          <label className="mt-3 block">
            <span className="text-sm text-gray-600">Description (optional)</span>
            <textarea rows={4} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Describe your event"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200" />
          </label>
        </div>

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? "Creating…" : "Create event"}
        </Button>
      </div>
    </div>
  );
}