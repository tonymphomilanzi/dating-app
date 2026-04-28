// src/pages/CreateMassageClinic.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

/* ================================================================
   CONSTANTS
   ================================================================ */

const NOMINATIM_BASE     = "https://nominatim.openstreetmap.org";
const GEOCODE_TIMEOUT_MS = 8_000;
const GEO_TIMEOUT_MS     = 12_000;
const STORAGE_BUCKET     = "clinic-covers";

// App lifecycle constants
const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const CONNECTION_TIMEOUT = 10_000;  // 10 seconds
const MAX_RETRY_ATTEMPTS = 3;

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const DAY_SHORT = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

/**
 * Default opening-hours structure — all days closed.
 * Shape: { [day]: { open: boolean, from: "HH:MM", to: "HH:MM" } }
 */
const DEFAULT_HOURS = Object.fromEntries(
  DAYS.map((d) => [d, { open: false, from: "09:00", to: "18:00" }])
);

const SPECIALTIES = [
  "Swedish Massage","Deep Tissue","Sports Massage","Hot Stone",
  "Aromatherapy","Reflexology","Thai Massage","Prenatal Massage",
  "Lymphatic Drainage","Shiatsu",
];

/* ================================================================
   APP LIFECYCLE MANAGER
   ================================================================ */

class AppLifecycleManager {
  constructor() {
    this.isActive = true;
    this.isOnline = navigator.onLine;
    this.callbacks = new Set();
    this.heartbeatInterval = null;
    this.retryAttempts = 0;
    
    this.init();
  }

  init() {
    // Visibility API - handle app going to background/foreground
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    // Network connectivity
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Page focus/blur
    window.addEventListener('focus', this.handleFocus.bind(this));
    window.addEventListener('blur', this.handleBlur.bind(this));
    
    // Before unload cleanup
    window.addEventListener('beforeunload', this.cleanup.bind(this));
    
    this.startHeartbeat();
  }

  handleVisibilityChange() {
    const wasActive = this.isActive;
    this.isActive = !document.hidden;
    
    if (this.isActive && !wasActive) {
      console.log('[Lifecycle] App became active, reconnecting...');
      this.handleAppResume();
    } else if (!this.isActive && wasActive) {
      console.log('[Lifecycle] App became inactive, pausing...');
      this.handleAppPause();
    }
  }

  handleFocus() {
    if (!this.isActive) {
      this.isActive = true;
      this.handleAppResume();
    }
  }

  handleBlur() {
    // Don't immediately mark as inactive on blur, wait for visibility change
  }

  handleOnline() {
    const wasOffline = !this.isOnline;
    this.isOnline = true;
    
    if (wasOffline) {
      console.log('[Lifecycle] Back online, reconnecting...');
      this.retryAttempts = 0;
      this.notifyCallbacks('online', { reconnected: true });
    }
  }

  handleOffline() {
    this.isOnline = false;
    console.log('[Lifecycle] Gone offline');
    this.notifyCallbacks('offline');
  }

  handleAppResume() {
    this.startHeartbeat();
    this.checkConnectivity();
    this.notifyCallbacks('resume');
  }

  handleAppPause() {
    this.stopHeartbeat();
    this.notifyCallbacks('pause');
  }

  async checkConnectivity() {
    if (!this.isOnline) return false;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);
      
      const response = await fetch('/api/health', { 
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        this.retryAttempts = 0;
        return true;
      } else {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error) {
      console.warn('[Lifecycle] Connectivity check failed:', error.message);
      this.handleConnectivityIssue();
      return false;
    }
  }

