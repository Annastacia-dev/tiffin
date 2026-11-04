/** Pulls the JSON object out of a model reply, ignoring code fences or stray text around it. */
export function parseJson(text: string): any {
  const t = text.replace(/```(?:json)?/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no JSON in response");
  return JSON.parse(t.slice(a, b + 1));
}
