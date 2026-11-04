// Structured data for search engines (schema.org). Rendered as a <script
// type="application/ld+json"> tag, which search engines read without running
// JavaScript. Google's rich results use it to show price, availability and
// star ratings for a product directly in search results.
//
// The FAQ page already ships its own schema; this component covers products,
// so any catalog page can drop it in without thinking about the JSON details.

interface ProductStructuredDataProps {
  name: string;
  description?: string | null;
  image?: string | null;
  /** Absolute page URL of the product. */
  url: string;
  /** Price in the smallest currency unit convention used across the site (whole FCFA). */
  price: number;
  currency?: string;
  /** false when the item is sold out. */
  inStock?: boolean;
  /** Average rating and review count, when reviews exist for the item. */
  rating?: { value: number; count: number } | null;
}

/** Escape a JSON string for safe embedding in a <script> tag. */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function ProductStructuredData({
  name,
  description,
  image,
  url,
  price,
  currency = "XAF",
  inStock = true,
  rating,
}: ProductStructuredDataProps) {
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    url,
    price: Math.max(0, Math.round(price)),
    priceCurrency: currency,
    itemCondition: "https://schema.org/NewCondition",
    availability: inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
  };

  const aggregateRating =
    rating && rating.count > 0 && rating.value > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: Math.round(rating.value * 10) / 10,
          reviewCount: rating.count,
        }
      : undefined;

  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(description ? { description } : {}),
    ...(image ? { image: [image] } : {}),
    url,
    brand: { "@type": "Brand", name: "Cold Stone Creamery" },
    offers,
    ...(aggregateRating ? { aggregateRating } : {}),
  };

  return (
    <script
      type="application/ld+json"
      // Schema.org JSON is data, not markup; the escape keeps a description that
      // contains "</script>" from breaking out of the tag.
      dangerouslySetInnerHTML={{ __html: safeJson(product) }}
    />
  );
}
