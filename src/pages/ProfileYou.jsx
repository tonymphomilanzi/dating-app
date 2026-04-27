// src/pages/ProfileYou.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar.jsx";
import Button from "../components/Button.jsx";
import TextField from "../components/TextField.jsx";
import Tag from "../components/Tag.jsx";
import { supabase } from "../lib/supabase.client.js";
import { useAuth } from "../contexts/AuthContext.jsx";

/* ================================================================
   CONSTANTS
   ================================================================ */

const MAX_BIO_LENGTH = 500;
const MAX_PHOTOS = 9;
const PHOTO_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const REQUEST_TIMEOUT = 10000;

/* ================================================================
   UTILITIES
   ================================================================ */

const sanitizeName = (name) => String(name).replace(/[^A-Za-z0-9._-]+/g, "-");

const withTimeout = (promise, ms, label = "request") => {
  let timer;
  const race = Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
  return race.finally(() => clearTimeout(timer));
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/* ================================================================
   SKELETON COMPONENTS
   ================================================================ */

const Skeleton = {
  Block: ({ className = "" }) => (
    <div className={`animate-pulse rounded-xl bg-gray-200 ${className}`} />
  ),
  
  Line: ({ width = "w-40", height = "h-4", className = "" }) => (
    <div className={`animate-pulse rounded-full ${width} ${height} bg-gray-200 ${className}`} />
  ),
  
  Chip: () => (
    <div className="h-8 w-20 animate-pulse rounded-full bg-gray-200" />
  ),
  
  Card: ({ children, className = "" }) => (
    <div className={`rounded-2xl bg-white p-5 shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  ),
  
  PhotoGrid: () => (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="aspect-square animate-pulse rounded-2xl bg-gray-200" />
      ))}
    </div>
  ),
};

/* ================================================================
   PHOTO TILE COMPONENT
   ================================================================ */

function PhotoTile({ src, label, isPrimary, onMakePrimary, onDelete }) {
  const [imageError, setImageError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this photo?")) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (imageError) {
    return (
      <div className="aspect-square rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <i className="lni lni-image text-2xl block mb-1" />
          <span className="text-xs">Failed to load</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-all">
      <img
        src={src}
        alt={`Photo ${label}`}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
        draggable={false}
        onError={() => setImageError(true)}
        loading="lazy"
      />
      
      {/* Primary badge */}
      {isPrimary && (
        <div className="absolute top-2 left-2 rounded-full bg-violet-600 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
          Primary
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center gap-2">
          {!isPrimary && (
            <button
              onClick={onMakePrimary}
              className="flex-1 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-white active:scale-95 transition-all shadow-lg"
            >
              <i className="lni lni-star mr-1" />
              Make Primary
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-xl bg-red-500/95 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 active:scale-95 transition-all shadow-lg disabled:opacity-50"
          >
            <i className="lni lni-trash-can" />
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

/* ================================================================
   HERO SECTION COMPONENT
   ================================================================ */

function HeroSection({ 
  heroUrl, 
  displayName, 
  completeness, 
  loading, 
  onPreview, 
  onAddPhotos 
}) {
  return (
    <div className="relative h-[42vh] w-full overflow-hidden bg-gradient-to-br from-violet-100 via-fuchsia-100 to-pink-100">
      {/* Background image */}
      {loading ? (
        <Skeleton.Block className="absolute inset-0" />
      ) : heroUrl ? (
        <>
          <img
            src={heroUrl}
            alt="Profile"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10" />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-violet-400">
            <i className="lni lni-image text-6xl mb-3 block" />
            <p className="text-sm font-medium">Add your primary photo</p>
            <p className="text-xs text-violet-400/70 mt-1">Make a great first impression!</p>
          </div>
        </div>
      )}

      {/* Top actions */}
      <div className="absolute inset-x-0 top-0 p-4 safe-top">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-full bg-black/40 backdrop-blur-md px-3.5 py-2 border border-white/20">
            <span className="text-xs font-semibold text-white">Edit Profile</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onPreview}
              className="rounded-full bg-black/40 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white hover:bg-black/50 active:scale-95 transition-all border border-white/20"
            >
              <i className="lni lni-eye mr-1.5" />
              Preview
            </button>
            <button
              onClick={onAddPhotos}
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-white/90 active:scale-95 transition-all shadow-lg"
            >
              <i className="lni lni-camera mr-1.5" />
              Add Photos
            </button>
          </div>
        </div>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 safe-bottom">
        <div className="text-white">
          <h1 className="text-3xl font-bold mb-1 drop-shadow-lg">
            {displayName || "Your Name"}
          </h1>
          
          {/* Profile completeness */}
          <div className="mt-4 rounded-2xl bg-black/40 backdrop-blur-md p-4 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Profile Strength</span>
              <span className="text-sm font-bold">{completeness.score}%</span>
            </div>
            
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
                style={{ width: `${completeness.score}%` }}
              />
            </div>
            
            {completeness.hints.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {completeness.hints.slice(0, 3).map((hint, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-white/90">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
                    <span>{hint}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function ProfileYou() {
  const navigate = useNavigate();
  const { profile: me, user, signOut, reloadProfile } = useAuth();

  // ── UI State ───────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ── Form Fields ────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [profession, setProfession] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  // ── Original values (for change detection) ────────────────────
  const originalValuesRef = useRef({});

  // ── Interests ──────────────────────────────────────────────────
  const [allInterests, setAllInterests] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [savingInterests, setSavingInterests] = useState(false);

  // ── Photos ─────────────────────────────────────────────────────
  const [heroUrl, setHeroUrl] = useState(null);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Geolocation ────────────────────────────────────────────────
  const [locating, setLocating] = useState(false);

  // ── Logout ─────────────────────────────────────────────────────
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Toast Helper ───────────────────────────────────────────────
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(""), 3000);
  }, []);

  // ── Check for Unsaved Changes ──────────────────────────────────
  useEffect(() => {
    const hasChanges =
      displayName !== originalValuesRef.current.displayName ||
      profession !== originalValuesRef.current.profession ||
      city !== originalValuesRef.current.city ||
      bio !== originalValuesRef.current.bio;

    setHasUnsavedChanges(hasChanges);
  }, [displayName, profession, city, bio]);

  // ── Warn Before Leaving ────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ── Load Profile Data ──────────────────────────────────────────
  useEffect(() => {
    if (!me?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const requestId = ++requestIdRef.current;

    const loadProfile = async () => {
      try {
        setError("");

        // Fetch profile
        const { data: profile, error: profileError } = await withTimeout(
          supabase
            .from("profiles")
            .select("id, display_name, profession, bio, city, avatar_url, lat, lng")
            .eq("id", me.id)
            .maybeSingle(),
          REQUEST_TIMEOUT,
          "profile"
        );

        if (profileError) throw profileError;

        // Fetch interests catalog
        const { data: interests } = await withTimeout(
          supabase
            .from("interests")
            .select("id, label")
            .order("label", { ascending: true }),
          REQUEST_TIMEOUT,
          "interests"
        );

        // Fetch user's interests
        const { data: userInterests } = await withTimeout(
          supabase
            .from("user_interests")
            .select("interests:interests(label)")
            .eq("user_id", me.id),
          REQUEST_TIMEOUT,
          "user_interests"
        );

        // Fetch photos
        const { data: photos } = await withTimeout(
          supabase
            .from("photos")
            .select("path, is_primary, sort, created_at")
            .eq("user_id", me.id)
            .order("is_primary", { ascending: false })
            .order("sort", { ascending: true })
            .order("created_at", { ascending: true }),
          REQUEST_TIMEOUT,
          "photos"
        );

        if (cancelled || requestIdRef.current !== requestId || !mountedRef.current) {
          return;
        }

        // Set form values
        const name = profile?.display_name || "";
        const prof = profile?.profession || "";
        const cty = profile?.city || "";
        const bioText = profile?.bio || "";

        setDisplayName(name);
        setProfession(prof);
        setCity(cty);
        setBio(bioText);

        // Store original values
        originalValuesRef.current = {
          displayName: name,
          profession: prof,
          city: cty,
          bio: bioText,
        };

        // Set interests
        setAllInterests(interests || []);
        setSelectedInterests(
          (userInterests || [])
            .map((r) => r.interests?.label)
            .filter(Boolean)
        );

        // Process photos
        const uniquePhotos = Array.from(
          new Map((photos || []).map((p) => [p.path, p])).values()
        );

        const getPublicUrl = (path) => {
          const { data } = supabase.storage.from("profiles").getPublicUrl(path);
          return data?.publicUrl || null;
        };

        const primaryPhoto = uniquePhotos.find((p) => p.is_primary) || uniquePhotos[0];
        const hero = primaryPhoto?.path
          ? getPublicUrl(primaryPhoto.path)
          : profile?.avatar_url || null;

        const gallery = uniquePhotos
          .filter((p) => p.path !== primaryPhoto?.path)
          .map((p) => ({
            url: getPublicUrl(p.path),
            path: p.path,
          }))
          .filter((p) => p.url);

        setHeroUrl(hero);
        setGalleryPhotos(gallery);
      } catch (err) {
        console.error("[ProfileYou] Load error:", err);
        if (requestIdRef.current === requestId) {
          setError(err.message || "Failed to load profile");
        }
      } finally {
        if (!cancelled && requestIdRef.current === requestId && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [me?.id]);

  // ── Profile Completeness ───────────────────────────────────────
  const completeness = useMemo(() => {
    let score = 0;
    const hints = [];

    if (displayName?.trim()) {
      score += 20;
    } else {
      hints.push("Add your name");
    }

    if (heroUrl) {
      score += 30;
    } else {
      hints.push("Add a primary photo");
    }

    if (selectedInterests.length >= 3) {
      score += 20;
    } else {
      hints.push(`Pick ${3 - selectedInterests.length} more interest${3 - selectedInterests.length !== 1 ? "s" : ""}`);
    }

    if (bio?.trim() && bio.length >= 50) {
      score += 15;
    } else if (bio?.trim()) {
      score += 10;
      hints.push("Write a longer bio (50+ characters)");
    } else {
      hints.push("Write a bio about yourself");
    }

    if (city?.trim()) {
      score += 10;
    } else {
      hints.push("Add your city");
    }

    if (profession?.trim()) {
      score += 5;
    } else {
      hints.push("Add your profession");
    }

    if (galleryPhotos.length >= 3) {
      score += 10;
    } else {
      hints.push(`Add ${3 - galleryPhotos.length} more photo${3 - galleryPhotos.length !== 1 ? "s" : ""}`);
    }

    return { score: Math.min(score, 100), hints };
  }, [displayName, heroUrl, selectedInterests.length, bio, city, profession, galleryPhotos.length]);

  // ── Save Profile ───────────────────────────────────────────────
  const saveProfile = async () => {
    if (!me?.id) return;

    // Validation
    if (!displayName.trim()) {
      setError("Please enter your name");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          profession: profession.trim() || null,
          city: city.trim() || null,
          bio: bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", me.id);

      if (updateError) throw updateError;

      // Update original values
      originalValuesRef.current = {
        displayName,
        profession,
        city,
        bio,
      };

      await reloadProfile();
      showToast("Profile saved successfully!");
    } catch (err) {
      console.error("[ProfileYou] Save error:", err);
      setError(err.message || "Failed to save profile");
      showToast("Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Set Location ───────────────────────────────────────────────
  const setMyLocation = async () => {
    if (!me?.id) return;

    setLocating(true);
    setError("");

    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported"));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude } = position.coords;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          lat: latitude,
          lng: longitude,
          location_updated_at: new Date().toISOString(),
        })
        .eq("id", me.id);

      if (updateError) throw updateError;

      await reloadProfile();
      showToast("Location updated!");
    } catch (err) {
      console.error("[ProfileYou] Location error:", err);
      setError(err.message || "Failed to get location");
      showToast("Could not get location", "error");
    } finally {
      setLocating(false);
    }
  };

  // ── Toggle Interest ────────────────────────────────────────────
  const toggleInterest = useCallback((label) => {
    setSelectedInterests((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  }, []);

  // ── Save Interests ─────────────────────────────────────────────
  const saveInterests = async () => {
    if (!me?.id) return;

    setSavingInterests(true);
    setError("");

    try {
      const { data: catalog } = await supabase
        .from("interests")
        .select("id, label");

      const labelToId = Object.fromEntries(
        (catalog || []).map((i) => [String(i.label).toLowerCase(), i.id])
      );

      const interestIds = selectedInterests
        .map((label) => labelToId[String(label).toLowerCase()])
        .filter(Boolean);

      // Delete existing interests
      const { error: deleteError } = await supabase
        .from("user_interests")
        .delete()
        .eq("user_id", me.id);

      if (deleteError) throw deleteError;

      // Insert new interests
      if (interestIds.length > 0) {
        const { error: insertError } = await supabase
          .from("user_interests")
          .insert(
            interestIds.map((id) => ({
              user_id: me.id,
              interest_id: id,
            }))
          );

        if (insertError) throw insertError;
      }

      showToast("Interests saved!");
    } catch (err) {
      console.error("[ProfileYou] Save interests error:", err);
      setError(err.message || "Failed to save interests");
      showToast("Failed to save interests", "error");
    } finally {
      setSavingInterests(false);
    }
  };

  // ── Photo Upload ───────────────────────────────────────────────
  const handlePhotoUpload = async (files) => {
    if (!files?.length || !user?.id) return;

    // Validation
    const totalPhotos = (heroUrl ? 1 : 0) + galleryPhotos.length + files.length;
    if (totalPhotos > MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos allowed`);
      showToast(`Maximum ${MAX_PHOTOS} photos allowed`, "error");
      return;
    }

    // Validate files
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError(`Only JPEG, PNG, and WebP images are allowed`);
        showToast("Invalid file type", "error");
        return;
      }

      if (file.size > PHOTO_MAX_SIZE) {
        setError(`Photos must be smaller than ${formatFileSize(PHOTO_MAX_SIZE)}`);
        showToast("File too large", "error");
        return;
      }
    }

    setUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      const uploadedPhotos = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${user.id}/${Date.now()}-${sanitizeName(file.name)}`;

        // Update progress
        setUploadProgress(Math.round(((i + 0.5) / files.length) * 100));

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("profiles")
          .upload(fileName, file, { upsert: false });

        if (uploadError) throw uploadError;

        // Insert into database
        const { error: insertError } = await supabase.from("photos").insert({
          user_id: user.id,
          path: fileName,
          is_primary: false,
        });

        if (insertError) throw insertError;

        const { data } = supabase.storage.from("profiles").getPublicUrl(fileName);
        const url = data?.publicUrl;

        if (url) {
          uploadedPhotos.push({ url, path: fileName });
        }

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      // If no hero photo, make first upload primary
      if (!heroUrl && uploadedPhotos.length > 0) {
        await makePrimaryPhoto(uploadedPhotos[0].path, true);
      } else {
        // Add to gallery
        setGalleryPhotos((prev) => [...prev, ...uploadedPhotos]);
      }

      showToast(`${uploadedPhotos.length} photo${uploadedPhotos.length !== 1 ? "s" : ""} uploaded!`);
    } catch (err) {
      console.error("[ProfileYou] Upload error:", err);
      setError(err.message || "Failed to upload photos");
      showToast("Upload failed", "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ── Make Photo Primary ─────────────────────────────────────────
  const makePrimaryPhoto = async (path, silent = false) => {
    if (!user?.id) return;

    try {
      // Demote all photos
      await supabase
        .from("photos")
        .update({ is_primary: false })
        .eq("user_id", user.id);

      // Promote selected photo
      const { error: updateError } = await supabase
        .from("photos")
        .update({ is_primary: true })
        .eq("user_id", user.id)
        .eq("path", path);

      if (updateError) throw updateError;

      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const url = data?.publicUrl;

      // Update avatar_url in profile
      await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);

      // Update local state
      const oldHero = heroUrl;
      setHeroUrl(url);

      // Move old hero to gallery if it exists
      if (oldHero) {
        const oldPath = extractPathFromUrl(oldHero);
        if (oldPath) {
          setGalleryPhotos((prev) => [
            { url: oldHero, path: oldPath },
            ...prev.filter((p) => p.url !== url),
          ]);
        }
      } else {
        setGalleryPhotos((prev) => prev.filter((p) => p.url !== url));
      }

      if (!silent) {
        showToast("Primary photo updated!");
      }
    } catch (err) {
      console.error("[ProfileYou] Set primary error:", err);
      if (!silent) {
        setError(err.message || "Failed to set primary photo");
        showToast("Failed to set primary photo", "error");
      }
    }
  };

  // ── Delete Photo ───────────────────────────────────────────────
  const deletePhoto = async (path) => {
    if (!me?.id) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("profiles")
        .remove([path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("photos")
        .delete()
        .eq("path", path)
        .eq("user_id", me.id);

      if (dbError) throw dbError;

      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const url = data?.publicUrl;

      // Update local state
      if (url === heroUrl) {
        setHeroUrl(null);
        await supabase
          .from("profiles")
          .update({ avatar_url: null })
          .eq("id", me.id);
      } else {
        setGalleryPhotos((prev) => prev.filter((p) => p.path !== path));
      }

      showToast("Photo deleted");
    } catch (err) {
      console.error("[ProfileYou] Delete photo error:", err);
      setError(err.message || "Failed to delete photo");
      showToast("Failed to delete photo", "error");
    }
  };

  // ── Extract Path from URL ──────────────────────────────────────
  const extractPathFromUrl = (url) => {
    const marker = "/public/profiles/";
    const index = url.lastIndexOf(marker);
    if (index === -1) return null;
    return url.slice(index + marker.length);
  };

  // ── Logout ─────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Are you sure you want to log out?")) {
        return;
      }
    } else {
      if (!confirm("Are you sure you want to log out?")) {
        return;
      }
    }

    try {
      setLoggingOut(true);
      await signOut();
      navigate("/auth", { replace: true });
    } catch (err) {
      console.error("[ProfileYou] Logout error:", err);
      setError(err.message || "Failed to log out");
      showToast("Failed to log out", "error");
    } finally {
      setLoggingOut(false);
    }
  };

  // ── Preview Profile ────────────────────────────────────────────
  const previewProfile = useCallback(() => {
    if (me?.id) {
      navigate(`/profile/${me.id}`);
    }
  }, [me?.id, navigate]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Top Bar */}
      <TopBar title="" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 animate-in slide-in-from-top duration-300">
          <div
            className={`rounded-2xl px-5 py-3 shadow-2xl backdrop-blur-xl border ${
              toast.type === "error"
                ? "bg-red-500/95 border-red-600 text-white"
                : "bg-white/95 border-gray-200 text-gray-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "error" ? (
                <i className="lni lni-cross-circle text-lg" />
              ) : (
                <i className="lni lni-checkmark-circle text-lg text-green-600" />
              )}
              <span className="text-sm font-semibold">{toast.message}</span>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <HeroSection
        heroUrl={heroUrl}
        displayName={displayName}
        completeness={completeness}
        loading={loading}
        onPreview={previewProfile}
        onAddPhotos={() => fileInputRef.current?.click()}
      />

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => handlePhotoUpload(Array.from(e.target.files || []))}
        className="hidden"
      />

      {/* Main Content */}
      <div className="-mt-6 space-y-5 px-4 pb-6">
        {/* Error Alert */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <i className="lni lni-warning text-xl text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-0.5">{error}</p>
              </div>
              <button
                onClick={() => setError("")}
                className="text-red-400 hover:text-red-600"
              >
                <i className="lni lni-close" />
              </button>
            </div>
          </div>
        )}

        {/* Unsaved Changes Warning */}
        {hasUnsavedChanges && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <i className="lni lni-information text-xl text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">Unsaved Changes</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Don't forget to save your changes!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-violet-900">
                Uploading photos...
              </span>
              <span className="text-sm font-bold text-violet-600">
                {uploadProgress}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-violet-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Basic Information Card */}
        <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Basic Information</h2>
            {saving && (
              <span className="text-xs text-violet-600 font-medium">
                <i className="lni lni-spinner-arrow animate-spin mr-1" />
                Saving...
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton.Line width="w-full" height="h-12" />
              <Skeleton.Line width="w-full" height="h-12" />
              <Skeleton.Line width="w-full" height="h-12" />
              <Skeleton.Line width="w-full" height="h-32" />
            </div>
          ) : (
            <div className="space-y-4">
              <TextField
                label="Name *"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
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
                  className="self-end rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Use my current location"
                >
                  <i className={`lni ${locating ? "lni-spinner-arrow animate-spin" : "lni-map-marker"}`} />
                </button>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900 block mb-2">
                  About You
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                  placeholder="Tell people about yourself, your hobbies, what you're looking for..."
                  rows={5}
                  maxLength={MAX_BIO_LENGTH}
                  className="w-full rounded-xl border border-gray-200 p-4 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200 resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">
                    {bio.length >= 50 ? "Great!" : "Write at least 50 characters"}
                  </span>
                  <span className={`text-xs font-medium ${bio.length >= MAX_BIO_LENGTH ? "text-red-600" : "text-gray-400"}`}>
                    {bio.length}/{MAX_BIO_LENGTH}
                  </span>
                </div>
              </div>

              <Button
                onClick={saveProfile}
                disabled={saving || loading || !displayName.trim()}
                className="w-full !bg-gradient-to-r !from-violet-600 !to-fuchsia-600 !font-bold"
              >
                {saving ? (
                  <>
                    <i className="lni lni-spinner-arrow animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="lni lni-save mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </section>

        {/* Interests Card */}
        <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Interests</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedInterests.length} selected • Pick at least 3
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton.Chip key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {allInterests.map((interest) => (
                  <Tag
                    key={interest.id}
                    label={interest.label}
                    active={selectedInterests.includes(interest.label)}
                    onClick={() => toggleInterest(interest.label)}
                  />
                ))}
              </div>

              <Button
                onClick={saveInterests}
                disabled={savingInterests || loading || selectedInterests.length === 0}
                className="w-full"
              >
                {savingInterests ? (
                  <>
                    <i className="lni lni-spinner-arrow animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="lni lni-save mr-2" />
                    Save Interests
                  </>
                )}
              </Button>
            </>
          )}
        </section>

        {/* Photo Gallery Card */}
        <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Photo Gallery</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {(heroUrl ? 1 : 0) + galleryPhotos.length}/{MAX_PHOTOS} photos
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || (heroUrl ? 1 : 0) + galleryPhotos.length >= MAX_PHOTOS}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="lni lni-plus mr-1.5" />
              Add Photos
            </button>
          </div>

          {loading ? (
            <Skeleton.PhotoGrid />
          ) : galleryPhotos.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <i className="lni lni-image text-5xl text-gray-300 block mb-3" />
              <p className="text-sm font-semibold text-gray-700 mb-1">
                No gallery photos yet
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Add more photos to showcase your personality
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-200 active:scale-95 transition-all"
              >
                <i className="lni lni-upload mr-1.5" />
                Upload Photos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {galleryPhotos.map((photo, index) => (
                <PhotoTile
                  key={photo.path}
                  src={photo.url}
                  label={index + 1}
                  isPrimary={false}
                  onMakePrimary={() => makePrimaryPhoto(photo.path)}
                  onDelete={() => deletePhoto(photo.path)}
                />
              ))}
            </div>
          )}

          {galleryPhotos.length > 0 && (
            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-3">
              <div className="flex items-start gap-2">
                <i className="lni lni-bulb text-blue-600 mt-0.5" />
                <p className="text-xs text-blue-900">
                  <span className="font-semibold">Tip:</span> Add at least 5 photos to increase your profile views by 3x!
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Account Settings Card */}
        <section className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-4">Account</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={previewProfile}
              className="w-full !bg-white !text-gray-900 border border-gray-200 hover:!bg-gray-50"
            >
              <i className="lni lni-eye mr-2" />
              Preview Profile
            </Button>

            <Button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full !bg-red-600 !text-white hover:!bg-red-700"
            >
              {loggingOut ? (
                <>
                  <i className="lni lni-spinner-arrow animate-spin mr-2" />
                  Logging out...
                </>
              ) : (
                <>
                  <i className="lni lni-exit mr-2" />
                  Log Out
                </>
              )}
            </Button>
          </div>

          <div className="mt-4 rounded-xl bg-gray-50 p-3 border border-gray-100">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Account Email:</span>{" "}
              {user?.email || "Not available"}
            </p>
          </div>
        </section>

        {/* Help Section */}
        <section className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-5 border border-violet-100">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <i className="lni lni-heart-filled text-violet-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                Make your profile stand out!
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Complete your profile to {completeness.score}% to get 5x more matches.
                Add more photos, write a compelling bio, and pick interests that show your personality.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}