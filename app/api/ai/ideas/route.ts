import { NextResponse } from "next/server";
import { askJson } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, MEAL_TYPES, Settings } from "@/lib/types";

export const maxDuration = 60;

/**
 * Body: { meals: { Lunch: 5, ... }, hint?, avoid? } -> { ideas: { Lunch: ["dish", ...] } }.
 * Only names the dishes, so they can all be different while their recipes are written at the same time.
 */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

  const b = await req.json().catch(() => ({}));
  const wanted = MEAL_TYPES.map((m) => [m, Math.max(0, Math.min(7, Math.floor(Number(b.meals?.[m]) || 0)))] as const).filter(([, n]) => n);
  if (!wanted.length) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const hint = String(b.hint || "").slice(0, 4000);
  const avoid: string[] = Array.isArray(b.avoid) ? b.avoid.map((x: unknown) => String(x).slice(0, 120)).slice(-80) : [];

  const { data } = await supabase().from("settings").select("data").eq("user_id", uid).maybeSingle();
  const st: Settings = { ...DEFAULT_SETTINGS, ...(data?.data || {}) };

  try {
    const parsed = await askJson(
      `Plan dishes for someone's week. Name this many for each meal: ${wanted.map(([m, n]) => `${m} ${n}`).join(", ")}. Make them all clearly different from each other.
Person: ${st.notes}
Diet and goals: ${st.diet}
Shopping location: ${st.location}. Use only ingredients easy to buy there.
NEVER use any of these, or any ingredient containing them: ${st.exclusions.join(", ") || "(none)"}.
Vary cuisines, drawing from: ${st.cuisines.join(", ")}. Under 40 minutes of active cooking each. Breakfast and lunch must be easy to pack and carry to work.
${avoid.length ? `Do not repeat these existing recipes: ${avoid.join("; ")}.` : ""}
${hint ? `User request: ${hint}` : ""}

Return ONLY JSON in exactly this shape, on one line, no prose, no code fences. Each dish is a short title:
{${wanted.map(([m]) => `"${m}":["dish"]`).join(",")}}`,
      3000,
    );
    const ideas = Object.fromEntries(
      wanted.map(([m, n]) => [m, (Array.isArray(parsed?.[m]) ? parsed[m] : []).map((x: unknown) => String(x ?? "").trim().slice(0, 120)).filter(Boolean).slice(0, n)]),
    );
    return NextResponse.json({ ideas });
  } catch (e: any) {
    const status = e?.status === 429 ? 429 : 502;
    return NextResponse.json({ error: e?.message || "AI request failed", code: status === 429 ? "rate_limited" : "ai_error" }, { status });
  }
}
