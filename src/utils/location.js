// src/utils/location.js
import { supabase } from "../lib/supabase.client.js";

export async function saveBrowserLocationToProfile() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      return reject(new Error("Geolocation not supported"));
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user?.id) {
          return reject(new Error("Not authenticated"));
        }

        const { error } = await supabase
          .from("profiles")
          .update({ 
            lat, 
            lng, 
            location_updated_at: new Date().toISOString() 
          })
          .eq("id", session.session.user.id);

        if (error) {
          return reject(new Error(error.message));
        }

        resolve({ lat, lng });
      },
      (err) => {
        reject(new Error(err.message || "Could not get location"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}

export async function updateProfileLocation(lat, lng) {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ 
      lat, 
      lng, 
      location_updated_at: new Date().toISOString() 
    })
    .eq("id", session.session.user.id);

  if (error) {
    throw new Error(error.message);
  }

  return { lat, lng };
}