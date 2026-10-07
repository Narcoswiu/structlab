import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "student";
  /** избраната от потребителя специалност */
  specialtyId: string | null;
};

/**
 * Влезлият потребител или null. `cache` пази резултата за една заявка, така че
 * layout-ът и страницата не питат базата два пъти.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  // getUser() проверява сесията при Supabase – не вярваме сляпо на бисквитката.
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, specialty_id")
    .eq("id", data.user.id)
    .single();
  if (!profile) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
    specialtyId: profile.specialty_id,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** За чужди хора /admin изглежда като несъществуваща страница. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  return user;
}

/** Пуска само вътрешни адреси като „следваща страница“ (без //evil.com). */
export function safeNextPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
