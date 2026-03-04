import { supabase } from "../../api/lib/supabase";

export async function saveBrowserLocationToProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const pos = await new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
  const { latitude, longitude } = pos.coords;
  await supabase.from("profiles").update({ lat: latitude, lng: longitude }).eq("id", user.id).throwOnError?.();
  return { lat: latitude, lng: longitude };
}