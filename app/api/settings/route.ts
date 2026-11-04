import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, MEAL_TYPES, Settings, validCurrency, validTime, validTimeZone } from "@/lib/types";

export async function PUT(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const list = (v: any) => (Array.isArray(v) ? v.map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 40) : []);
  const s: Settings = {
    exclusions: list(b.exclusions),
    diet: String(b.diet ?? DEFAULT_SETTINGS.diet).slice(0, 1000),
    cuisines: list(b.cuisines),
    location: String(b.location ?? DEFAULT_SETTINGS.location).slice(0, 300),
    notes: String(b.notes ?? DEFAULT_SETTINGS.notes).slice(0, 1000),
    meals: list(b.meals).filter((m) => (MEAL_TYPES as readonly string[]).includes(m)),
    days: Array.isArray(b.days) ? b.days.map(Number).filter((d: number) => d >= 0 && d <= 6) : DEFAULT_SETTINGS.days,
    lunchPortions: Math.max(1, Math.min(8, Number(b.lunchPortions) || 3)),
    showCalories: !!b.showCalories,
    showPrices: !!b.showPrices,
    currency: validCurrency(b.currency) ? b.currency : DEFAULT_SETTINGS.currency,
    mealTimes: Object.fromEntries(MEAL_TYPES.map((m) => [m, validTime(b.mealTimes?.[m]) ? b.mealTimes[m] : DEFAULT_SETTINGS.mealTimes[m]])),
    reminders: b.reminders ? { prep: !!b.reminders.prep, cook: !!b.reminders.cook } : DEFAULT_SETTINGS.reminders,
    quietStart: validTime(b.quietStart) ? b.quietStart : DEFAULT_SETTINGS.quietStart,
    quietEnd: validTime(b.quietEnd) ? b.quietEnd : DEFAULT_SETTINGS.quietEnd,
    timezone: validTimeZone(b.timezone) ? b.timezone : DEFAULT_SETTINGS.timezone,
  };
  if (!s.meals.length) s.meals = DEFAULT_SETTINGS.meals;
  if (!s.days.length) s.days = DEFAULT_SETTINGS.days;
  const { error } = await supabase().from("settings").upsert({ user_id: uid, data: s, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, settings: s });
}
