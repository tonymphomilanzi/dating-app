import { supabase } from "../../api/lib/supabase";

export const prefsService = {
  get: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("preferences")
      .select("interested_in, distance_km, min_age, max_age")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    // default sanity
    return {
      interested_in: data?.interested_in || "everyone",
      distance_km: data?.distance_km ?? 50,
      min_age: data?.min_age ?? 18,
      max_age: data?.max_age ?? 99,
    };
  },
  save: async (payload) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    // upsert by user_id
    const { error } = await supabase
      .from("preferences")
      .upsert({ user_id: user.id, ...payload }, { onConflict: "user_id" });
    if (error) throw error;
    return true;
  },
};