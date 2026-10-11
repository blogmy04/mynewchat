const crypto = require("crypto");
const { SYSTEM_PROMPT } = require("./_prompt");

const MODEL = process.env.MODEL || "llama-3.3-70b-versatile";

// Compara a senha de forma segura
function senhaOk(enviada) {
  const correta = process.env.APP_PASSWORD;
  if (!correta || !enviada) return false;
  const a = crypto.createHash("sha256").update(String(enviada)).digest();
  const b = crypto.createHash("sha256").update(correta).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // 🔒 Só você, com a senha, passa daqui
  if (!senhaOk(req.headers["x-password"])) {
    await new Promise((r) => setTimeout(r, 800)); // dificulta tentativa e erro
    return res.status(401).json({ error: "Senha incorreta" });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Envie uma lista de mensagens" });
  }

  const history = messages.slice(-20).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 2000),
  }));

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error(data);
      return res.status(502).json({ error: "Erro ao falar com a IA" });
    }

    const reply = data.choices?.[0]?.message?.content || "Sem resposta.";
    return res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno" });
  }
};
