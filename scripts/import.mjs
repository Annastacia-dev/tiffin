// Imports data/export.json (your recipes and plan from the Claude version) into Supabase.
// Usage: npm run import-data -- you@example.com
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const email = (process.argv[2] || (process.env.ALLOWED_EMAILS || "").split(",")[0] || "").trim().toLowerCase();
if (!email) {
  console.error("Pass the Google email you sign in with: npm run import-data -- you@example.com");
  process.exit(1);
}
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const data = JSON.parse(readFileSync(new URL("../data/export.json", import.meta.url), "utf8"));

const recipes = Object.entries(data.recipes).map(([id, r]) => ({
  user_id: email,
  id,
  title: r.title,
  meal_type: r.mealType,
  cuisine: r.cuisine || "",
  servings: r.servings || "",
  ingredients: r.ingredients || [],
  steps: r.steps || [],
  tip: r.tip || "",
  source: r.source || "",
}));
const slots = Object.entries(data.days).flatMap(([date, meals]) =>
  Object.entries(meals).map(([meal, recipe_id]) => ({ user_id: email, date, meal, recipe_id }))
);

let r = await sb.from("recipes").upsert(recipes, { onConflict: "user_id,id" });
if (r.error) throw r.error;
r = await sb.from("plan_slots").upsert(slots, { onConflict: "user_id,date,meal" });
if (r.error) throw r.error;
console.log(`Imported ${recipes.length} recipes and ${slots.length} planned meals for ${email}.`);
