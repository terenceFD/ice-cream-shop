// Tool calling for the chat assistant (#2: answers from the live database).
//
// The prompt's shop facts are cached for a minute and capped at ~45 items, so a
// price read from the prompt can be stale or missing. Tools close that gap: the
// model may call a function before answering, and the answer comes straight from
// the database at the moment of asking. A wrong price becomes impossible as long
// as the model uses the tool — and the grounding rule ("use ONLY the facts") is
// checked afterwards by the verify pass.
//
// Each tool returns plain text for the conversation, never throws, and is
// read-only. Nothing here can place an order or change data.

/**
 * The tool catalogue, in OpenAI's function-calling shape. Exported so tests can
 * pin the set and prompt builders can list the names.
 */
export function toolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "get_product",
        description:
          "Look up one menu product or flavor by name: its live price in FCFA, whether it is in stock, its description, dietary tags and allergens. Use this for ANY question about a specific product's price, availability or ingredients.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "The product or flavor name, as the customer wrote it (e.g. 'chocolate devotion', 'mango')",
            },
          },
          required: ["name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_active_promos",
        description:
          "List the discount codes active right now, with their amounts and minimum orders. Use this when the customer asks about promos, discounts or deals — never recite a code from memory.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "get_delivery_info",
        description:
          "Check whether an area is served for delivery and what the fee is. Use this for 'do you deliver to X' questions.",
        parameters: {
          type: "object",
          properties: {
            area: {
              type: "string",
              description:
                "The neighborhood, area or city the customer named (e.g. 'Bonapriso', 'Bastos')",
            },
          },
          required: ["area"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_order_status",
        description:
          "Look up a customer's order status by order number. Use this when they give a number starting with # or ask where their order is.",
        parameters: {
          type: "object",
          properties: {
            orderNumber: {
              type: "string",
              description: "The order number with or without the # (e.g. '54')",
            },
          },
          required: ["orderNumber"],
        },
      },
    },
  ];
}

/** Names only, for prompt sections and tests. */
export function toolNames() {
  return toolDefinitions().map((tool) => tool.function.name);
}

// ---------------------------------------------------------------- implementations

/**
 * Every tool gets the open database handle and the shop facts (which carry the
 * menu snapshot and branch list). Results are strings ready to drop into the
 * conversation as a "tool" role message.
 */
export function createToolExecutor(database, shopFacts) {
  return async function executeTool(name, args) {
    try {
      switch (name) {
        case "get_product":
          return getProduct(shopFacts, args?.name);
        case "get_active_promos":
          return await getActivePromos(database);
        case "get_delivery_info":
          return getDeliveryInfo(shopFacts, args?.area);
        case "get_order_status":
          return await getOrderStatus(database, args?.orderNumber);
        default:
          return `Unknown tool ${name}.`;
      }
    } catch (error) {
      // A tool failure must read as an honest "I could not check" to the model,
      // not as a crash — it will answer from the static facts instead.
      console.error(`chat tool ${name} failed:`, error.message);
      return `The ${name} lookup failed. Answer from the facts you already have, or say you cannot check right now.`;
    }
  };
}

function formatMoney(amount) {
  return `${new Intl.NumberFormat("en-CM").format(Math.round(amount))} FCFA`;
}

/** Best fuzzy match of a name against the menu snapshot. */
function findProduct(shopFacts, query) {
  if (!query) return null;
  const wanted = String(query)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  if (!wanted) return null;
  const wantedWords = wanted.split(/\s+/).filter(Boolean);
  let best = null;
  let bestScore = 0;
  for (const category of Object.keys(shopFacts.menuByCategory || {})) {
    for (const item of shopFacts.menuByCategory[category] || []) {
      const name = item.name.toLowerCase();
      let score = 0;
      if (name === wanted) score = 100;
      else if (name.includes(wanted) || wanted.includes(name)) score = 60;
      else {
        const nameWords = name.split(/\s+/);
        score =
          wantedWords.filter((word) =>
            nameWords.some(
              (candidate) => candidate.startsWith(word) && word.length > 2,
            ),
          ).length * 12;
      }
      if (score > bestScore) {
        bestScore = score;
        best = { ...item, category };
      }
    }
  }
  return bestScore >= 12 ? best : null;
}