  handleConnectivityIssue() {
    this.retryAttempts++;
    
    if (this.retryAttempts <= MAX_RETRY_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 10000);
      console.log(`[Lifecycle] Retrying connectivity check in ${delay}ms (attempt ${this.retryAttempts})`);
      
      setTimeout(() => {
        this.checkConnectivity();
      }, delay);
    } else {
      console.error('[Lifecycle] Max retry attempts reached, notifying callbacks');
      this.notifyCallbacks('connection-failed');
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(async () => {
      if (this.isActive && this.isOnline) {
        const connected = await this.checkConnectivity();
        if (!connected) {
          console.warn('[Lifecycle] Heartbeat failed, connection issues detected');
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  subscribe(callback) {
    this.callbacks.add(callback);
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  notifyCallbacks(event, data = {}) {
    this.callbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('[Lifecycle] Callback error:', error);
      }
    });
  }

  cleanup() {
    this.stopHeartbeat();
    this.callbacks.clear();
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    window.removeEventListener('focus', this.handleFocus.bind(this));
    window.removeEventListener('blur', this.handleBlur.bind(this));
    window.removeEventListener('beforeunload', this.cleanup.bind(this));
  }
}

// Singleton instance
const appLifecycle = new AppLifecycleManager();

/* ================================================================
   TIME HELPERS
   ================================================================ */

/** Generate every 30-minute slot from 00:00 to 23:30 */
const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
})();

/** "09:00" → "9:00 AM" */
function to12h(t) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}

/**
 * Serialize the hours map to a compact JSON string suitable for storage.
 * Only includes days that are open.
 * e.g. [{ day:"Monday", from:"09:00", to:"18:00" }, ...]
 */
function serializeHours(hours) {
  return JSON.stringify(
    DAYS.filter((d) => hours[d].open).map((d) => ({
      day : d,
      from: hours[d].from,
      to  : hours[d].to,
    }))
  );
}

/** Human-readable summary for the preview chip, e.g. "Mon–Fri 9AM–6PM, Sat 10AM–4PM" */
function hoursPreview(hours) {
  const open = DAYS.filter((d) => hours[d].open);
  if (!open.length) return "Closed all week";

  // Group consecutive days with identical hours
  const groups = [];
  let cur = null;

  for (const day of open) {
    const slot = `${hours[day].from}|${hours[day].to}`;
    if (cur && cur.slot === slot) {
      cur.days.push(day);
    } else {
      cur = { days: [day], slot };
      groups.push(cur);
    }
  }

  return groups
    .map(({ days, slot }) => {
      const [from, to] = slot.split("|");
      const label =
        days.length === 1
          ? DAY_SHORT[days[0]]
          : `${DAY_SHORT[days[0]]}–${DAY_SHORT[days[days.length - 1]]}`;
      return `${label} ${to12h(from)}–${to12h(to)}`;
    })
    .join(", ");
}

/* ================================================================
   ENHANCED GEOCODING HELPERS
   ================================================================ */

