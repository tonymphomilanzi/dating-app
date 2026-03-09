// src/utils/location.js
import { supabase } from "../lib/supabase.client.js";

export async function saveBrowserLocationToProfile() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      return reject(new Error("Geolocation not supported"));
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData?.session?.user?.id;

          if (!userId) {
            return reject(new Error("Not authenticated"));
          }

          // Only update lat and lng (no location_updated_at column)
          const { error } = await supabase
            .from("profiles")
            .update({ lat, lng })
            .eq("id", userId);

          if (error) {
            return reject(new Error(error.message));
          }

          resolve({ lat, lng });
        } catch (err) {
          reject(err);
        }
      },
      (err) => {
        reject(new Error(err.message || "Could not get location"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}

export async function updateProfileLocation(lat, lng) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Only update lat and lng
  const { error } = await supabase
    .from("profiles")
    .update({ lat, lng })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return { lat, lng };
}