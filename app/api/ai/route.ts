import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseJson } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { CATS, DEFAULT_SETTINGS, MEAL_TYPES, Settings, cleanRecipe, leftoversAs, mealCalorieLimit } from "@/lib/types";

export const maxDuration = 60;

function buildPrompt(st: Settings, meal: string, n: number, hint: string, avoid: string[], paste: boolean) {
  const portions = meal === "Lunch" || meal === "Dinner"
    ? `${st.lunchPortions} portions (one for ${meal.toLowerCase()}, the rest for ${meal === "Lunch" ? "dinner" : "lunch"} or the next day)`
    : "1 portion";
  const calorieLimit = paste ? null : mealCalorieLimit(st, meal);
  return `You are a meal-planning assistant. ${paste
    ? "Turn the user's description or pasted recipe below into ONE structured recipe; if it is a full recipe, stay faithful to it."
    : `Create ${n} distinct ${meal} recipe${n > 1 ? "s" : ""}.`}
Meal type: ${meal}. Portions: ${portions}.
Person: ${st.notes}
Diet and goals: ${st.diet}
Shopping location: ${st.location}. Use only ingredients easy to buy there.
${meal === "Breakfast" || meal === "Lunch" ? "It must be easy to pack and carry to work." : ""}
NEVER use any of these, or any ingredient containing them: ${st.exclusions.join(", ") || "(none)"}.
${paste ? "" : `Vary cuisines, drawing from: ${st.cuisines.join(", ")}. Keep weekday prep realistic (under 40 minutes active).`}
${calorieLimit ? `Calorie limit: they eat at most ${st.maxCalories} kcal a day, so one portion of each recipe must be at most ${calorieLimit} kcal${leftoversAs(st) && (meal === "Lunch" || meal === "Dinner") ? ", which allows for eating a leftover portion the same day" : ""}. Choose ingredients and amounts to stay within this, and report the real estimate in "calories".` : ""}
${avoid.length ? `Do not repeat these existing recipes: ${avoid.slice(0, 80).join("; ")}.` : ""}
${hint ? `User request: ${hint}` : ""}

Return ONLY JSON in exactly this shape, no prose, no code fences:
{"recipes":[{"title":"","cuisine":"","servings":"e.g. 1 portion or 2–3 portions","ingredients":[{"qty":number or null,"unit":"","item":"","note":"","category":"","group":""}],"steps":[""],"tip":"","calories":number,"prep":[{"task":"","hoursBefore":number}]}]}
Ingredient rules: "item" is the plain shopping name in lower case (e.g. "chicken thigh", "onion", "brown rice", "maziwa mala"); preparation goes in "note" (e.g. "chopped"). "unit" is one of g, ml, tsp, tbsp, cup, pc, clove, bunch, tin, head, slice, handful, pinch (use metric; "pc" for countable items). "category" is one of: ${CATS.join(", ")} (spices, oils, sauces, salt go in Pantry). "group" is "" or a sub-heading like "Sauce". Steps: 3–8 short, clear sentences; write any amount with digits and a unit (e.g. "2 cups", "200 g", "180°C"). Tip: one short practical tip about prep, packing or storage. "calories" is your estimate for one portion. "prep" lists only steps that must start at least 1 hour before cooking, such as marinating, soaking, overnight oats, setting chia pudding or thawing, or is empty if there are none: "task" is a short instruction (e.g. "Soak the chia seeds") and "hoursBefore" is how long ahead to start, from 1 to 96.`;
}

/** Body: { meal, n, hint?, avoid?: string[], paste?: boolean } -> { recipes: Recipe[] } (not yet saved). */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

  const b = await req.json().catch(() => ({}));
  const meal = (MEAL_TYPES as readonly string[]).includes(b.meal) ? b.meal : "Lunch";
  const n = Math.max(1, Math.min(4, Number(b.n) || 1));
  const hint = String(b.hint || "").slice(0, 4000);
  const avoid = Array.isArray(b.avoid) ? b.avoid.map(String).slice(0, 80) : [];
  const paste = !!b.paste;

  const { data } = await supabase().from("settings").select("data").eq("user_id", uid).maybeSingle();
  const st: Settings = { ...DEFAULT_SETTINGS, ...(data?.data || {}) };

  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: buildPrompt(st, meal, n, hint, avoid, paste) }],
    });
    const text = msg.content.map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const parsed = parseJson(text);
    const arr = Array.isArray(parsed?.recipes) ? parsed.recipes : [];
    const recipes = arr.map((x: any) => cleanRecipe({ ...x, id: undefined, source: "ai" }, meal)).filter(Boolean);
    return NextResponse.json({ recipes });
  } catch (e: any) {
    const status = e?.status === 429 ? 429 : 502;
    return NextResponse.json({ error: e?.message || "AI request failed", code: status === 429 ? "rate_limited" : "ai_error" }, { status });
  }
}
