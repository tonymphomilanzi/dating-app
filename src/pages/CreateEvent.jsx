// src/pages/CreateEvent.jsx
import { useRef, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.client.js";
import { eventsService } from "../services/events.service.js";
import { useNavigate } from "react-router-dom";
import { getCurrentLocationWithAddress, searchLocation } from "../utils/geocoding.js";

const CATEGORIES = ["Concert", "Exhibition", "Art", "Sport", "Tech", "Other"];

function sanitizeFileName(name) {
  return String(name).replace(/[^A-Za-z0-9._-]+/g, "-");
}

export default function CreateEvent() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [category, setCategory] = useState("Concert");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  // Cover image state
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState("");
  
  // Location search state
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Handle file selection
  const handleFileSelect = () => fileInputRef.current?.click();
  
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  // Get current location with reverse geocoding
  const handleUseMyLocation = async () => {
    setIsGettingLocation(true);
    setError("");

    try {
      const location = await getCurrentLocationWithAddress();
      
      setLatitude(location.lat);
      setLongitude(location.lng);
      
      // Auto-fill city field with the geocoded city name
      if (location.city) {
        setCity(location.city);
        setLocationQuery(location.city);
      } else if (location.displayName) {
        // Fallback to display name if city not found
        setCity(location.displayName);
        setLocationQuery(location.displayName);
      }

      console.log(">>>Location found:", {
        lat: location.lat,
        lng: location.lng,
        city: location.city,
        displayName: location.displayName,
      });
    } catch (err) {
      setError(err.message || "Could not get your location");
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Handle location search (forward geocoding)
  const handleLocationSearch = async (query) => {
    setLocationQuery(query);
    setCity(query); // Update city as user types

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const results = await searchLocation(query, 5);
        setLocationSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (err) {
        console.warn(">>>Location search failed:", err);
        setLocationSuggestions([]);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 300);
  };

  // Handle selecting a location from suggestions
  const handleSelectLocation = (location) => {
    setCity(location.city || location.displayName);
    setLocationQuery(location.city || location.displayName);
    setLatitude(location.lat);
    setLongitude(location.lng);
    setShowSuggestions(false);
    setLocationSuggestions([]);

    console.log(">>>Location selected:", {
      city: location.city,
      lat: location.lat,
      lng: location.lng,
    });
  };

  // Upload cover image
  const uploadCoverImage = async (file) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const fileName = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
    
    const { error: uploadError } = await supabase.storage
      .from("events")
      .upload(fileName, file, { upsert: false });
    
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("events").getPublicUrl(fileName);
    return data.publicUrl;
  };

  // Save event
  const handleSave = async () => {
    setError("");

    // Validation
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!date || !time) {
      setError("Date and time are required");
      return;
    }

    setIsSaving(true);

    try {
      const startsAt = new Date(`${date}T${time}:00`);
      
      let coverUrl = null;
      if (coverFile) {
        coverUrl = await uploadCoverImage(coverFile);
      }

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

      const event = await eventsService.create(payload);

      // Format event for Events page display
      const eventDate = new Date(event.starts_at);
      const dateLabel = eventDate.toLocaleDateString([], { 
        day: "2-digit", 
        month: "short" 
      });

      const mappedEvent = {
        id: event.id,
        title: event.title,
        dateLabel,
        category: event.category || "Other",
        place: event.city || "Unknown",
        lat: event.lat,
        lng: event.lng,
        price: event.price || 0,
        img: event.cover_url || "",
        attendees: [],
        short: event.description || "",
        dateISO: event.starts_at,
      };

      navigate("/events", { replace: true, state: { created: mappedEvent } });
    } catch (err) {
      console.error("[CreateEvent] error:", err);
      setError(err.message || "Failed to create event");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50 to-white pb-28">
      <TopBar title="Create Event" />

      {/* Cover Image Section */}
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
          className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-lg hover:bg-gray-50 transition-colors"
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

      {/* Form Card */}
      <div className="mx-4 mt-5 rounded-3xl bg-white p-5 shadow-xl space-y-5">
        {/* Error Message */}
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
          className="w-full text-sm font-semibold rounded-xl border border-gray-200 p-3 placeholder-gray-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
        />

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-colors">
            <i className="lni lni-calendar text-violet-600" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full outline-none text-sm"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-colors">
            <i className="lni lni-timer text-violet-600" />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full outline-none text-sm"
            />
          </div>
        </div>

        {/* Category Chips */}
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
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-colors">
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

        {/* Location Search */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-colors">
            <i className="lni lni-map-marker text-violet-600" />
            <input
              value={locationQuery}
              onChange={(e) => handleLocationSearch(e.target.value)}
              onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search city or location..."
              className="w-full outline-none text-sm"
            />
            {isSearchingLocation && (
              <i className="lni lni-spinner-solid animate-spin text-gray-400" />
            )}
          </div>

          {/* Location Suggestions Dropdown */}
          {showSuggestions && locationSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {locationSuggestions.map((suggestion) => (
                <button
                  key={suggestion.placeId}
                  onClick={() => handleSelectLocation(suggestion)}
                  className="w-full px-4 py-3 text-left hover:bg-violet-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <p className="text-sm font-medium text-gray-800">
                    {suggestion.city || suggestion.displayName.split(",")[0]}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {suggestion.displayName}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Use My Location Button */}
          <button
            onClick={handleUseMyLocation}
            disabled={isGettingLocation}
            className="mt-2 flex items-center gap-2 text-sm text-violet-600 font-medium hover:text-violet-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
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

          {/* Show coordinates if available */}
          {latitude && longitude && (
            <p className="mt-1 text-xs text-gray-400">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your event..."
            className="w-full rounded-xl border border-gray-200 p-3 outline-none text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors resize-none"
          />
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <i className="lni lni-spinner-solid animate-spin" />
              Creating...
            </span>
          ) : (
            "Create Event"
          )}
        </Button>
      </div>
    </div>
  );
}