async function geocodeAddress(address, signal) {
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
  
  try {
    const res = await fetch(url, { 
      headers: { "Accept-Language": "en" }, 
      signal,
      cache: 'no-cache' // Prevent stale cache issues
    });
    
    if (!res.ok) {
      throw new Error(`Geocoding request failed: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    const [first] = data;
    
    if (!first) {
      throw new Error("Address not found. Try being more specific.");
    }
    
    return { 
      lat: parseFloat(first.lat), 
      lng: parseFloat(first.lon), 
      display: first.display_name 
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error("Request was cancelled");
    }
    throw error;
  }
}

async function reverseGeocode(lat, lng, signal) {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  
  try {
    const res = await fetch(url, { 
      headers: { "Accept-Language": "en" }, 
      signal,
      cache: 'no-cache'
    });
    
    if (!res.ok) {
      throw new Error(`Reverse geocoding failed: ${res.status}`);
    }
    
    const data = await res.json();
    return data?.display_name || "";
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error("Request was cancelled");
    }
    console.warn('Reverse geocoding failed:', error);
    return "";
  }
}

const isValidLatLng = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
  !(lat === 0 && lng === 0);

/* ================================================================
   ENHANCED HOOK: useLocationPicker
   ================================================================ */

function useLocationPicker() {
  const [address,    setAddress]    = useState("");
  const [coords,     setCoords]     = useState(null);
  const [geoStatus,  setGeoStatus]  = useState("idle");
  const [geoError,   setGeoError]   = useState("");
  const [geocoding,  setGeocoding]  = useState(false);
  const [geocodeErr, setGeocodeErr] = useState("");

  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  const watchIdRef = useRef(null);
  const timeoutRef = useRef(null);
  const lifecycleUnsubscribeRef = useRef(null);

  // Enhanced cleanup function
  const cleanup = useCallback(() => {
    mountedRef.current = false;
    
    // Abort any ongoing requests
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    
    // Clear any timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Stop watching position
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    // Unsubscribe from lifecycle events
    if (lifecycleUnsubscribeRef.current) {
      lifecycleUnsubscribeRef.current();
      lifecycleUnsubscribeRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    // Subscribe to app lifecycle events
    lifecycleUnsubscribeRef.current = appLifecycle.subscribe((event, data) => {
      if (!mountedRef.current) return;
      
      switch (event) {
        case 'pause':
          // Pause any ongoing operations
          if (abortRef.current) {
            abortRef.current.abort();
          }
          break;
          
        case 'resume':
        case 'online':
          // Resume operations if needed
          if (geocoding) {
            setGeocoding(false);
            setGeocodeErr("Connection restored. Please try again.");
          }
          break;
          
        case 'offline':
          setGeoError("You're offline. Location services unavailable.");
          setGeocodeErr("You're offline. Address lookup unavailable.");
          break;
          
        case 'connection-failed':
          setGeoError("Connection issues. Please check your internet and try again.");
          setGeocodeErr("Connection issues. Please check your internet and try again.");
          break;
      }
    });
    
    return cleanup;
  }, [cleanup]);

  const confirmAddress = useCallback(async () => {
    if (!address.trim()) return;
    if (!navigator.onLine) {
      setGeocodeErr("You're offline. Please connect to the internet and try again.");
      return;
    }
    
    // Cleanup previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    
    const ac = new AbortController();
    abortRef.current = ac;
    
    const timeoutId = setTimeout(() => {
      ac.abort();
    }, GEOCODE_TIMEOUT_MS);
    
    timeoutRef.current = timeoutId;
    
    setGeocoding(true);
    setGeocodeErr("");
    setCoords(null);
    
    try {
      const result = await geocodeAddress(address.trim(), ac.signal);
      
      clearTimeout(timeoutId);
      
      if (!mountedRef.current || ac.signal.aborted) return;
      
      setCoords({ lat: result.lat, lng: result.lng });
      setAddress(result.display);
      
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (!mountedRef.current || ac.signal.aborted) return;
      
      let errorMessage = "Could not find that address.";
      
      if (err?.name === "AbortError") {
        errorMessage = "Request timed out. Please try again.";
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      setGeocodeErr(errorMessage);
      
    } finally {
      if (mountedRef.current) {
        setGeocoding(false);
      }
      
      timeoutRef.current = null;
    }
  }, [address]);

  const useMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("denied");
      setGeoError("Geolocation is not supported by this browser.");
      return;
    }
    
    if (!navigator.onLine) {
      setGeoError("You're offline. Please connect to the internet and try again.");
      return;
    }

    setGeoStatus("loading");
    setGeoError("");

    // Get current position with enhanced error handling
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        
        if (!isValidLatLng(lat, lng)) {
          if (mountedRef.current) {
            setGeoStatus("error");
            setGeoError("Invalid coordinates received. Please enter address manually.");
          }
          return;
        }

        if (mountedRef.current) {
          setCoords({ lat, lng });
          setGeoStatus("granted");
        }

        // Reverse geocode to get address
        if (abortRef.current) {
          abortRef.current.abort();
        }
        
        const ac = new AbortController();
        abortRef.current = ac;
        
        const timeoutId = setTimeout(() => ac.abort(), GEOCODE_TIMEOUT_MS);
        timeoutRef.current = timeoutId;
        
        try {
          const displayName = await reverseGeocode(lat, lng, ac.signal);
          
          clearTimeout(timeoutId);
          
          if (mountedRef.current && !ac.signal.aborted && displayName) {
            setAddress(displayName);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          // Non-fatal error - we have coordinates, just no address
          console.warn('Reverse geocoding failed:', error);
        } finally {
          timeoutRef.current = null;
        }
      },
      (error) => {
        if (!mountedRef.current) return;

        setGeoStatus("denied");
        
        let errorMessage = "Could not get location. Please enter it manually.";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access and try again.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable. Please enter address manually.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again or enter address manually.";
            break;
        }
        
        setGeoError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: 60_000 // Cache position for 1 minute
      }
    );
  }, []);

  const clearLocation = useCallback(() => {
    cleanup();
    setCoords(null);
    setAddress("");
    setGeocodeErr("");
    setGeoError("");
    setGeoStatus("idle");
  }, [cleanup]);

  return { 
    address, 
    setAddress, 
    coords, 
    geoStatus, 
    geoError,
    geocoding, 
    geocodeErr, 
    confirmAddress, 
    useMyLocation, 
    clearLocation 
  };
}

/* ================================================================
   COMPONENT: OpeningHoursPicker
   ================================================================ */

function OpeningHoursPicker({ value, onChange }) {
  // Apply a preset to a range of days
  const applyPreset = useCallback((preset) => {
    const next = { ...value };
    if (preset === "weekdays") {
      ["Monday","Tuesday","Wednesday","Thursday","Friday"].forEach((d) => {
        next[d] = { open: true, from: "09:00", to: "18:00" };
      });
      ["Saturday","Sunday"].forEach((d) => { next[d] = { ...next[d], open: false }; });
    } else if (preset === "everyday") {
      DAYS.forEach((d) => { next[d] = { open: true, from: "09:00", to: "18:00" }; });
    } else if (preset === "clear") {
      DAYS.forEach((d) => { next[d] = { ...next[d], open: false }; });
    }
    onChange(next);
  }, [value, onChange]);

  const toggleDay = useCallback((day) => {
    onChange({ ...value, [day]: { ...value[day], open: !value[day].open } });
  }, [value, onChange]);

  const setTime = useCallback((day, field, time) => {
    onChange({ ...value, [day]: { ...value[day], [field]: time } });
  }, [value, onChange]);

  // Copy hours from Monday to all other open days
  const copyMonToAll = useCallback(() => {
    const mon = value["Monday"];
    const next = { ...value };
    DAYS.forEach((d) => { if (next[d].open) next[d] = { ...next[d], from: mon.from, to: mon.to }; });
    onChange(next);
  }, [value, onChange]);

  const openCount = DAYS.filter((d) => value[d].open).length;

  return (
    <div className="space-y-3">
      {/* Quick presets */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "weekdays", label: "Weekdays" },
          { key: "everyday", label: "Every Day" },
          { key: "clear",    label: "Clear All"  },
        ].map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1
              text-xs font-medium text-gray-600 hover:border-violet-300
              hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            {p.label}
          </button>
        ))}
        {openCount > 1 && (
          <button
            type="button"
            onClick={copyMonToAll}
            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1
              text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
          >
            Copy Mon hours to all
          </button>
        )}
      </div>

      {/* Day rows */}
      <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white overflow-hidden">
        {DAYS.map((day) => {
          const slot = value[day];
          return (
            <div
              key={day}
              className={`flex items-center gap-3 px-4 py-3 transition-colors
                ${slot.open ? "bg-white" : "bg-gray-50/60"}`}
            >
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer
                  rounded-full border-2 border-transparent transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400
                  ${slot.open ? "bg-violet-600" : "bg-gray-200"}`}
                role="switch"
                aria-checked={slot.open}
                aria-label={`Toggle ${day}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
                    ring-0 transition-transform
                    ${slot.open ? "translate-x-4" : "translate-x-0"}`}
                />
              </button>

              {/* Day label */}
              <span className={`w-24 text-sm font-semibold shrink-0
                ${slot.open ? "text-gray-900" : "text-gray-400"}`}>
                {day}
              </span>

              {slot.open ? (
                /* Time pickers */
                <div className="flex flex-1 items-center gap-2 flex-wrap">
                  <TimeSelect
                    value={slot.from}
                    onChange={(t) => setTime(day, "from", t)}
                    label={`${day} open time`}
                  />
                  <span className="text-xs text-gray-400 shrink-0">to</span>
                  <TimeSelect
                    value={slot.to}
                    onChange={(t) => setTime(day, "to", t)}
                    label={`${day} close time`}
                    minTime={slot.from}
                  />
                </div>
              ) : (
                <span className="flex-1 text-xs text-gray-400 italic">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview summary */}
      {openCount > 0 && (
        <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-500 mb-0.5">
            Preview
          </p>
          <p className="text-xs text-violet-800 leading-relaxed">
            {hoursPreview(value)}
          </p>
        </div>
      )}
    </div>
  );
}

/* Time select dropdown */
function TimeSelect({ value, onChange, label, minTime }) {
  const slots = minTime
    ? TIME_SLOTS.filter((t) => t > minTime)
    : TIME_SLOTS;

  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-gray-200 bg-white
          pl-3 pr-7 py-1.5 text-xs font-medium text-gray-800
          focus:outline-none focus:ring-2 focus:ring-violet-300
          focus:border-violet-400 transition cursor-pointer"
      >
        {slots.map((t) => (
          <option key={t} value={t}>{to12h(t)}</option>
        ))}
      </select>
      {/* Chevron */}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  );
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function CreateMassageClinic() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // ── Form state ───────────────────────────────────────────────────
  const [form, setForm] = useState({
    name        : "",
    phone       : "",
    email       : "",
    website     : "",
    description : "",
    specialties : [],
    coverFile   : null,
    coverPreview: null,
  });

  // Opening hours — separate from `form` because it's a complex object
  const [hours, setHours] = useState(DEFAULT_HOURS);

  const [errors,      setErrors]      = useState({});
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("connected");

  const loc = useLocationPicker();
  const fileRef = useRef(null);
  const mountedRef = useRef(true);
  const lifecycleUnsubscribeRef = useRef(null);
  const createdObjectURLs = useRef(new Set());

  // Enhanced cleanup function
  const cleanup = useCallback(() => {
    mountedRef.current = false;
    
    // Cleanup object URLs to prevent memory leaks
    createdObjectURLs.current.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn('Error revoking object URL:', error);
      }
    });
    createdObjectURLs.current.clear();
    
    // Cleanup form preview URL
    if (form.coverPreview) {
      try {
        URL.revokeObjectURL(form.coverPreview);
      } catch (error) {
        console.warn('Error revoking cover preview URL:', error);
      }
    }
    
    // Unsubscribe from lifecycle events
    if (lifecycleUnsubscribeRef.current) {
      lifecycleUnsubscribeRef.current();
      lifecycleUnsubscribeRef.current = null;
    }
  }, [form.coverPreview]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Subscribe to app lifecycle events
    lifecycleUnsubscribeRef.current = appLifecycle.subscribe((event, data) => {
      if (!mountedRef.current) return;
      
      switch (event) {
        case 'pause':
          console.log('[CreateClinic] App paused');
          break;
          
        case 'resume':
          console.log('[CreateClinic] App resumed');
          setConnectionStatus("connected");
          break;
          
        case 'online':
          setConnectionStatus("connected");
          setSubmitError(""); // Clear any offline errors
          break;
          
        case 'offline':
          setConnectionStatus("offline");
          setSubmitError("You're offline. Please connect to the internet to create your clinic.");
          break;
          
        case 'connection-failed':
          setConnectionStatus("failed");
          setSubmitError("Connection issues detected. Please check your internet and try again.");
          break;
      }
    });
    
    return cleanup;
  }, [cleanup]);

  // ── Field helpers ────────────────────────────────────────────────
  const setField = useCallback((key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  }, []);

  const toggleSpecialty = useCallback((s) => {
    setForm((p) => ({
      ...p,
      specialties: p.specialties.includes(s)
        ? p.specialties.filter((x) => x !== s)
        : [...p.specialties, s],
    }));
  }, []);

  const handleCoverChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setErrors((p) => ({ ...p, cover: "Image must be under 5 MB." }));
      return;
    }
    
    // Cleanup previous preview URL
    if (form.coverPreview) {
      URL.revokeObjectURL(form.coverPreview);
      createdObjectURLs.current.delete(form.coverPreview);
    }
    
    const url = URL.createObjectURL(file);
    createdObjectURLs.current.add(url);
    
    setForm((p) => ({
      ...p,
      coverFile: file,
      coverPreview: url
    }));
    
    setErrors((p) => ({ ...p, cover: "" }));
  }, [form.coverPreview]);

  // ── Validation ───────────────────────────────────────────────────
  const validate = useCallback(() => {
    const e = {};
    if (!form.name.trim())   e.name    = "Clinic name is required.";
    if (!loc.address.trim()) e.address = "Address is required.";
    if (!loc.coords)         e.coords  = "Please confirm your address or use your location.";
    if (form.phone && !/^[\d\s\+\-\(\)]{7,20}$/.test(form.phone))
      e.phone = "Enter a valid phone number.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    return e;
  }, [form, loc.address, loc.coords]);

  /* ──────────────────────────────────────────────────────────────
     ENHANCED SUBMIT — writes directly to Supabase with better error handling:
       1. Upload cover image to Storage (if provided)
       2. Insert row into massage_clinics
       3. Bulk-insert specialties into clinic_specialties
     ────────────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // Check connection status
    if (!navigator.onLine || connectionStatus === "offline") {
      setSubmitError("You're offline. Please connect to the internet and try again.");
      return;
    }
    
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      document.querySelector("[data-error]")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!user) {
      setSubmitError("You must be signed in to create a clinic.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      // ── 1. Upload cover image with retry logic ──────────────────
      let coverUrl = null;

      if (form.coverFile) {
        const ext = form.coverFile.name.split(".").pop().toLowerCase();
        const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

        let uploadAttempts = 0;
        const maxUploadAttempts = 3;
        
        while (uploadAttempts < maxUploadAttempts) {
          try {
            const { error: uploadErr } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(filePath, form.coverFile, {
                cacheControl: "3600",
                upsert: false,
                contentType: form.coverFile.type,
              });

            if (uploadErr) {
              throw new Error(`Cover upload failed: ${uploadErr.message}`);
            }

            const { data: urlData } = supabase.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(filePath);

            coverUrl = urlData?.publicUrl ?? null;
            break; // Success, exit retry loop
            
          } catch (uploadError) {
            uploadAttempts++;
            console.warn(`[CreateClinic] Upload attempt ${uploadAttempts} failed:`, uploadError);
            
            if (uploadAttempts >= maxUploadAttempts) {
              throw new Error(`Failed to upload cover image after ${maxUploadAttempts} attempts: ${uploadError.message}`);
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
          }
        }
      }

      // ── 2. Insert clinic row with retry logic ──────────────────
      let insertAttempts = 0;
      const maxInsertAttempts = 3;
      let clinic = null;
      
      while (insertAttempts < maxInsertAttempts) {
        try {
          const { data: clinicData, error: insertErr } = await supabase
            .from("massage_clinics")
            .insert({
              owner_id: user.id,
              name: form.name.trim(),
              description: form.description.trim() || null,
              phone: form.phone.trim() || null,
              email: form.email.trim() || null,
              website: form.website.trim() || null,
              address: loc.address.trim(),
              lat: loc.coords.lat,
              lng: loc.coords.lng,
              cover_url: coverUrl,
              opening_hours: serializeHours(hours),
              status: "pending",
            })
            .select("id")
            .single();

          if (insertErr) {
            throw new Error(`Database error: ${insertErr.message}`);
          }

          clinic = clinicData;
          break; // Success, exit retry loop
          
        } catch (insertError) {
          insertAttempts++;
          console.warn(`[CreateClinic] Insert attempt ${insertAttempts} failed:`, insertError);
          
          if (insertAttempts >= maxInsertAttempts) {
            throw new Error(`Failed to create clinic after ${maxInsertAttempts} attempts: ${insertError.message}`);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * insertAttempts));
        }
      }

      // ── 3. Insert specialties (bulk) with error handling ────────
      if (form.specialties.length && clinic) {
        try {
          const { error: specErr } = await supabase
            .from("clinic_specialties")
            .insert(
              form.specialties.map((name) => ({ clinic_id: clinic.id, name }))
            );

          // Non-fatal — clinic is already created; log and continue
          if (specErr) {
            console.warn("[CreateClinic] specialties insert failed:", specErr.message);
          }
        } catch (specError) {
          console.warn("[CreateClinic] specialties insert error:", specError);
        }
      }

      // ── 4. Navigate away ────────────────────────────────────────
      if (mountedRef.current) {
        navigate("/massage-clinics", { 
          replace: true, 
          state: { 
            created: true,
            clinicId: clinic?.id 
          } 
        });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      console.error("[CreateClinic] submit error:", err);
      
      let errorMessage = "Failed to create clinic. Please try again.";
      
      if (err?.message) {
        errorMessage = err.message;
      } else if (!navigator.onLine) {
        errorMessage = "You're offline. Please connect to the internet and try again.";
      }
      
      setSubmitError(errorMessage);
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }, [form, hours, loc.address, loc.coords, navigate, user, validate, connectionStatus]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gray-50 pb-32">

      {/* ── Connection Status Banner ── */}
      {connectionStatus !== "connected" && (
        <div className={`w-full px-4 py-2 text-center text-sm font-medium ${
          connectionStatus === "offline" 
            ? "bg-red-100 text-red-800" 
            : "bg-yellow-100 text-yellow-800"
        }`}>
          {connectionStatus === "offline" 
            ? "You're offline. Please connect to the internet." 
            : "Connection issues detected. Some features may not work properly."}
        </div>
      )}

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

      <form onSubmit={handleSubmit} noValidate
        className="mx-auto max-w-lg px-4 pt-6 space-y-6">

        {/* ── Cover photo ── */}
        <Section title="Cover Photo" subtitle="Optional — helps attract clients">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={connectionStatus === "offline"}
            className="relative w-full overflow-hidden rounded-2xl border-2 border-dashed
              border-gray-200 bg-white transition-colors hover:border-violet-300
              hover:bg-violet-50/30 focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-violet-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {form.coverPreview ? (
              <img src={form.coverPreview} alt="Cover preview"
                className="h-44 w-full object-cover" />
            ) : (
              <div className="flex h-44 flex-col items-center justify-center gap-2 text-gray-400">
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
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden" onChange={handleCoverChange} />
          {errors.cover && <FieldError>{errors.cover}</FieldError>}
          {form.coverPreview && (
            <button type="button"
              onClick={() => {
                URL.revokeObjectURL(form.coverPreview);
                createdObjectURLs.current.delete(form.coverPreview);
                setForm((p) => ({ ...p, coverFile: null, coverPreview: null }));
              }}
              className="mt-1 text-xs text-red-500 hover:underline">
              Remove photo
            </button>
          )}
        </Section>

        {/* ── Basic info ── */}
        <Section title="Basic Info">
          <Field label="Clinic Name" required error={errors.name}>
            <input type="text" value={form.name} maxLength={120}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Serenity Wellness Spa"
              className={inputCls(errors.name)} />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input type="tel" value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
              className={inputCls(errors.phone)} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="hello@yourclinic.com"
              className={inputCls(errors.email)} />
          </Field>
          <Field label="Website">
            <input type="url" value={form.website}
              onChange={(e) => setField("website", e.target.value)}
              placeholder="https://yourclinic.com"
              className={inputCls()} />
          </Field>
        </Section>

        {/* ── Location ── */}
        <Section title="Location" subtitle="Enter an address or use your current location">
          <button type="button" onClick={loc.useMyLocation}
            disabled={loc.geoStatus === "loading" || connectionStatus === "offline"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl
              border border-violet-200 bg-violet-50 py-3 text-sm font-semibold
              text-violet-700 transition-colors hover:bg-violet-100
              disabled:opacity-60 disabled:cursor-not-allowed">
            {loc.geoStatus === "loading" ? (
              <><Spinner className="h-4 w-4" /> Detecting location…</>
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

          {loc.geoError && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs text-amber-700">{loc.geoError}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400">or enter manually</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <Field label="Address" required error={errors.address || errors.coords}>
            <div className="flex gap-2">
              <input type="text" value={loc.address}
                onChange={(e) => { loc.setAddress(e.target.value); setErrors((p) => ({ ...p, address: "", coords: "" })); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); loc.confirmAddress(); } }}
                placeholder="123 Main St, City, Country"
                className={`flex-1 ${inputCls(errors.address || errors.coords)}`} />
              <button type="button" onClick={loc.confirmAddress}
                disabled={loc.geocoding || !loc.address.trim() || connectionStatus === "offline"}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-2xl
                  bg-violet-600 px-4 py-3 text-sm font-semibold text-white
                  transition-colors hover:bg-violet-700
                  disabled:opacity-50 disabled:cursor-not-allowed">
                {loc.geocoding ? <Spinner className="h-4 w-4" /> : "Confirm"}
              </button>
            </div>
            {loc.geocodeErr && <FieldError>{loc.geocodeErr}</FieldError>}
          </Field>

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
              <button type="button" onClick={loc.clearLocation}
                className="text-xs text-green-600 hover:text-green-800 hover:underline">
                Clear
              </button>
            </div>
          )}
        </Section>

        {/* ── About ── */}
        <Section title="About">
          <Field label="Description">
            <textarea value={form.description} rows={4} maxLength={1000}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Tell potential clients about your clinic, services, and what makes you special…"
              className={`resize-none ${inputCls()}`} />
            <p className="mt-1 text-right text-xs text-gray-400">
              {form.description.length}/1000
            </p>
          </Field>
        </Section>

        {/* ── Opening Hours ── */}
        <Section
          title="Opening Hours"
          subtitle="Toggle days and choose opening & closing times"
        >
          <OpeningHoursPicker value={hours} onChange={setHours} />
        </Section>

        {/* ── Specialties ── */}
        <Section title="Specialties" subtitle="Select all that apply">
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((s) => {
              const active = form.specialties.includes(s);
              return (
                <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                  className={[
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                    active
                      ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50",
                  ].join(" ")}>
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
        <button type="submit" disabled={submitting || connectionStatus === "offline"}
          className="w-full rounded-2xl bg-violet-600 py-4 text-base font-bold
            text-white shadow-sm transition-all hover:bg-violet-700
            active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed">
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="h-5 w-5" />
              Creating listing…
            </span>
          ) : (
            "Create Clinic Listing"
          )}
        </button>

        <button type="button" onClick={() => navigate(-1)}
          className="w-full py-3 text-sm font-medium text-gray-500
            hover:text-gray-700 transition-colors">
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
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

function FieldError({ children }) {
  return (
    <p className="mt-1 text-xs font-medium text-red-500" role="alert">{children}</p>
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