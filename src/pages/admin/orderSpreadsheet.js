const AMP = "\u0026"; // written via escape so source tooling can't decode entities
const ENTITY_AMP = AMP + "amp;";
const ENTITY_LT = AMP + "lt;";
const ENTITY_GT = AMP + "gt;";
const ENTITY_QUOT = AMP + "quot;";

function parseOrderDate(value) {
  if (!value) return null;
  const normalized = String(value).replace(" ", "T");
  const date = new Date(
    /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function weekdaySortOrder(value) {
  const date = parseOrderDate(value);
  return !date ? 7 : (date.getDay() + 6) % 7;
}

function weekdayOf(value) {
  const date = parseOrderDate(value);
  return date ? date.toLocaleDateString("en", { weekday: "long" }) : "";
}

function formatDateTime(value) {
  const date = parseOrderDate(value);
  return date ? date.toISOString().replace("T", " ").slice(0, 16) : "";
}

// Escapes text so it is safe to embed inside the spreadsheet document.
function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll(AMP, ENTITY_AMP)
    .replaceAll("<", ENTITY_LT)
    .replaceAll(">", ENTITY_GT)
    .replaceAll('"', ENTITY_QUOT);
}

// Only the fields someone reading orders actually needs — store details,
// postal codes, discount bookkeeping and the like are left out.
const COLUMNS = [
  { label: "Order", width: 70 },
  { label: "Day", width: 90 },
  { label: "Placed", width: 120 },
  { label: "Customer", width: 130 },
  { label: "Phone", width: 110 },
  { label: "Email", width: 170 },
  { label: "Type", width: 80 },
  { label: "Delivery address", width: 140 },
  { label: "City", width: 90 },
  { label: "Items", width: 260 },
  { label: "Total", width: 90 },
];

function orderValues(order) {
  const placed = parseOrderDate(order.createdAt);
  return [
    order.id,
    weekdayOf(order.createdAt),
    formatDateTime(order.createdAt),
    order.customerName,
    order.customerPhone,
    order.customerEmail,
    order.fulfillmentType,
    [order.deliveryAddress, order.deliveryResidence].filter(Boolean).join(", "),
    order.deliveryCity,
    order.items
      .map(
        (item) =>
          `${item.quantity}x ${item.flavorName} (${item.unitPriceCents} ${order.currency})`,
      )
      .join("; "),
    order.totalCents,
  ];
}

/**
 * Exports orders as a spreadsheet document (.xls) with a formatted table:
 * styled header row, bordered cells, alternating row shading and sized
 * columns. Uses the HTML-table spreadsheet format, which opens natively in
 * Microsoft Excel and also in LibreOffice Calc, Google Sheets, WPS Office
 * and other spreadsheet software.
 */
export function exportOrdersSpreadsheet(orders, filename) {
  const sorted = [...orders].sort((a, b) => {
    const dayDifference =
      weekdaySortOrder(a.createdAt) - weekdaySortOrder(b.createdAt);
    return (
      dayDifference ||
      (parseOrderDate(b.createdAt)?.getTime() || 0) -
        (parseOrderDate(a.createdAt)?.getTime() || 0)
    );
  });

  const headerRow = `<tr>${COLUMNS.map(
    (column) =>
      `<th style="border:0.5pt solid #B0BEC9;background:#1F4E79;color:#FFFFFF;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;padding:5px 6px;text-align:left;">${htmlEscape(column.label)}</th>`,
  ).join("")}</tr>`;

  const bodyRows = sorted
    .map((order, rowIndex) => {
      const background = rowIndex % 2 === 1 ? "background:#EDF2F8;" : "";
      return `<tr>${orderValues(order)
        .map(
          (value) =>
            `<td style="border:0.5pt solid #B0BEC9;${background}font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000000;padding:4px 6px;vertical-align:top;mso-number-format:'\\@';">${htmlEscape(value)}</td>`,
        )
        .join("")}</tr>`;
    })
    .join("");

  // One grand-total row under the table. Amounts are grouped per currency so
  // mixed-currency exports still add up correctly.
  const totalsByCurrency = new Map();
  for (const order of sorted) {
    const currency = String(order.currency || "").toUpperCase();
    totalsByCurrency.set(
      currency,
      (totalsByCurrency.get(currency) || 0) + (Number(order.totalCents) || 0),
    );
  }
  const totalLabel = `SUM TOTAL (${sorted.length} order${sorted.length === 1 ? "" : "s"})`;
  const totalRow = `<tr>${COLUMNS.map((column, columnIndex) => {
    if (columnIndex === 0) {
      return `<td style="border:0.5pt solid #B0BEC9;background:#1F4E79;color:#FFFFFF;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;padding:5px 6px;white-space:nowrap;">${htmlEscape(totalLabel)}</td>`;
    }
    if (column.label === "Total") {
      const amounts = [...totalsByCurrency.entries()].map(
        ([currency, cents]) =>
          `${(cents / 100).toLocaleString("en", { maximumFractionDigits: 2 })} ${currency}`,
      );
      return `<td style="border:0.5pt solid #B0BEC9;background:#1F4E79;color:#FFFFFF;font-family:Calibri,Arial,sans-serif;font-size:12pt;font-weight:bold;padding:5px 6px;mso-number-format:'\\@';white-space:nowrap;">${htmlEscape(amounts.join(" + ") || "0")}</td>`;
    }
    return `<td style="border:0.5pt solid #B0BEC9;background:#1F4E79;padding:5px 6px;"></td>`;
  }).join("")}</tr>`;

  const columnGroup = `<cols>${COLUMNS.map(
    (column) => `<col width="${column.width}" />`,
  ).join("")}</cols>`;

  const title = `<tr><td colspan="${COLUMNS.length}" style="font-family:Calibri,Arial,sans-serif;font-size:16pt;font-weight:bold;color:#1F4E79;padding:6px 0;">Orders Export</td></tr>`;
  const subtitle = `<tr><td colspan="${COLUMNS.length}" style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#5F6368;padding:0 0 8px;">${sorted.length} order(s) - exported ${new Date().toLocaleString("en")}</td></tr>`;
  const table = `<table border="1" style="border-collapse:collapse;">${columnGroup}${title}${subtitle}${headerRow}${bodyRows}${totalRow}</table>`;

  // The mso-application header makes spreadsheet software open the file as a
  // workbook instead of a plain web page. (Named sheetHtml so it does not
  // shadow the browser's global `document`.)
  const sheetHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Orders Export</title>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Orders</x:Name><x:WorksheetOptions><x:Panes><x:VerticalSplit>1</x:VerticalSplit><x:FreezePanes/><x:TopRowBottomPane>1</x:TopRowBottomPane><x:ActivePane>2</x:ActivePane></x:Panes><x:FreezePanes/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>br { mso-data-placement: same-cell; } body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000000; }</style>
</head>
<body>${table}</body>
</html>`;

  const blob = new Blob(["\uFEFF", sheetHtml], {
    type: "application/vnd.ms-excel",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
