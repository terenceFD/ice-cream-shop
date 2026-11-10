// Live-server probe: what does the FULL agent say to a fantasy product question?
// The rule engine now refuses; the model may still improvise. This distinguishes.
import { randomUUID } from "node:crypto";
const API = "http://localhost:3001/api";
let cookie = "";
const adopt = (r) => {
  for (const raw of r.headers.getSetCookie?.() ?? [])
    cookie = raw.split(";")[0];
};

for (const q of [
  "how much is your pizza flavored ice cream?",
  "how much is your burger ice cream?",
]) {
  const id = randomUUID();
  const res = await fetch(`${API}/chat/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ threadId: id, body: q }),
  });
  adopt(res);
  const before = [];
  let reply = null;
  for (let i = 0; i < 15 && !reply; i += 1) {
    await new Promise((r) => setTimeout(r, 700));
    const data = await (
      await fetch(`${API}/chat/messages/${id}`, {
        headers: cookie ? { Cookie: cookie } : {},
      })
    )
      .json()
      .catch(() => null);
    const list = Array.isArray(data?.messages) ? data.messages : [];
    const store = list.filter((m) => m.sender === "store");
    if (store.length) {
      const cId = list.find((m) => m.sender === "customer")?.id ?? 0;
      const latest = store.filter((m) => m.id > cId).at(-1);
      if (latest) reply = latest.body;
    }
  }
  console.log("Q:", q);
  console.log("A:", String(reply).slice(0, 240), "\n");
}
