import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase.client.js";
import GalleryViewer from "../components/GalleryViewer.jsx";

export default function ProfileGallery() {
  const nav = useNavigate();
  const { id } = useParams();
  const loc = useLocation();
  const stateImages = loc.state?.images || null;
  const stateName = loc.state?.name || null;

  const [images, setImages] = useState(stateImages || []);
  const [name, setName] = useState(stateName || "");
  const [loading, setLoading] = useState(!stateImages);
  const idxParam = new URLSearchParams(window.location.search).get("i");
  const initialIndex = useMemo(() => Math.max(0, parseInt(idxParam || "0", 10) || 0), [idxParam]);

  useEffect(() => {
    if (stateImages) return; // already have everything
    let cancelled = false;
    (async () => {
      try {
        // profile name
        const { data: p } = await supabase
          .from("profile_public")
          .select("display_name")
          .eq("id", id)
          .maybeSingle();
        if (!cancelled) setName(p?.display_name || "Photo");

        // photos
        const { data: photos } = await supabase
          .from("photos")
          .select("path, is_primary, sort, created_at")
          .eq("user_id", id)
          .order("is_primary", { ascending: false })
          .order("sort", { ascending: true })
          .order("created_at", { ascending: true });

        // de-dupe + map to urls
        const byPath = new Map();
        for (const ph of photos || []) if (!byPath.has(ph.path)) byPath.set(ph.path, ph);
        const unique = Array.from(byPath.values());
        const toUrl = (path) => supabase.storage.from("profiles").getPublicUrl(path)?.data?.publicUrl || null;

        // hero first if primary exists
        const primary = unique.find(ph => ph.is_primary) || unique[0];
        const hero = primary?.path ? toUrl(primary.path) : null;
        const rest = unique
          .filter(ph => ph.path !== primary?.path)
          .map(ph => toUrl(ph.path))
          .filter(Boolean);

        const pics = [hero, ...rest].filter(Boolean);
        if (!cancelled) setImages(pics);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, stateImages]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-gray-600">Loading…</div>
    );
  }

  return (
    <GalleryViewer
      images={images}
      initialIndex={initialIndex}
      name={name || "Photo"}
      onClose={() => nav(-1)}
    />
  );
}