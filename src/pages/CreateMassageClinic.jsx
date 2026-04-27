// src/pages/CreateMassageClinic.jsx
//
// Form for creating a new massage clinic listing.
// Supports:
//   - Manual address input with optional geocoding
//   - Auto-detect location via browser Geolocation API
//   - Full validation before submission
//   - Success → redirect to /massage-clinics

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ================================================================
   CONSTANTS
   ================================================================ */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const GEOCODE_TIMEOUT_MS = 8_000;
const GEO_TIMEOUT_MS     = 12_000;

const SPECIALTIES = [
  "Swedish Massage",
  "Deep Tissue",
  "Sports Massage",
  "Hot Stone",
  "Aromatherapy",
  "Reflexology",
  "Thai Massage",
  "Prenatal Massage",
  "Lymphatic Drainage",
  "Shiatsu",
];

/* ================================================================
   HELPERS
   ================================================================ */

/**
 * Forward-geocode an address string → { lat, lng, display }.
 * Uses Nominatim (OpenStreetMap) — free, no API key required.
 */
async function geocodeAddress(address, signal) {
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
  const res  = await fetch(url, {
    headers: { "Accept-Language": "en" },
    signal,
  });
  if (!res.ok) throw new Error("Geocoding request failed");
  const [first] = await res.json();
  if (!first) throw new Error("Address not found. Try being more specific.");
  return {
    lat    : parseFloat(first.lat),
    lng    : parseFloat(first.lon),
    display: first.display_name,
  };
}

/**
 * Reverse-geocode { lat, lng } → human-readable address string.
 */
async function reverseGeocode(lat, lng, signal) {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const res  = await fetch(url, {
    headers: { "Accept-Language": "en" },
    signal,
  });
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  return data?.display_name || "";
}

const isValidLatLng = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
  !(lat === 0 && lng === 0);

/* ================================================================
   HOOK: useLocationPicker
   Manages the two location-input flows:
     1. User types an address → geocode on "Confirm"
     2. User clicks "Use my location" → reverse-geocode to get address
   ================================================================ */

