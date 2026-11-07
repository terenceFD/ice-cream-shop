# The AI Chat Agent

How the Cold Stone Creamery chat assistant works, what it knows, and how to
operate it. Edition 1.0, November 2026.

Developer: Terence Timah, fullstack developer, Rockstar Technology, Cameroon.

The agent answers customer questions on the storefront and drafts replies for
staff in the admin inbox. It answers only from the shop's own data — the live
menu, the branches, the policies, the customer's bag and orders — and never
invents a price, a product, or a promise.

---

## 1. Architecture at a glance

```
Customer message (LiveChatWidget.tsx)
    │  page URL + page snapshot + optional photo
    ▼
POST /api/chat/messages  (server/index.js)
    │  stores the message, then the auto-reply pipeline:
    ▼
suggestReply()  (server/chat-assistant.js)
    │
    ├─ gatherShopFacts()      live menu, branches, hours, discounts, policies
    ├─ gatherCustomerContext() the customer's bag and latest order
    ├─ buildMemorySummary()    earlier constraints of this conversation
    ├─ retrieveChunks()        the catalog details relevant to this question (RAG)
    ├─ buildSystemPrompt()     role rules + everything above
    │
    ├─ runWithTools()          the model conversation (see §3)
    │      └─ tools may read the database mid-conversation
    ├─ verifyDraft()           a second model call fact-checks the draft
    │
    └─ result { suggestion, topic, confidence, answerable, needsAttention }
              │
              ▼
        stored as a 'store' message → polled by the customer seconds later
```

Failing model calls never leave the customer in silence: the chain falls back
through the providers (§5) and then to the deterministic rules drafter, which
answers from the same live data.

## 2. Files that make up the agent

| File                                   | Role                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `server/chat-assistant.js`             | The brain: prompt building, language detection, model calls, verify pass, rules fallback, topic detection, handoff detection |
| `server/chat-tools.js`                 | The four live-database tools the model may call (read-only)                                                                  |
| `server/retrieval.js`                  | RAG: chunks the catalog and retrieves the ones relevant to the message                                                       |
| `src/components/LiveChatWidget.tsx`    | The customer chat: starters, voice input, photo attach, proactive nudge                                                      |
| `src/pages/admin/AdminChatPage.tsx`    | The staff inbox: threads, needs-attention flags, AI draft button                                                             |
| `src/pages/admin/AdminReportsPage.tsx` | The "What customers ask the assistant" chart                                                                                 |

## 3. The two models and how they are chosen

|             | `AI_MODEL` (text brain)                | `AI_VISION_MODEL` (eyes)                       |
| ----------- | -------------------------------------- | ---------------------------------------------- |
| Used for    | Every text message — the vast majority | Only messages carrying a photo                 |
| Sees images | No                                     | Yes (PNG/JPEG, base64 data URI, 2 per request) |
| Tools       | All four                               | All four                                       |
| Verify pass | Fact-checks its replies                | Fact-checked the same way                      |

Routing happens per message in `runOneProvider()`: if the latest customer
message carries `imageUrl`, the request swaps in the vision model; otherwise
the text model answers. The choice never blocks anything — both models are
always available, and a thread that started with a photo continues on the text
model for its text follow-ups.

Cerebras requires images as base64 data URIs (it does not fetch URLs), so
`inlineImage()` reads the stored `/uploads/` file from disk and inlines it.

The **verify pass** runs on `AI_MODEL` for every AI reply: a second call at
temperature 0 checks the draft against the facts, the tool results and the page
snapshot. Ungrounded details are corrected or refused — a customer never reads
a price the database does not contain.

## 4. What the agent knows

Both models receive the same knowledge. It is maintained in three places:

**Page guides** (`PAGE_GUIDES` + `GENERIC_PAGE_GUIDES`, chat-assistant.js):
every customer route, including product-detail views (`/menu?…item=…`),
described well enough that "what page is this?" gets a real answer.

