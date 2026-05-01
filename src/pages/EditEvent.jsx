// src/pages/EditEvent.jsx
import { useRef, useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.client.js"; // only for image upload
import { eventsService } from "../services/events.service.js";
import {
  getCurrentLocationWithAddress,
  searchLocation,
} from "../utils/geocoding.js";

const CATEGORIES = ["Concert", "Exhibition", "Art", "Sport", "Tech", "Other"];

function sanitizeFileName(name) {
  return String(name).replace(/[^A-Za-z0-9._-]+/g, "-");
}

export default function EditEvent() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();

  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Seed from nav state — same shape as Events.jsx mapRow produces
  const seed = state?.event ?? null;

  const [title, setTitle] = useState(seed?.title ?? "");
  const [date, setDate] = useState(() => {
    if (!seed?.dateISO) return "";
    return new Date(seed.dateISO).toISOString().slice(0, 10);
  });
  const [time, setTime] = useState(() => {
    if (!seed?.dateISO) return "";
    const d = new Date(seed.dateISO);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  });
  const [city, setCity] = useState(seed?.place ?? "");
  const [latitude, setLatitude] = useState(seed?.lat ?? null);
  const [longitude, setLongitude] = useState(seed?.lng ?? null);
  const [category, setCategory] = useState(seed?.category ?? "Concert");
  const [price, setPrice] = useState(seed?.price != null ? String(seed.price) : "");
  const [description, setDescription] = useState(seed?.description ?? "");

  // Cover image
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(seed?.img ?? "");

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!seed);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState("");

  // Location search
  const [locationQuery, setLocationQuery] = useState(seed?.place ?? "");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // ── Fetch event if not passed via state ────────────────────────
  useEffect(() => {
    if (seed) return; // already have data
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        const ev = data?.item ?? data?.event ?? data;
        if (cancelled) return;
        // Populate fields
        setTitle(ev.title ?? "");
        setDescription(ev.description ?? "");
        setCategory(ev.category ?? "Concert");
        setPrice(ev.price != null ? String(ev.price) : "");
        setCity(ev.city ?? "");
        setLocationQuery(ev.city ?? "");
        setLatitude(ev.lat != null ? Number(ev.lat) : null);
        setLongitude(ev.lng != null ? Number(ev.lng) : null);
        setCoverPreview(ev.cover_url ?? "");
        if (ev.starts_at) {
          const d = new Date(ev.starts_at);
          setDate(d.toISOString().slice(0, 10));
          setTime(
            `${String(d.getHours()).padStart(2, "0")}:${String(
              d.getMinutes()
            ).padStart(2, "0")}`
          );
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load event");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, seed]);

  // ── File handling ───────────────────────────────────────────────
  const handleFileSelect = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  // ── Location ────────────────────────────────────────────────────
  const handleUseMyLocation = async () => {
    setIsGettingLocation(true);
    setError("");
    try {
      const loc = await getCurrentLocationWithAddress();
      setLatitude(loc.lat);
      setLongitude(loc.lng);
      const label = loc.city || loc.displayName || "";
      setCity(label);
      setLocationQuery(label);
    } catch (err) {
      setError(err.message || "Could not get your location");
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleLocationSearch = (query) => {
    setLocationQuery(query);
    setCity(query);
    clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const results = await searchLocation(query, 5);
        setLocationSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 300);
  };

  const handleSelectLocation = (loc) => {
    const label = loc.city || loc.displayName;
    setCity(label);
    setLocationQuery(label);
    setLatitude(loc.lat);
    setLongitude(loc.lng);
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  // ── Upload cover ────────────────────────────────────────────────
  const uploadCoverImage = async (file) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const fileName = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("events")
      .upload(fileName, file, { upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("events").getPublicUrl(fileName);
    return data.publicUrl;
  };

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }
    if (!date || !time) { setError("Date and time are required"); return; }

    setIsSaving(true);
    try {
      const startsAt = new Date(`${date}T${time}:00`);

      let coverUrl = seed?.img ?? null;
      if (coverFile) coverUrl = await uploadCoverImage(coverFile);

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        cover_url: coverUrl,
        starts_at: startsAt.toISOString(),
        ends_at: null,
        city: city.trim() || null,
        lat: latitude,
        lng: longitude,
        capacity: null,
        category,
        price: price ? Number(price) : null,
      };

      // eventsService.update must do: .update(payload).eq('id', id).eq('creator_id', user.id)
      const updated = await eventsService.update(id, payload);

      navigate("/events", {
        replace: true,
        state: {
          updated: {
            id,
            title: payload.title,
            dateISO: payload.starts_at,
            dateLabel: new Date(payload.starts_at).toLocaleDateString([], {
              day: "2-digit",
              month: "short",
            }),
            category: payload.category,
            place: payload.city || "Unknown",
            lat: payload.lat,
            lng: payload.lng,
            price: payload.price ?? 0,
            img: payload.cover_url || "",
            description: payload.description || "",
            creator_id: seed?.creator_id ?? updated?.creator_id ?? null,
          },
        },
      });
    } catch (err) {
      console.error("[EditEvent] error:", err);
      setError(err.message || "Failed to update event");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-violet-50 to-white">
        <TopBar title="Edit Event" />
        <div className="flex items-center justify-center mt-20">
          <div className="h-10 w-10 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50 to-white pb-28">
      <TopBar title="Edit Event" />

      {/* Cover Image */}
      <div className="relative h-64 w-full overflow-hidden bg-gray-100">
        {coverPreview ? (
          <img
            src={coverPreview}
            alt="Event cover"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <i className="lni lni-image text-4xl mb-2" />
              <p>Add event cover</p>
            </div>
          </div>
        )}
        <button
          onClick={handleFileSelect}
          className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2
            text-sm font-semibold shadow-lg hover:bg-gray-50 transition-colors"
        >
          <i className="lni lni-image mr-2" />
          {coverPreview ? "Change" : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Form */}
      <div className="mx-4 mt-5 rounded-3xl bg-white p-5 shadow-xl space-y-5">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className="w-full text-sm font-semibold rounded-xl border border-gray-200
            p-3 placeholder-gray-400 focus:border-violet-500 focus:ring-1
            focus:ring-violet-500 outline-none transition-colors"
        />

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200
            p-3 focus-within:border-violet-500 focus-within:ring-1
            focus-within:ring-violet-500 transition-colors">
            <i className="lni lni-calendar text-violet-600" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200
            p-3 focus-within:border-violet-500 focus-within:ring-1
            focus-within:ring-violet-500 transition-colors">
            <i className="lni lni-timer text-violet-600" />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full outline-none text-sm"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-600">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  category === cat
                    ? "bg-violet-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 rounded-xl border border-gray-200
          p-3 focus-within:border-violet-500 focus-within:ring-1
          focus-within:ring-violet-500 transition-colors">
          <i className="lni lni-dollar text-violet-600" />
          <input
            type="number"
            placeholder="Ticket price (0 for free)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full outline-none text-sm"
            min="0"
            step="0.01"
          />
        </div>

        {/* Location */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200
            p-3 focus-within:border-violet-500 focus-within:ring-1
            focus-within:ring-violet-500 transition-colors">
            <i className="lni lni-map-marker text-violet-600" />
            <input
              value={locationQuery}
              onChange={(e) => handleLocationSearch(e.target.value)}
              onFocus={() =>
                locationSuggestions.length > 0 && setShowSuggestions(true)
              }
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search city or location..."
              className="w-full outline-none text-sm"
            />
            {isSearchingLocation && (
              <i className="lni lni-spinner-solid animate-spin text-gray-400" />
            )}
          </div>

          {showSuggestions && locationSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200
              bg-white shadow-lg max-h-60 overflow-y-auto">
              {locationSuggestions.map((s) => (
                <button
                  key={s.placeId}
                  onClick={() => handleSelectLocation(s)}
                  className="w-full px-4 py-3 text-left hover:bg-violet-50
                    transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <p className="text-sm font-medium text-gray-800">
                    {s.city || s.displayName.split(",")[0]}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{s.displayName}</p>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleUseMyLocation}
            disabled={isGettingLocation}
            className="mt-2 flex items-center gap-2 text-sm text-violet-600
              font-medium hover:text-violet-700 disabled:text-gray-400
              disabled:cursor-not-allowed transition-colors"
          >
            {isGettingLocation ? (
              <>
                <i className="lni lni-spinner-solid animate-spin" />
                Getting location...
              </>
            ) : (
              <>
                <i className="lni lni-target" />
                Use my current location
              </>
            )}
          </button>

          {latitude && longitude && (
            <p className="mt-1 text-xs text-gray-400">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          )}
        </div>

        {/* Description */}
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your event..."
          className="w-full rounded-xl border border-gray-200 p-3 outline-none
            text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500
            transition-colors resize-none"
        />
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t
        border-gray-200 p-4 shadow-lg">
        <div className="flex gap-3 max-w-md mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm
              font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <Button className="flex-2 flex-1" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <i className="lni lni-spinner-solid animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}