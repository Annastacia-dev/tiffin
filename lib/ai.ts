import Anthropic from "@anthropic-ai/sdk";

/**
 * Asks the AI for JSON. Low effort, because thinking hard about a recipe about
 * doubles the wait. Models from before effort existed reject the setting.
 */
export async function askJson(prompt: string, maxTokens: number): Promise<any> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const effort = /claude-(3|haiku-4|sonnet-4-[05]|sonnet-4-2|opus-4-[01])/.test(model) ? {} : { output_config: { effort: "low" } };
  const msg = await new Anthropic().messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
    ...effort, // newer than this SDK version's types
  } as Anthropic.MessageCreateParamsNonStreaming);
  return parseJson(msg.content.map((c) => (c.type === "text" ? c.text : "")).join(""));
}

/** Pulls the JSON object out of a model reply, ignoring code fences or stray text around it. */
export function parseJson(text: string): any {
  const t = text.replace(/```(?:json)?/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no JSON in response");
  return JSON.parse(t.slice(a, b + 1));
}
