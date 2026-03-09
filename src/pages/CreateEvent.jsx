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
  <div className="min-h-dvh bg-gradient-to-b from-violet-50 to-white pb-28">

    <TopBar title="Create Event" />

    {/* HERO COVER */}
    <div className="relative h-64 w-full overflow-hidden bg-gray-100">

      {coverPreview ? (
        <img
          src={coverPreview}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-gray-400">
          Add event cover
        </div>
      )}

      <button
        onClick={pickFile}
        className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-lg"
      >
        <i className="lni lni-image mr-2"></i>
        Upload
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />
    </div>


    {/* FORM CARD */}
    <div className="mx-4 mt-5 rounded-3xl bg-white p-5 shadow-xl space-y-5">

      {/* TITLE */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Event title"
        className="w-full text-sm font-semibold rounded-xl border p-3 placeholder-gray-600"
      />


      {/* DATE + TIME */}
      <div className="grid grid-cols-2 gap-3">

        <div className="flex items-center gap-2 rounded-xl border p-3">
          <i className="lni lni-calendar text-violet-600"></i>
          <input
            type="date"
            value={date}
            onChange={(e)=>setDate(e.target.value)}
            className="w-full outline-none"
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border p-3">
          <i className="lni lni-timer text-violet-600"></i>
          <input
            type="time"
            value={time}
            onChange={(e)=>setTime(e.target.value)}
            className="w-full outline-none"
          />
        </div>

      </div>


      {/* CATEGORY CHIPS */}
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-600">
          Category
        </p>

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-4 py-2 text-sm
              ${
                category === c
                  ? "bg-violet-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>


      {/* PRICE */}
      <div className="flex items-center gap-2 rounded-xl border p-3">
        <i className="lni lni-dollar text-violet-600"></i>

        <input
          type="number"
          placeholder="Ticket price"
          value={price}
          onChange={(e)=>setPrice(e.target.value)}
          className="w-full outline-none"
        />
      </div>


      {/* LOCATION */}
      <div className="flex items-center gap-2 rounded-xl border p-3">
        <i className="lni lni-map-marker text-violet-600"></i>

        <input
          value={city}
          onChange={(e)=>setCity(e.target.value)}
          placeholder="City / Location"
          className="w-full outline-none"
        />
      </div>


      <button
        onClick={useMyLocation}
        className="text-sm text-violet-600 font-medium"
      >
        Use my location
      </button>


      {/* DESCRIPTION */}
      <textarea
        rows={4}
        value={description}
        onChange={(e)=>setDescription(e.target.value)}
        placeholder="Describe your event..."
        className="w-full rounded-xl border p-3 outline-none"
      />

    </div>


    {/* STICKY CTA */}
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">

      <Button
        className="w-full"
        onClick={save}
        disabled={saving}
      >
        {saving ? "Creating…" : "Create Event"}
      </Button>

    </div>

  </div>
);

}