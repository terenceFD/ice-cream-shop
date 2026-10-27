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

// Escapes text so it is safe to embed inside the HTML document.
function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll(AMP, ENTITY_AMP)
    .replaceAll("<", ENTITY_LT)
    .replaceAll(">", ENTITY_GT)
    .replaceAll('"', ENTITY_QUOT);
}

// Each column is defined once with its header label, relative width (percent)
// and the order field it displays, so the header row and body rows can never
// drift out of alignment (which is what caused cut-off tables before).
const COLUMNS = [
  { label: "Order", width: 4, value: (order) => order.id },
  { label: "Day", width: 5, value: (order) => weekdayOf(order.createdAt) },
  { label: "Placed", width: 8, value: (order) => formatDateTime(order.createdAt) },
  { label: "Status", width: 5, value: (order) => order.status },
  { label: "Stage", width: 5, value: (order) => order.deliveryStage || order.fulfillmentStatus || "" },
  { label: "Customer", width: 7, value: (order) => order.customerName },
  { label: "Email", width: 9, value: (order) => order.customerEmail },
  { label: "Phone", width: 6, value: (order) => order.customerPhone },
  { label: "Type", width: 4, value: (order) => order.fulfillmentType },
  { label: "Delivery address", width: 10, value: (order) => order.deliveryAddress },
  { label: "City", width: 4, value: (order) => order.deliveryCity },
  { label: "Residence", width: 5, value: (order) => order.deliveryResidence },
  { label: "Postal code", width: 4, value: (order) => order.deliveryPostalCode },
  { label: "Store", width: 5, value: (order) => order.storeName },
  { label: "Store address", width: 8, value: (order) => order.storeAddress },
  { label: "Store phone", width: 5, value: (order) => order.storePhone },
  { label: "Scheduled for", width: 7, value: (order) => formatDateTime(order.scheduledFor) },
  { label: "Items", width: 12, value: (order) => order.items.map((item) => `${item.quantity}x ${item.flavorName} (${item.unitPriceCents} ${order.currency})`).join("; ") },
  { label: "Subtotal", width: 4, value: (order) => order.subtotalCents },
  { label: "Discount", width: 4, value: (order) => order.discountCents },
  { label: "Delivery fee", width: 4, value: (order) => order.deliveryFee },
  { label: "Total", width: 4, value: (order) => order.totalCents },
  { label: "Currency", width: 3, value: (order) => order.currency },
  { label: "Discount code", width: 5, value: (order) => order.discountCode },
  { label: "Delivered", width: 7, value: (order) => formatDateTime(order.deliveredAt) },
];

function weekdayOf(value) {
  const date = parseOrderDate(value);
  return date ? date.toLocaleDateString("en", { weekday: "long" }) : "";
}

function formatDateTime(value) {
  const date = parseOrderDate(value);
  return date ? date.toISOString().replace("T", " ").slice(0, 16) : "";
}

/**
 * Exports orders as a word processor document (.doc) containing a formatted
 * table with a shaded header row, bordered cells and alternating row shading.
 * Uses the HTML-with-Word-header format, which is opened natively by Microsoft
 * Word and also by LibreOffice Writer, OpenOffice Writer, WPS Office,
 * Google Docs and other word processing software.
 */
export function exportOrdersWord(orders, filename) {
  const sorted = [...orders].sort((a, b) => {
    const dayDifference =
      weekdaySortOrder(a.createdAt) - weekdaySortOrder(b.createdAt);
    return (
      dayDifference ||
      (parseOrderDate(b.createdAt)?.getTime() || 0) -
        (parseOrderDate(a.createdAt)?.getTime() || 0)
    );
  });

  // colgroup pins the column widths so Word lays the table out deterministically
  // instead of squeezing columns off the page edge.
  const colGroup = `<colgroup>${COLUMNS.map(
    (column) => `<col style="width:${column.width}%;" />`,
  ).join("")}</colgroup>`;

  const headerRow = `<tr style="background-color:#1F4E79;">${COLUMNS.map(
    (column) =>
      `<th style="border:1px solid #B0BEC9;padding:4px 6px;text-align:left;color:#FFFFFF;font-size:8pt;word-wrap:break-word;">${htmlEscape(column.label)}</th>`,
  ).join("")}</tr>`;

  const bodyRows = sorted
    .map((order, rowIndex) => {
      const background = rowIndex % 2 === 1 ? "background-color:#EDF2F8;" : "";
      return `<tr style="${background}">${COLUMNS.map(
        (column) =>
          `<td style="border:1px solid #B0BEC9;padding:3px 6px;font-size:8pt;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;">${htmlEscape(column.value(order))}</td>`,
      ).join("")}</tr>`;
    })
    .join("");

  const table = `<table style="border-collapse:collapse;width:100%;table-layout:fixed;">${colGroup}${headerRow}${bodyRows}</table>`;
  const title = `<h1 style="color:#1F4E79;font-size:16pt;">Orders Export</h1>`;
  const subtitle = `<p style="color:#5F6368;font-size:10pt;">${sorted.length} order(s) - exported ${new Date().toLocaleString("en")}</p>`;

  // The mso-application processing instruction makes word processors open the
  // file in editing mode as a document rather than as a plain web page.
  // (Named documentHtml so it does not shadow the browser's global `document`.)
  const documentHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Orders Export</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page Section1 { size: 297mm 210mm; margin: 12mm 12mm 12mm 12mm; }
div.Section1 { page: Section1; }
body { font-family: Calibri, Arial, sans-serif; }
</style>
</head>
<body><div class="Section1">${title}${subtitle}${table}</div></body>
</html>`;

  const blob = new Blob(["\uFEFF", documentHtml], {
    type: "application/msword",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
