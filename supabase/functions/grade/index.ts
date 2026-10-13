// Corrige una respuesta abierta con la API de Claude.
// Secretos necesarios (supabase secrets set ...):
//   ANTHROPIC_API_KEY   clave de la API de Anthropic
//   ANTHROPIC_MODEL     opcional, por defecto claude-haiku-5-5
//   DAILY_GRADING_LIMIT opcional, por defecto 15 correcciones por usuario y día
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const LEVEL_EN: Record<string, string> = { Junior: "junior", Mid: "mid-level", Senior: "senior" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // 1. ¿Quién llama?
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // 2. Datos de entrada
  let body: { questionId?: string; answer?: string; lang?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const answer = (body.answer ?? "").trim().slice(0, 4000);
  const lang = body.lang === "es" ? "es" : "en";
  if (!body.questionId || answer.length < 3) return json({ error: "bad_request" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 3. Pregunta (leída en el servidor: el cliente no decide los criterios)
  const { data: q } = await admin
    .from("questions")
    .select("prompt, prompt_en, keys, level, type, active, topics(role_name)")
    .eq("id", body.questionId)
    .single();
  if (!q || q.type !== "open" || !q.active) return json({ error: "not_found" }, 404);

  // 4. Límite diario
  const limit = Number(Deno.env.get("DAILY_GRADING_LIMIT") ?? "15");
  const { data: allowed, error: usageErr } = await admin.rpc("consume_grading", { p_user: user.id, p_limit: limit });
  if (usageErr) return json({ error: "server_error" }, 500);
  if (!allowed) return json({ error: "daily_limit", limit }, 429);

  // 5. Llamada a Claude
  // deno-lint-ignore no-explicit-any
  const role = (q as any).topics?.role_name ?? "software";
  const question = lang === "en" ? (q.prompt_en || q.prompt) : q.prompt;
  const prompt = lang === "en"
    ? `You are a friendly but demanding interviewer hiring a ${LEVEL_EN[q.level] ?? ""} ${role} professional. The interview is in English and the candidate is a native Spanish speaker.

Interview question: ${question}
What a strong answer covers: ${q.keys ?? ""}

Candidate's answer:
"""
${answer}
"""

Evaluate content, structure and English. Reply with only a JSON object, no other text:
{"score": integer 0-100, "strengths": [up to 3 short strings in Spanish], "improve": [up to 3 short, concrete strings in Spanish], "language": [up to 4 objects {"wrong": "exact phrase from the answer", "right": "corrected phrase"} for real English mistakes only, [] if none], "better": "an improved version of the candidate's own answer in natural spoken English, max 120 words, keeping their real facts and not inventing new ones"}`
    : `Eres un entrevistador cercano pero exigente que contrata a un perfil ${q.level} de ${role}. La entrevista es en español.

Pregunta: ${question}
Lo que cubre una buena respuesta (en inglés, como referencia): ${q.keys ?? ""}

Respuesta del candidato:
"""
${answer}
"""

Evalúa el contenido y la estructura. Responde solo con un objeto JSON, sin más texto:
{"score": entero 0-100, "strengths": [hasta 3 frases cortas], "improve": [hasta 3 frases cortas y concretas], "language": [], "better": "una versión mejorada de la respuesta del candidato, en español natural y hablado, máximo 120 palabras, manteniendo sus datos reales y sin inventar otros"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-5-5",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    console.error("anthropic", res.status, await res.text());
    return json({ error: "ai_unavailable" }, 502);
  }
  const data = await res.json();
  const text: string = (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  try {
    const r = JSON.parse(text.slice(start, end + 1));
    return json({
      score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
      strengths: Array.isArray(r.strengths) ? r.strengths.slice(0, 3).map(String) : [],
      improve: Array.isArray(r.improve) ? r.improve.slice(0, 3).map(String) : [],
      language: Array.isArray(r.language) ? r.language.slice(0, 4) : [],
      better: typeof r.better === "string" ? r.better : "",
    });
  } catch {
    console.error("bad json from model", text.slice(0, 500));
    return json({ error: "ai_bad_response" }, 502);
  }
});