function getProduct(shopFacts, name) {
  const match = findProduct(shopFacts, name);
  if (!match) {
    return `No product or flavor matching "${name}" was found in the catalog. Do not invent one — tell the customer you could not find it and suggest the All Menu page.`;
  }
  return [
    `Product: ${match.name}`,
    `Category: ${match.category}`,
    `Price: ${formatMoney(match.price)}`,
    match.soldOut
      ? "Availability: SOLD OUT right now."
      : "Availability: in stock.",
    match.detail ? `Description: ${match.detail}` : "",
    match.tags && match.tags !== "-" ? `Dietary tags: ${match.tags}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

async function getActivePromos(database) {
  const rows = await database
    .prepare(
      `
    SELECT code, discount_type AS type, discount_value AS value, minimum_total AS minimum
    FROM discount_codes
    WHERE is_active = 1
      AND (expires_at IS NULL OR expires_at > ?)
      AND (max_uses IS NULL OR uses < max_uses)
    ORDER BY created_at DESC LIMIT 5
  `,
    )
    .all(new Date().toISOString());
  if (!rows.length) {
    return "No active discount codes right now. Do not promise any promotion.";
  }
  return rows
    .map((row) => {
      const amount =
        row.type === "percent"
          ? `${row.value}% off`
          : `${formatMoney(row.value)} off`;
      return `${row.code}: ${amount}${row.minimum ? `, minimum order ${formatMoney(row.minimum)}` : ""}`;
    })
    .join(" | ");
}

function getDeliveryInfo(shopFacts, area) {
  if (!area)
    return "No area given. Ask the customer which neighborhood they are in.";
  const wanted = String(area)
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/g, " ")
    .trim();
  const branches = shopFacts.branchDetails || [];
  const match = branches.find(
    (branch) =>
      branch.area.toLowerCase().includes(wanted) ||
      wanted.includes(branch.area.toLowerCase()) ||
      branch.town.toLowerCase().includes(wanted),
  );
  if (match) {
    return `Yes — ${match.town} / ${match.area} is one of our branches (${match.address}). Delivery is available around branch areas; the exact fee shows in the delivery checker at checkout. Pickup at this store has no fee.`;
  }
  const towns = [...new Set(branches.map((branch) => branch.town))].join(", ");
  return `We do not have a branch in "${area}". We serve from our branches in: ${towns}. The delivery checker at checkout confirms whether a specific address is covered and shows the fee.`;
}

const ORDER_STATUS_MEANINGS = {
  processing: "confirmed and being prepared",
  ready: "ready for pickup at the store",
  out_for_delivery: "out for delivery right now",
  delivered: "delivered",
  payment_failed:
    "payment did not go through — the customer can retry checkout",
  cancelled: "cancelled",
};

async function getOrderStatus(database, orderNumber) {
  const id = Number(String(orderNumber || "").replace(/[^\d]/g, ""));
  if (!Number.isSafeInteger(id) || id < 1) {
    return "No valid order number given. Ask the customer for the number (it starts with #).";
  }
  const order = await database
    .prepare(
      `
    SELECT o.id, o.status, o.total_cents AS total, o.fulfillment_type AS fulfillment
    FROM orders o WHERE o.id = ? LIMIT 1
  `,
    )
    .get(id);
  if (!order) {
    return `Order #${id} was not found. Ask the customer to double-check the number or the email used at checkout.`;
  }
  return [
    `Order #${order.id}`,
    `Status: ${order.status} (${ORDER_STATUS_MEANINGS[order.status] || "in progress"})`,
    `Total: ${formatMoney(order.total)}`,
    `Type: ${order.fulfillment || "not recorded"}`,
  ].join(" | ");
}

/**
 * Run one round of tool calls from a model response and return the results as
 * messages. Returns [] when the response asked for no tools.
 */
export async function runToolCalls(toolCallResponse, executeTool) {
  const calls = toolCallResponse?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls) || calls.length === 0) return [];
  const results = [];
  for (const call of calls.slice(0, 4)) {
    let args = {};
    try {
      args = JSON.parse(call.function?.arguments || "{}");
    } catch {
      args = {};
    }
    const output = await executeTool(call.function?.name, args);
    results.push({
      role: "tool",
      tool_call_id: call.id,
      content: String(output).slice(0, 900),
    });
  }
  return results;
}
