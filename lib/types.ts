export const CATS = ["Proteins", "Grains & bread", "Dairy", "Vegetables", "Fruit", "Nuts & seeds", "Pantry", "Other"] as const;
export const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

export type Ingredient = {
  qty: number | null;
  unit: string;
  item: string;
  note: string;
  category: string;
  group: string;
};

export type Recipe = {
  id: string;
  title: string;
  mealType: string;
  cuisine: string;
  servings: string;
  ingredients: Ingredient[];
  steps: string[];
  tip: string;
  source: string;
  createdAt?: number;
  /** Estimated calories per portion. Null until worked out. */
  calories: number | null;
  /** Steps to start ahead of cooking. Null until checked, empty if none. */
  prep: PrepStep[] | null;
};

export type PrepStep = { task: string; hoursBefore: number };

export type Settings = {
  exclusions: string[];
  diet: string;
  cuisines: string[];
  location: string;
  notes: string;
  meals: string[];
  days: number[];
  lunchPortions: number;
  showCalories: boolean;
  /** Show AI price estimates on the shopping list */
  showPrices: boolean;
  /** ISO 4217 code, e.g. KES */
  currency: string;
  /** What time each meal gets cooked, "HH:MM" */
  mealTimes: Record<string, string>;
  reminders: { prep: boolean; cook: boolean };
  quietStart: string;
  quietEnd: string;
  timezone: string;
};

export const DEFAULT_SETTINGS: Settings = {
  exclusions: ["beans", "ndengu", "lentils", "chickpeas"],
  diet: "Eats meat, chicken and fish. Focus on gut health and high fiber: whole grains, vegetables, fruit, nuts and seeds, fermented dairy like maziwa mala.",
  cuisines: ["Japanese", "Mexican", "Lebanese", "Indian", "Swahili", "Chinese", "Middle Eastern", "Mediterranean", "Thai", "Italian", "Ethiopian", "Kenyan"],
  location: "Nairobi, Kenya – only ingredients easy to find at Carrefour, Naivas, Quickmart or local markets",
  notes: "Cooking for 1 person. Breakfast and lunch are packed for work, so they must travel well. Lunch recipes make 2–3 portions so leftovers cover dinner.",
  meals: ["Breakfast", "Lunch", "Snack"],
  days: [0, 1, 2, 3, 4],
  lunchPortions: 3,
  showCalories: false,
  showPrices: false,
  currency: "KES",
  mealTimes: { Breakfast: "07:00", Lunch: "12:30", Dinner: "19:00", Snack: "15:30" },
  reminders: { prep: true, cook: false },
  quietStart: "22:00",
  quietEnd: "07:00",
  timezone: "Africa/Nairobi",
};

export function validTime(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export function validTimeZone(v: unknown): v is string {
  if (typeof v !== "string" || !v) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

export function validCurrency(v: unknown): v is string {
  return typeof v === "string" && /^[A-Z]{3}$/.test(v);
}

export function cleanCalories(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) && n > 0 && n <= 5000 ? Math.round(n) : null;
}

/** Keeps steps with a sensible lead time. Returns null when there's no list at all, meaning "not checked yet". */
export function cleanPrep(v: unknown): PrepStep[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .map((s: any) => ({ task: String(s?.task || "").trim().slice(0, 120), hoursBefore: Number(s?.hoursBefore) }))
    .filter((s) => s.task && isFinite(s.hoursBefore) && s.hoursBefore >= 0.5 && s.hoursBefore <= 96)
    .slice(0, 5);
}

/** DB row <-> Recipe */
export function rowToRecipe(r: any): Recipe {
  return {
    id: r.id,
    title: r.title,
    mealType: r.meal_type,
    cuisine: r.cuisine || "",
    servings: r.servings || "",
    ingredients: r.ingredients || [],
    steps: r.steps || [],
    tip: r.tip || "",
    source: r.source || "",
    createdAt: r.created_at ? Date.parse(r.created_at) : undefined,
    calories: r.calories ?? null,
    prep: r.prep ?? null,
  };
}

export function recipeToRow(userId: string, r: Recipe) {
  return {
    user_id: userId,
    id: r.id,
    title: r.title,
    meal_type: r.mealType,
    cuisine: r.cuisine || "",
    servings: r.servings || "",
    ingredients: r.ingredients || [],
    steps: r.steps || [],
    tip: r.tip || "",
    source: r.source || "",
    calories: r.calories ?? null,
    prep: r.prep ?? null,
  };
}

/** Validate and normalise a recipe coming from the browser or the AI. */
export function cleanRecipe(x: any, meal?: string): Recipe | null {
  if (!x || typeof x !== "object" || !x.title || !Array.isArray(x.ingredients) || !Array.isArray(x.steps)) return null;
  const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : isFinite(parseFloat(v)) ? parseFloat(v) : null);
  return {
    id: String(x.id || "").slice(0, 60) || "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: String(x.title).slice(0, 120),
    mealType: String(meal || x.mealType || "Lunch").slice(0, 20),
    cuisine: String(x.cuisine || "").slice(0, 60),
    servings: String(x.servings || "").slice(0, 60),
    ingredients: x.ingredients
      .filter((i: any) => i && i.item)
      .slice(0, 40)
      .map((i: any) => ({
        qty: num(i.qty),
        unit: String(i.unit || "").slice(0, 20),
        item: String(i.item).toLowerCase().slice(0, 80),
        note: String(i.note || "").slice(0, 80),
        category: (CATS as readonly string[]).includes(i.category) ? i.category : "Other",
        group: String(i.group || "").slice(0, 40),
      })),
    steps: x.steps.map((s: any) => String(s).slice(0, 400)).filter(Boolean).slice(0, 12),
    tip: String(x.tip || "").slice(0, 300),
    source: String(x.source || "").slice(0, 20),
    calories: cleanCalories(x.calories),
    prep: cleanPrep(x.prep),
  };
}
