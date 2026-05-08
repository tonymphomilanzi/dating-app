// src/pages/CreateEvent.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.client.js";
import { eventsService } from "../services/events.service.js";
import { useNavigate } from "react-router-dom";
import {
  getCurrentLocationWithAddress,
  searchLocation,
} from "../utils/geocoding.js";

const CATEGORIES = [
  "Concert",
  "Exhibition",
  "Art",
  "Sport",
  "Tech",
  "Other",
];

function sanitizeFileName(name) {
  return String(name).replace(/[^A-Za-z0-9._-]+/g, "-");
}

/* ================================================================
   TICKET TYPE ROW — individual editable ticket tier
   ================================================================ */
function TicketTypeRow({ ticket, index, onChange, onRemove, isOnly }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Ticket {index + 1}
        </span>
        {!isOnly && (
          <button
            onClick={() => onRemove(index)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
            aria-label="Remove ticket type"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={ticket.name}
          onChange={(e) => onChange(index, "name", e.target.value)}
          placeholder="e.g. General Admission, VIP, Early Bird"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Price */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Price (USD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={ticket.price}
              onChange={(e) => onChange(index, "price", e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-gray-200 bg-white pl-7 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
            />
          </div>
          {ticket.price === "" || Number(ticket.price) === 0 ? (
            <p className="mt-1 text-[10px] text-emerald-600 font-medium">
              Free ticket
            </p>
          ) : null}
        </div>

        {/* Capacity */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Capacity
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={ticket.capacity}
            onChange={(e) => onChange(index, "capacity", e.target.value)}
            placeholder="Unlimited"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">
          Description{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={ticket.description}
          onChange={(e) => onChange(index, "description", e.target.value)}
          placeholder="e.g. Includes backstage access"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
        />
      </div>
    </div>
  );
}

/* ================================================================
   DEFAULT TICKET FACTORY
   ================================================================ */
function makeTicket(overrides = {}) {
  return {
    name: "",
    price: "",
    capacity: "",
    description: "",
    ...overrides,
  };
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function CreateEvent() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  /* ── Form state ── */
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [category, setCategory] = useState("Concert");
  const [description, setDescription] = useState("");

  /* ── Ticket types ── */
  const [ticketTypes, setTicketTypes] = useState([makeTicket()]);
  const [ticketsEnabled, setTicketsEnabled] = useState(false);

  /* ── Cover image ── */
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  /* ── UI state ── */
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("details"); // details | tickets

  /* ── Location search ── */
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  /* ── Refs ── */
  const searchTimerRef = useRef(null);
  const cancelledRef = useRef(false);
  const coverPreviewRef = useRef("");

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    };
  }, []);

  /* ── File handlers ── */
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    const url = URL.createObjectURL(file);
    coverPreviewRef.current = url;
    setCoverFile(file);
    setCoverPreview(url);
  }, []);

  /* ── Location handlers ── */
  const handleUseMyLocation = useCallback(async () => {
    setIsGettingLocation(true);
    setError("");
    try {
      const location = await getCurrentLocationWithAddress();
      if (cancelledRef.current) return;
      setLatitude(location.lat);
      setLongitude(location.lng);
      if (location.city) {
        setCity(location.city);
        setLocationQuery(location.city);
      } else if (location.displayName) {
        setCity(location.displayName);
        setLocationQuery(location.displayName);
      }
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err.message || "Could not get your location");
    } finally {
      if (!cancelledRef.current) setIsGettingLocation(false);
    }
  }, []);

  const handleLocationSearch = useCallback((query) => {
    setLocationQuery(query);
    setCity(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      if (cancelledRef.current) return;
      setIsSearchingLocation(true);
      try {
        const results = await searchLocation(query, 5);
        if (cancelledRef.current) return;
        setLocationSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        if (cancelledRef.current) return;
        setLocationSuggestions([]);
        setShowSuggestions(false);
      } finally {
        if (!cancelledRef.current) setIsSearchingLocation(false);
      }
    }, 300);
  }, []);

  const handleSelectLocation = useCallback((location) => {
    setCity(location.city || location.displayName);
    setLocationQuery(location.city || location.displayName);
    setLatitude(location.lat);
    setLongitude(location.lng);
    setShowSuggestions(false);
    setLocationSuggestions([]);
  }, []);

  /* ── Ticket type handlers ── */
  const handleTicketChange = useCallback((index, field, value) => {
    setTicketTypes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleAddTicketType = useCallback(() => {
    setTicketTypes((prev) => [...prev, makeTicket()]);
  }, []);

  const handleRemoveTicketType = useCallback((index) => {
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ── Upload cover ── */
  const uploadCoverImage = useCallback(async (file) => {
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
  }, []);

  /* ── Validate tickets ── */
  function validateTickets() {
    if (!ticketsEnabled) return null;
    for (let i = 0; i < ticketTypes.length; i++) {
      const t = ticketTypes[i];
      if (!t.name.trim()) {
        return `Ticket ${i + 1} needs a name`;
      }
      if (t.price !== "" && isNaN(Number(t.price))) {
        return `Ticket ${i + 1} has an invalid price`;
      }
      if (t.capacity !== "" && (isNaN(Number(t.capacity)) || Number(t.capacity) < 1)) {
        return `Ticket ${i + 1} needs a valid capacity (or leave blank for unlimited)`;
      }
    }
    return null;
  }

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    setError("");

    if (!title.trim()) { setError("Title is required"); return; }
    if (!date || !time) { setError("Date and time are required"); return; }

    const ticketError = validateTickets();
    if (ticketError) { setError(ticketError); return; }

    setIsSaving(true);

    try {
      const startsAt = new Date(`${date}T${time}:00`);

      let coverUrl = null;
      if (coverFile) {
        coverUrl = await uploadCoverImage(coverFile);
        if (cancelledRef.current) return;
      }

      /* ── derive legacy price + capacity from ticket types ── */
      // Use the lowest ticket price as the event's base price
      // Use total capacity across all ticket types
      let derivedPrice = null;
      let derivedCapacity = null;

      if (ticketsEnabled && ticketTypes.length > 0) {
        const prices = ticketTypes
          .map((t) => (t.price === "" ? 0 : Number(t.price)))
          .filter((p) => !isNaN(p));
        derivedPrice = prices.length > 0 ? Math.min(...prices) : 0;

        const caps = ticketTypes
          .filter((t) => t.capacity !== "")
          .map((t) => Number(t.capacity))
          .filter((c) => !isNaN(c) && c > 0);
        derivedCapacity = caps.length > 0 ? caps.reduce((a, b) => a + b, 0) : null;
      }

      const payload = {
        title:       title.trim(),
        description: description.trim() || null,
        cover_url:   coverUrl,
        starts_at:   startsAt.toISOString(),
        ends_at:     null,
        city:        city.trim() || null,
        lat:         latitude,
        lng:         longitude,
        capacity:    derivedCapacity,
        category,
        price:       derivedPrice,
      };

      /* ── create the event ── */
      const event = await eventsService.create(payload);
      if (cancelledRef.current) return;

      /* ── create ticket types if enabled ── */
      if (ticketsEnabled && ticketTypes.length > 0) {
        const ticketRows = ticketTypes.map((t, i) => ({
          event_id:    event.id,
          name:        t.name.trim(),
          description: t.description.trim() || null,
          price:       t.price === "" ? 0 : Number(t.price),
          capacity:    t.capacity === "" ? null : Number(t.capacity),
          sold_count:  0,
          is_active:   true,
          sort_order:  i,
        }));

        const { error: ticketError } = await supabase
          .from("event_ticket_types")
          .insert(ticketRows);

        if (cancelledRef.current) return;
        if (ticketError) throw ticketError;
      }

      const eventDate = new Date(event.starts_at);
      const dateLabel = eventDate.toLocaleDateString([], {
        day: "2-digit",
        month: "short",
      });

      const mappedEvent = {
        id:        event.id,
        title:     event.title,
        dateLabel,
        category:  event.category || "Other",
        place:     event.city     || "Unknown",
        lat:       event.lat,
        lng:       event.lng,
        price:     event.price    || 0,
        img:       event.cover_url || "",
        attendees: [],
        short:     event.description || "",
        dateISO:   event.starts_at,
      };

      navigate("/events", { replace: true, state: { created: mappedEvent } });
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("[CreateEvent] error:", err);
      setError(err.message || "Failed to create event");
    } finally {
      if (!cancelledRef.current) setIsSaving(false);
    }
  }, [
    title, date, time, city, latitude, longitude,
    category, description, coverFile,
    ticketsEnabled, ticketTypes,
    uploadCoverImage, navigate,
  ]);

  /* ── Derived summary for ticket tab badge ── */
  const ticketSummary = ticketsEnabled
    ? `${ticketTypes.length} type${ticketTypes.length !== 1 ? "s" : ""}`
    : "Off";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50 to-white pb-28">
      <TopBar title="Create Event" />

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
              <div className="text-4xl mb-2">🖼️</div>
              <p className="text-sm">Add event cover</p>
            </div>
          </div>
        )}
        <button
          onClick={handleFileSelect}
          className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-lg hover:bg-gray-50 transition-colors"
        >
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

      {/* Section Tabs */}
      <div className="mx-4 mt-5 flex gap-2 rounded-2xl bg-gray-100 p-1.5">
        <button
          onClick={() => setActiveSection("details")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200 ${
            activeSection === "details"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Event Details
        </button>
        <button
          onClick={() => setActiveSection("tickets")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            activeSection === "tickets"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Tickets
          <span
            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
              ticketsEnabled
                ? "bg-violet-100 text-violet-700"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {ticketSummary}
          </span>
        </button>
      </div>

      {/* ── DETAILS SECTION ── */}
      {activeSection === "details" && (
        <div className="mx-4 mt-4 rounded-3xl bg-white p-5 shadow-xl space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Event Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's the event?"
              className="w-full text-sm font-semibold rounded-xl border border-gray-200 p-3 placeholder-gray-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
            />
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Date & Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-colors">
                <CalendarIcon className="h-4 w-4 text-violet-600 shrink-0" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full outline-none text-sm"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-colors">
                <ClockIcon className="h-4 w-4 text-violet-600 shrink-0" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Category
            </label>
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

          {/* Location */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Location
            </label>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-colors">
                <MapPinIcon className="h-4 w-4 text-violet-600 shrink-0" />
                <input
                  value={locationQuery}
                  onChange={(e) => handleLocationSearch(e.target.value)}
                  onFocus={() =>
                    locationSuggestions.length > 0 && setShowSuggestions(true)
                  }
                  onBlur={() => {
                    searchTimerRef.current = setTimeout(() => {
                      if (!cancelledRef.current) setShowSuggestions(false);
                    }, 200);
                  }}
                  placeholder="Search city or location..."
                  className="w-full outline-none text-sm"
                />
                {isSearchingLocation && (
                  <SpinnerIcon className="h-4 w-4 text-gray-400 animate-spin shrink-0" />
                )}
              </div>

              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                  {locationSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      onClick={() => handleSelectLocation(suggestion)}
                      className="w-full px-4 py-3 text-left hover:bg-violet-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-800">
                        {suggestion.city ||
                          suggestion.displayName.split(",")[0]}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {suggestion.displayName}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleUseMyLocation}
                disabled={isGettingLocation}
                className="mt-2 flex items-center gap-2 text-sm text-violet-600 font-medium hover:text-violet-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isGettingLocation ? (
                  <>
                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                    Getting location...
                  </>
                ) : (
                  <>
                    <TargetIcon className="h-4 w-4" />
                    Use my current location
                  </>
                )}
              </button>

              {latitude && longitude && (
                <p className="mt-1 text-xs text-gray-400">
                  📍 {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your event..."
              className="w-full rounded-xl border border-gray-200 p-3 outline-none text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors resize-none"
            />
          </div>
        </div>
      )}

      {/* ── TICKETS SECTION ── */}
      {activeSection === "tickets" && (
        <div className="mx-4 mt-4 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600 mx-0">
              {error}
            </div>
          )}

          {/* Enable/disable toggle */}
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="text-base font-extrabold text-gray-900">
                  Enable Ticketing
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  Create ticket tiers with different prices and capacities.
                  Attendees pay via manual payment methods.
                </p>
              </div>
              {/* Toggle */}
              <button
                onClick={() => setTicketsEnabled((v) => !v)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors duration-200 ${
                  ticketsEnabled
                    ? "bg-violet-600 border-violet-600"
                    : "bg-gray-200 border-gray-200"
                }`}
                role="switch"
                aria-checked={ticketsEnabled}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    ticketsEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          {ticketsEnabled && (
            <>
              {/* Ticket type cards */}
              <div className="space-y-3">
                {ticketTypes.map((ticket, index) => (
                  <TicketTypeRow
                    key={index}
                    ticket={ticket}
                    index={index}
                    onChange={handleTicketChange}
                    onRemove={handleRemoveTicketType}
                    isOnly={ticketTypes.length === 1}
                  />
                ))}
              </div>

              {/* Add ticket type */}
              <button
                onClick={handleAddTicketType}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 py-4 text-sm font-bold text-violet-600 hover:bg-violet-100 hover:border-violet-400 active:scale-[0.98] transition-all duration-150"
              >
                <PlusIcon className="h-4 w-4" />
                Add Another Ticket Type
              </button>

              {/* Summary card */}
              {ticketTypes.some((t) => t.name.trim()) && (
                <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-5 text-white shadow-lg shadow-violet-200">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-3">
                    Ticket Summary
                  </p>
                  <div className="space-y-2">
                    {ticketTypes
                      .filter((t) => t.name.trim())
                      .map((t, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-1.5 w-1.5 rounded-full bg-white/60 shrink-0" />
                            <span className="text-sm font-semibold truncate">
                              {t.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className="text-sm font-extrabold">
                              {t.price === "" || Number(t.price) === 0
                                ? "Free"
                                : `$${Number(t.price).toFixed(2)}`}
                            </span>
                            {t.capacity ? (
                              <span className="text-xs text-white/60">
                                {t.capacity} spots
                              </span>
                            ) : (
                              <span className="text-xs text-white/60">∞</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                  {/* Total capacity */}
                  {ticketTypes.some((t) => t.capacity) && (
                    <div className="mt-3 pt-3 border-t border-white/20 flex justify-between">
                      <span className="text-xs text-white/60">
                        Total capacity
                      </span>
                      <span className="text-xs font-bold">
                        {ticketTypes
                          .filter((t) => t.capacity)
                          .reduce((sum, t) => sum + Number(t.capacity), 0)}{" "}
                        spots
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Info note */}
              <div className="flex items-start gap-3 rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <InfoIcon className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-900">
                    Manual verification
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                    Attendees pay via crypto, mobile money, bank transfer, or
                    Western Union. Your team verifies and confirms each
                    purchase. Ticket prices, capacity, and sales are tracked
                    automatically.
                  </p>
                </div>
              </div>
            </>
          )}

          {!ticketsEnabled && (
            <div className="rounded-3xl bg-white p-8 shadow-xl flex flex-col items-center text-center gap-3">
              <div className="h-16 w-16 rounded-full bg-violet-50 flex items-center justify-center">
                <TicketIcon className="h-8 w-8 text-violet-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  No ticketing configured
                </h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xs">
                  Toggle on ticketing above to create paid or free ticket tiers
                  for your event.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        {activeSection === "details" ? (
          <Button
            className="w-full"
            onClick={() => setActiveSection("tickets")}
          >
            Next: Tickets →
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon className="h-5 w-5 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Event"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   ICONS
   ================================================================ */
function CalendarIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function ClockIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}
function MapPinIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function TargetIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function PlusIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function TrashIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
function SpinnerIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function InfoIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
function TicketIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 010-6h20a3 3 0 010 6" />
      <path d="M2 15a3 3 0 000 6h20a3 3 0 000-6" />
      <line x1="2" y1="9" x2="2" y2="15" />
      <line x1="22" y1="9" x2="22" y2="15" />
    </svg>
  );
}