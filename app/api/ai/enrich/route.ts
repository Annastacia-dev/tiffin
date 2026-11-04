import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { parseJson } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cleanCalories, cleanPrep } from "@/lib/types";

export const maxDuration = 60;

const BATCH = 6;

/** Adds calories and prep-ahead steps to saved recipes that don't have them, one batch per call. */
export async function POST() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });

  const sb = supabase();
  const { data: rows, error } = await sb
    .from("recipes")
    .select("id, title, servings, ingredients, steps")
    .eq("user_id", uid)
    .or("calories.is.null,prep.is.null")
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ updated: [] });

  try {
    const msg = await new Anthropic().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `For each recipe below, estimate the calories in ONE portion, and list any step that has to start well before cooking.
A prep step is something like marinating, soaking, overnight oats, setting chia pudding or thawing. Only include steps that must start at least 1 hour before cooking. "hoursBefore" is the usual time needed, from 1 to 96. "task" is a short instruction, e.g. "Soak the chia seeds". Use an empty list if there are none.

Return ONLY JSON in exactly this shape, no prose, no code fences:
{"recipes":[{"id":"","calories":number,"prep":[{"task":"","hoursBefore":number}]}]}

Recipes:
${JSON.stringify(rows)}`,
        },
      ],
    });
    const parsed = parseJson(msg.content.map((c: any) => (c.type === "text" ? c.text : "")).join(""));
    const results = Array.isArray(parsed?.recipes) ? parsed.recipes : [];
    const known = new Set(rows.map((r) => r.id));
    const updated = [];
    for (const x of results) {
      const calories = cleanCalories(x?.calories);
      if (!known.has(x?.id) || calories == null) continue;
      const prep = cleanPrep(x.prep) ?? [];
      const saved = await sb.from("recipes").update({ calories, prep }).eq("user_id", uid).eq("id", x.id);
      if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
      updated.push({ id: x.id, calories, prep });
    }
    return NextResponse.json({ updated });
  } catch (e: any) {
    const status = e?.status === 429 ? 429 : 502;
    return NextResponse.json({ error: e?.message || "AI request failed", code: status === 429 ? "rate_limited" : "ai_error" }, { status });
  }
}