function useLocationPicker() {
  const [address,    setAddress]    = useState("");
  const [coords,     setCoords]     = useState(null);   // { lat, lng }
  const [geoStatus,  setGeoStatus]  = useState("idle"); // idle | loading | granted | denied | error
  const [geoError,   setGeoError]   = useState("");
  const [geocoding,  setGeocoding]  = useState(false);
  const [geocodeErr, setGeocodeErr] = useState("");

  const abortRef  = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  /** Geocode the current address string → store coords. */
  const confirmAddress = useCallback(async () => {
    if (!address.trim()) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const timerId = setTimeout(() => ac.abort(), GEOCODE_TIMEOUT_MS);

    setGeocoding(true);
    setGeocodeErr("");
    setCoords(null);

    try {
      const result = await geocodeAddress(address.trim(), ac.signal);
      clearTimeout(timerId);
      if (!mountedRef.current || ac.signal.aborted) return;
      setCoords({ lat: result.lat, lng: result.lng });
      setAddress(result.display); // normalise to what Nominatim returned
    } catch (err) {
      clearTimeout(timerId);
      if (!mountedRef.current || ac.signal.aborted) return;
      setGeocodeErr(
        err?.name === "AbortError"
          ? "Geocoding timed out. Check your connection."
          : err?.message || "Could not find that address."
      );
    } finally {
      if (mountedRef.current) setGeocoding(false);
    }
  }, [address]);

  /** Use browser Geolocation → reverse-geocode to fill address. */
  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("denied");
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setGeoStatus("loading");
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords: c }) => {
        const lat = c.latitude;
        const lng = c.longitude;

        if (!isValidLatLng(lat, lng)) {
          if (mountedRef.current) {
            setGeoStatus("error");
            setGeoError("Received invalid coordinates from device.");
          }
          return;
        }

        if (mountedRef.current) {
          setCoords({ lat, lng });
          setGeoStatus("granted");
        }

        // Reverse-geocode to fill the address field
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        const timerId = setTimeout(() => ac.abort(), GEOCODE_TIMEOUT_MS);

        try {
          const label = await reverseGeocode(lat, lng, ac.signal);
          clearTimeout(timerId);
          if (mountedRef.current && !ac.signal.aborted && label) {
            setAddress(label);
          }
        } catch {
          clearTimeout(timerId);
          // Non-critical — coords already set, address just stays empty
        }
      },
      (err) => {
        if (!mountedRef.current) return;
        setGeoStatus("denied");
        setGeoError(
          err.code === 1
            ? "Location permission denied. Please enable it in your browser settings."
            : "Could not get your location. Please enter it manually."
        );
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 60_000 }
    );
  }, []);

  const clearLocation = useCallback(() => {
    setCoords(null);
    setAddress("");
    setGeocodeErr("");
    setGeoError("");
    setGeoStatus("idle");
  }, []);

  return {
    address, setAddress,
    coords,
    geoStatus, geoError,
    geocoding, geocodeErr,
    confirmAddress,
    useMyLocation,
    clearLocation,
  };
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function CreateMassageClinic() {
  const navigate = useNavigate();

  // ── Form state ───────────────────────────────────────────────────
  const [form, setForm] = useState({
    name        : "",
    phone       : "",
    email       : "",
    website     : "",
    description : "",
    openingHours: "",
    specialties : [],  // string[]
    coverFile   : null,
    coverPreview: null,
  });

  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const loc = useLocationPicker();
  const fileInputRef = useRef(null);
  const mountedRef   = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Field helpers ────────────────────────────────────────────────
  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }, []);

  const toggleSpecialty = useCallback((s) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }));
  }, []);

  const handleCoverChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, cover: "Image must be under 5 MB." }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((prev) => {
      // Revoke previous preview URL to avoid memory leaks
      if (prev.coverPreview) URL.revokeObjectURL(prev.coverPreview);
      return { ...prev, coverFile: file, coverPreview: url };
    });
    setErrors((prev) => ({ ...prev, cover: "" }));
  }, []);

  // ── Validation ───────────────────────────────────────────────────
  const validate = useCallback(() => {
    const e = {};
    if (!form.name.trim())        e.name    = "Clinic name is required.";
    if (!loc.address.trim())      e.address = "Address is required.";
    if (!loc.coords)              e.coords  = "Please confirm your address or use your location.";
    if (form.phone && !/^[\d\s\+\-\(\)]{7,20}$/.test(form.phone))
      e.phone = "Enter a valid phone number.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    return e;
  }, [form, loc.address, loc.coords]);

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      // Scroll to first error
      const first = document.querySelector("[data-error]");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      // ── Build the payload ──────────────────────────────────────
      const payload = new FormData();
      payload.append("name",         form.name.trim());
      payload.append("address",      loc.address.trim());
      payload.append("lat",          String(loc.coords.lat));
      payload.append("lng",          String(loc.coords.lng));
      payload.append("phone",        form.phone.trim());
      payload.append("email",        form.email.trim());
      payload.append("website",      form.website.trim());
      payload.append("description",  form.description.trim());
      payload.append("opening_hours", form.openingHours.trim());
      payload.append("specialties",  JSON.stringify(form.specialties));
      if (form.coverFile) payload.append("cover", form.coverFile);

      // ── Replace with your real service call ───────────────────
      // await massageClinicService.create(payload);
      console.log("[CreateMassageClinic] would submit:", Object.fromEntries(payload));
      await new Promise((r) => setTimeout(r, 1_000)); // stub delay
      // ──────────────────────────────────────────────────────────

      if (mountedRef.current) {
        navigate("/massage-clinics", {
          replace: true,
          state: { created: true },
        });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setSubmitError(err?.message || "Failed to create clinic. Please try again.");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [form, loc.address, loc.coords, navigate, validate]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gray-50 pb-32">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b
        border-gray-100 bg-white/95 px-4 py-3.5 backdrop-blur-sm shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="grid h-9 w-9 place-items-center rounded-full bg-gray-50
            text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">New Massage Clinic</h1>
          <p className="text-xs text-gray-500">Create your clinic listing</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-lg px-4 pt-6 space-y-6">

        {/* ── Cover photo ── */}
        <Section title="Cover Photo" subtitle="Optional — helps attract clients">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-full overflow-hidden rounded-2xl border-2 border-dashed
              border-gray-200 bg-white transition-colors hover:border-violet-300
              hover:bg-violet-50/30 focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-violet-400"
          >
            {form.coverPreview ? (
              <img
                src={form.coverPreview}
                alt="Cover preview"
                className="h-44 w-full object-cover"
              />
            ) : (
              <div className="flex h-44 flex-col items-center justify-center gap-2
                text-gray-400">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0
                       0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span className="text-sm font-medium">Upload cover photo</span>
                <span className="text-xs">JPG, PNG, WebP · max 5 MB</span>
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverChange}
          />
          {errors.cover && <FieldError>{errors.cover}</FieldError>}
          {form.coverPreview && (
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(form.coverPreview);
                setForm((p) => ({ ...p, coverFile: null, coverPreview: null }));
              }}
              className="mt-1 text-xs text-red-500 hover:underline"
            >
              Remove photo
            </button>
          )}
        </Section>

        {/* ── Basic info ── */}
        <Section title="Basic Info">
          <Field label="Clinic Name" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Serenity Wellness Spa"
              maxLength={120}
              className={inputCls(errors.name)}
            />
          </Field>

          <Field label="Phone" error={errors.phone}>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
              className={inputCls(errors.phone)}
            />
          </Field>

          <Field label="Email" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="hello@yourclinic.com"
              className={inputCls(errors.email)}
            />
          </Field>

          <Field label="Website">
            <input
              type="url"
              value={form.website}
              onChange={(e) => setField("website", e.target.value)}
              placeholder="https://yourclinic.com"
              className={inputCls()}
            />
          </Field>
        </Section>

        {/* ── Location ── */}
        <Section
          title="Location"
          subtitle="Enter an address or use your current location"
        >
          {/* Auto-detect button */}
          <button
            type="button"
            onClick={loc.useMyLocation}
            disabled={loc.geoStatus === "loading"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl
              border border-violet-200 bg-violet-50 py-3 text-sm font-semibold
              text-violet-700 transition-colors hover:bg-violet-100
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loc.geoStatus === "loading" ? (
              <>
                <Spinner className="h-4 w-4" />
                Detecting location…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827
                       0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Use My Current Location
              </>
            )}
          </button>

          {/* Geo error */}
          {loc.geoError && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs text-amber-700">{loc.geoError}</p>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400">or enter manually</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Address input */}
          <Field label="Address" required error={errors.address || errors.coords}>
            <div className="flex gap-2">
              <input
                type="text"
                value={loc.address}
                onChange={(e) => {
                  loc.setAddress(e.target.value);
                  setErrors((p) => ({ ...p, address: "", coords: "" }));
                }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); loc.confirmAddress(); } }}
                placeholder="123 Main St, City, Country"
                className={`flex-1 ${inputCls(errors.address || errors.coords)}`}
              />
              <button
                type="button"
                onClick={loc.confirmAddress}
                disabled={loc.geocoding || !loc.address.trim()}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-2xl
                  bg-violet-600 px-4 py-3 text-sm font-semibold text-white
                  transition-colors hover:bg-violet-700
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loc.geocoding ? <Spinner className="h-4 w-4" /> : "Confirm"}
              </button>
            </div>
            {loc.geocodeErr && <FieldError>{loc.geocodeErr}</FieldError>}
          </Field>

          {/* Confirmed coords chip */}
          {loc.coords && (
            <div className="flex items-center justify-between rounded-xl
              border border-green-200 bg-green-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" clipRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1
                       1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0
                       00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
                <span className="font-medium">Location confirmed</span>
                <span className="text-xs text-green-600 ml-1">
                  ({loc.coords.lat.toFixed(5)}, {loc.coords.lng.toFixed(5)})
                </span>
              </div>
              <button
                type="button"
                onClick={loc.clearLocation}
                className="text-xs text-green-600 hover:text-green-800 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </Section>

        {/* ── Description ── */}
        <Section title="About">
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Tell potential clients about your clinic, services, and what makes you special…"
              rows={4}
              maxLength={1000}
              className={`resize-none ${inputCls()}`}
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {form.description.length}/1000
            </p>
          </Field>

          <Field label="Opening Hours">
            <input
              type="text"
              value={form.openingHours}
              onChange={(e) => setField("openingHours", e.target.value)}
              placeholder="e.g. Mon–Fri 9am–7pm, Sat 10am–5pm"
              className={inputCls()}
            />
          </Field>
        </Section>

        {/* ── Specialties ── */}
        <Section
          title="Specialties"
          subtitle="Select all that apply"
        >
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((s) => {
              const active = form.specialties.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialty(s)}
                  className={[
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                    active
                      ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50",
                  ].join(" ")}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Submit error ── */}
        {submitError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{submitError}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-violet-600 py-4 text-base font-bold
            text-white shadow-sm transition-all hover:bg-violet-700
            active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="h-5 w-5" />
              Creating listing…
            </span>
          ) : (
            "Create Clinic Listing"
          )}
        </button>

        {/* ── Cancel ── */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-full py-3 text-sm font-medium text-gray-500
            hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

/* ================================================================
   FORM UI PRIMITIVES
   ================================================================ */

function Section({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div data-error={error ? true : undefined}>
      <label className="mb-1.5 block text-xs font-semibold text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

function FieldError({ children }) {
  return (
    <p className="mt-1 text-xs font-medium text-red-500" role="alert">
      {children}
    </p>
  );
}

function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** Tailwind class string for a text input, with optional error ring. */
function inputCls(error) {
  return [
    "w-full rounded-2xl border px-4 py-3 text-sm text-gray-900 outline-none",
    "placeholder:text-gray-400 transition-shadow",
    "focus:ring-2 focus:ring-violet-200 focus:border-violet-400",
    error
      ? "border-red-300 bg-red-50 focus:ring-red-200 focus:border-red-400"
      : "border-gray-200 bg-white",
  ].join(" ");
}