**Shop facts + policies** (`gatherShopFacts()`): opening hours with the live
open/closed state, every branch, active discount codes, the full menu by
category with prices and stock, and sixteen business rules — ordering,
payment, order progress, offers and loyalty, accounts, reviews, custom cakes,
events, notifications, delivery areas, contact, the app, privacy, the chat↔team
loop, promotion announcements, and staff reply times.

**Retrieved detail** (`retrieval.js`): full product and policy chunks matching
the question — allergens, descriptions, exact terms — appended as
"RETRIEVED DETAILS" the model may quote like the facts.

**Customer context** (`gatherCustomerContext()`): the signed-in customer's
first name, bag contents and latest order, so "what's in my bag?" and "where
is my order?" get real answers without asking the customer anything.

**Tools** (`chat-tools.js`): `get_product`, `get_active_promos`,
`get_delivery_info`, `get_order_status` — the model can look at the database
at the moment of asking instead of reciting a snapshot. All read-only; a failed
lookup answers honestly instead of crashing.

## 5. Resilience: provider failover and fallbacks

```
AI_MODEL          (primary, e.g. Cerebras — 1M tokens/day free)
  │ 429? → retry up to 2× with capped waits (max 15s each)
  │ still failing? ▼
AI_FAILOVER_*     (backup, e.g. Groq — the remaining daily tokens)
  │ still failing? ▼
Rules drafter     (deterministic, grounded in the same live data)
```

- The provider is passed **explicitly** through the call chain — `process.env`
  is never mutated, so concurrent threads cannot swap providers under each other.
- The shared generation budget is `TIMEOUT_MS` (45s); on timeout the chain
  stops early and falls back rather than hanging.
- The rules drafter auto-sends topic answers (price, menu, hours, branches,
  delivery, promotions, stock, accounts, cakes, events, loyalty, payment…)
  because those are grounded in live data. Only the generic "a colleague will
  reply soon" template stays staff-only.
- Handoff (`needsHumanHandoff()`) is deterministic — complaint keywords in
  English and French, money disputes, and repeated identical questions — so a
  customer's complaint reaches the team even if the model is down.

## 6. Environment variables

| Setting                                                            | Purpose                                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`                            | The primary provider (OpenAI-compatible)                                                       |
| `AI_VISION_MODEL`                                                  | Vision model on the same provider, for photo messages (leave empty to keep photos text-only)   |
| `AI_FAILOVER_BASE_URL`, `AI_FAILOVER_MODEL`, `AI_FAILOVER_API_KEY` | Optional backup provider                                                                       |
| `CHAT_AUTO_REPLY`                                                  | `true` lets the agent reply to customers by itself; without it the agent only drafts for staff |

Current setup: **Cerebras** `gpt-oss-120b` primary (1M tokens/day free),
`qwen-3.8-27b` vision, **Groq** `openai/gpt-oss-20b` failover. On Render every
value must be added on the service's Environment page — Render does not read
the local `.env`.

## 7. Testing

```sh
node --test server/chat-assistant.test.js          # grounding rules, greetings, language
node --test server/chat-assistant-features.test.js # handoff, customer context, prompt wiring
node --test server/chat-intelligence.test.js       # RAG, tools, memory, failover
node scripts/debug-price-pipeline.mjs              # one live question end-to-end
node scripts/agent-test-sweep.mjs                  # ten live scenarios
node scripts/vision-pipeline-test.mjs              # photo → product recognition
```

`npm test` runs everything with temporary databases and never touches live
data. The scripts that call the real provider use your configured keys and
count against its quota.

## 8. Operational notes

- Free provider tiers throttle: Cerebras at ~5 requests/minute, Groq at a
  daily token ceiling. The retries and failover absorb brief throttling; a
  saturated day degrades to rules answers, not silence.
- Staff edits of AI drafts are recorded in `chat_corrections`
  (draft vs sent, `was_edited`) — the diffs show which facts the model gets
  wrong, so they can be added to the prompt or the retrieval index.
- The admin Reports page shows what customers actually ask (topics stamped by
  the auto-reply) — free product research.
- Rotation reminder: keys pasted in plain text (chat, email) are exposed.
  Rotate them in the provider dashboard and update `.env` and Render.
