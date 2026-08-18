const json = (body, status) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export default async () => json({
  error: "The assistant is disabled pending authenticated, rate-limited server-side authorization."
}, 410);

export const config = { path: "/api/assistant" };
