import { supabase } from "./supabaseClient";

export interface ProfileData {
  xp: number;
  level: number;
  currentTitleId: string | null;
  badges: { key: string; name: string; description: string; rarity: string; unlockedAt: string }[];
  achievements: { key: string; name: string; description: string; unlockedAt: string }[];
  titles: { id: string; key: string; name: string; unlockedAt: string }[];
}

export async function loadProfile(userId: string): Promise<ProfileData> {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("xp, level, current_title_id")
    .eq("id", userId)
    .single();
  if (userError) throw userError;

  const [{ data: badgeRows }, { data: achievementRows }, { data: titleRows }] = await Promise.all([
    supabase
      .from("user_badges")
      .select("unlocked_at, badges(key, name, description, rarity)")
      .eq("user_id", userId),
    supabase
      .from("user_achievements")
      .select("unlocked_at, achievements(key, name, description)")
      .eq("user_id", userId),
    supabase.from("user_titles").select("unlocked_at, titles(id, key, name)").eq("user_id", userId),
  ]);

  interface BadgeRow {
    unlocked_at: string;
    badges: { key: string; name: string; description: string; rarity: string };
  }
  interface AchievementRow {
    unlocked_at: string;
    achievements: { key: string; name: string; description: string };
  }
  interface TitleRow {
    unlocked_at: string;
    titles: { id: string; key: string; name: string };
  }

  return {
    xp: user.xp,
    level: user.level,
    currentTitleId: user.current_title_id,
    badges: ((badgeRows ?? []) as unknown as BadgeRow[]).map((r) => ({
      key: r.badges.key,
      name: r.badges.name,
      description: r.badges.description,
      rarity: r.badges.rarity,
      unlockedAt: r.unlocked_at,
    })),
    achievements: ((achievementRows ?? []) as unknown as AchievementRow[]).map((r) => ({
      key: r.achievements.key,
      name: r.achievements.name,
      description: r.achievements.description,
      unlockedAt: r.unlocked_at,
    })),
    titles: ((titleRows ?? []) as unknown as TitleRow[]).map((r) => ({
      id: r.titles.id,
      key: r.titles.key,
      name: r.titles.name,
      unlockedAt: r.unlocked_at,
    })),
  };
}

export async function setActiveTitle(userId: string, titleId: string | null): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ current_title_id: titleId })
    .eq("id", userId);
  if (error) throw error;
}
