import { getSupabaseBrowser } from "./supabaseBrowser";

export async function getSessionUser() {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { user: null, error: new Error("Supabase is not configured") };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user: null, error };
  return { user: data.user, error: null };
}

export async function getMyProfile() {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { profile: null, user: null };
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return { profile: null, user: null };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,email,role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  return { profile: profile ?? null, user };
}
