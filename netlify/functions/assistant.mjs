const OPENAI_URL = "https://api.openai.com/v1/responses";
const MAX_BODY_BYTES = 64_000;
const SYSTEM_PROMPT = `You are a concise household operations assistant. Answer only from the workspace context supplied by the user. If the context does not contain the answer, say what is missing instead of guessing. Clearly distinguish planned, scheduled, commenced, and completed work. When dates matter, use exact dates. Never claim to modify records; you only answer questions.`;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function extractAnswer(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Use POST for assistant questions." }, 405);
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "The workspace context is too large. Please try a narrower question." }, 413);

  let raw;
  let body;
  try {
    raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "The workspace context is too large. Please try a narrower question." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "The assistant request was not valid JSON." }, 400);
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return json({ error: "Enter a question first." }, 400);
  if (question.length > 1000) return json({ error: "Keep the question under 1,000 characters." }, 400);
  if (!body.context || typeof body.context !== "object" || Array.isArray(body.context)) return json({ error: "Workspace context is missing." }, 400);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: "The assistant is not configured yet. Add OPENAI_API_KEY in Netlify environment variables." }, 503);

  let upstream;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        input: [
          { role: "developer", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "input_text", text: `Question:\n${question}\n\nWorkspace context (JSON):\n${JSON.stringify(body.context)}` }] }
        ],
        reasoning: { effort: "low" },
        max_output_tokens: 700
      })
    });
  } catch (error) {
    console.error("Assistant upstream connection failed", error?.message || "unknown error");
    return json({ error: "The AI provider could not be reached. Please try again." }, 502);
  }

  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    console.error("Assistant upstream error", upstream.status, upstream.headers.get("x-request-id") || "no-request-id");
    if (upstream.status === 401) return json({ error: "The assistant API key is invalid. Update OPENAI_API_KEY in Netlify." }, 503);
    if (upstream.status === 429) return json({ error: "The assistant is temporarily at its usage limit. Please try again shortly." }, 429);
    return json({ error: "The AI provider returned an error. Please try again." }, 502);
  }

  const answer = extractAnswer(payload);
  if (!answer) return json({ error: "The AI provider returned an empty response. Please try again." }, 502);
  return json({ answer });
};

export const config = { path: "/api/assistant" };
