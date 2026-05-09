// Helper: turn a public `/condominio/{slug}` URL on quintoandar.com.br
// into the numeric condoId QA's listings API uses to filter by
// building (`filters.condoIds: [<id>]`). The numeric id never appears
// in the URL — only a hashId — so we have to fetch the page and read
// it from the embedded `__NEXT_DATA__`.
//
// Cached upstream by the caller (in `resolved_location` on the
// property row), so this function runs at most once per property.

const NEXT_DATA_RE =
  /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

/**
 * Returns the numeric `condoId` for a QuintoAndar building, given a
 * public URL like:
 *
 *   https://www.quintoandar.com.br/condominio/recanto-jacaranda-agua-branca-sao-paulo-ek99s1623k
 *
 * Returns null on bad URLs, network failures, or shape changes.
 */
export async function extractQuintoAndarCondoId(url: string): Promise<number | null> {
  if (!url || typeof url !== "string") return null;
  if (!url.includes("quintoandar.com.br/condominio/")) return null;

  let html: string;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
    if (!resp.ok) {
      console.warn(`[quinto-andar-condo] HTTP ${resp.status} for ${url}`);
      return null;
    }
    html = await resp.text();
  } catch (e) {
    console.error("[quinto-andar-condo] fetch failed:", e);
    return null;
  }

  // Easy path: condoId appears directly in the page HTML in several
  // contexts ("condoId":24919). We don't even need full JSON parsing
  // — a regex over the HTML is robust to small structure changes.
  const direct = html.match(/"condoId"\s*:\s*(\d+)/);
  if (direct) {
    const n = Number(direct[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // Fallback: parse __NEXT_DATA__ properly and walk
  // pageProps.condoInfo.listings.saleListings[0]._source.condoId.
  const nextData = html.match(NEXT_DATA_RE);
  if (!nextData) return null;
  try {
    const data = JSON.parse(nextData[1]);
    const listings =
      data?.props?.pageProps?.condoInfo?.listings?.saleListings ?? [];
    for (const l of listings) {
      const id = l?._source?.condoId;
      if (typeof id === "number") return id;
    }
  } catch (e) {
    console.error("[quinto-andar-condo] __NEXT_DATA__ parse failed:", e);
  }

  return null;
}
