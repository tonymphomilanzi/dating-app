import { supabase } from "../../api/lib/supabase";

export async function uploadProfilePhoto(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const path = `${user.id}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("profiles").upload(path, file, { upsert: false });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage.from("profiles").getPublicUrl(path);

  // Save photo row and set as avatar_url
  await supabase.from("photos").insert({ user_id: user.id, path, is_primary: true }).throwOnError();
  await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id).throwOnError();

  return publicUrl;
}