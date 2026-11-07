// Sanity-check the Cerebras key and model name against the live API.
import "dotenv/config";

const response = await fetch(`${(process.env.AI_BASE_URL || "").replace(/\/$/, "")}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.AI_API_KEY}`,
  },
  body: JSON.stringify({
    model: process.env.AI_MODEL,
    max_completion_tokens: 60,
    messages: [{ role: "user", content: "Reply with exactly: CEREBRAS-OK" }],
  }),
});
const text = await response.text();
console.log("HTTP", response.status);
try {
  const data = JSON.parse(text);
  console.log("reply:", data.choices?.[0]?.message?.content || text.slice(0, 300));
} catch {
  console.log(text.slice(0, 500));
}
