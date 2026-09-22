export type VideoProvider = "vk" | "rutube" | "kinescope" | "youtube" | "vimeo" | "direct";

export type VideoWarning = "PRIVATE_VK_NEEDS_HASH";

export type NormalizedVideoResult =
  | { isValid: true; provider: VideoProvider; embedUrl: string; originalUrl: string; warning?: VideoWarning }
  | { isValid: false; error: string; originalUrl: string };

function toUrl(raw: string): URL | null {
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#039;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(amp|quot|#039|apos|lt|gt);/g, (m) => HTML_ENTITIES[m] ?? m);
}

/** Pulls the URL out of a pasted `<iframe src="...">` embed snippet, if the input looks like one. */
function extractUrlFromInput(raw: string): string {
  const unescaped = raw.replace(/\\"/g, '"').replace(/\\'/g, "'");

  if (!/<[a-z][^>]*\bsrc\s*=/i.test(unescaped)) {
    return unescaped;
  }

  const match = unescaped.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const src = match?.[1] ?? match?.[2] ?? match?.[3];
  return src ? decodeHtmlEntities(src) : unescaped;
}

type ParseResult = { embedUrl: string; warning?: VideoWarning };

function parseVk(raw: string): ParseResult | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "vk.com" && host !== "vkvideo.ru") return null;

  function buildResult(oid: string, id: string, hash: string | null): ParseResult {
    const embedUrl = `https://vk.com/video_ext.php?oid=${oid}&id=${id}${hash ? `&hash=${hash}` : ""}`;
    // A positive oid identifies a personal VK profile; VK's embed player
    // requires such videos to carry an access hash unless the uploader made
    // them fully public (rare for personal uploads). A negative oid
    // (community/public group) embeds fine without a hash, so only warn for
    // the ambiguous personal-profile case.
    const warning = !hash && !oid.startsWith("-") ? ("PRIVATE_VK_NEEDS_HASH" as const) : undefined;
    return { embedUrl, warning };
  }

  if (url.pathname === "/video_ext.php") {
    const oid = url.searchParams.get("oid");
    const id = url.searchParams.get("id");
    const hash = url.searchParams.get("hash");
    if (!oid || !id) return null;
    return buildResult(oid, id, hash);
  }

  const idMatch = url.pathname.match(/^\/video(-?\d+)_(\d+)(?:_([a-zA-Z0-9]+))?/);
  if (idMatch) {
    const [, oid, id, pathHash] = idMatch;
    const hash = pathHash || url.searchParams.get("hash");
    return buildResult(oid, id, hash);
  }

  return null;
}

function parseRutube(raw: string): ParseResult | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "rutube.ru") return null;

  const match = url.pathname.match(/^\/(?:video|play\/embed)\/([a-zA-Z0-9]+)/);
  return match ? { embedUrl: `https://rutube.ru/play/embed/${match[1]}` } : null;
}

function parseKinescope(raw: string): ParseResult | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "kinescope.io") return null;

  const match = url.pathname.match(/^\/(?:embed\/)?([a-zA-Z0-9_-]+)/);
  return match ? { embedUrl: `https://kinescope.io/embed/${match[1]}` } : null;
}

function parseYoutube(raw: string): ParseResult | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? { embedUrl: `https://www.youtube.com/embed/${id}` } : null;
  }

  if (host !== "youtube.com") return null;

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return id ? { embedUrl: `https://www.youtube.com/embed/${id}` } : null;
  }

  const shortsMatch = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
  if (shortsMatch) return { embedUrl: `https://www.youtube.com/embed/${shortsMatch[1]}` };

  const embedMatch = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) return { embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}` };

  return null;
}

function parseVimeo(raw: string): ParseResult | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "vimeo.com") return null;

  const match = url.pathname.match(/^\/(\d+)/);
  return match ? { embedUrl: `https://player.vimeo.com/video/${match[1]}` } : null;
}

function parseDirect(raw: string): ParseResult | null {
  const url = toUrl(raw);
  if (!url) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return /\.(mp4|webm|m3u8)$/i.test(url.pathname) ? { embedUrl: raw } : null;
}

const PARSERS: Array<{ provider: VideoProvider; parse: (raw: string) => ParseResult | null }> = [
  { provider: "vk", parse: parseVk },
  { provider: "rutube", parse: parseRutube },
  { provider: "kinescope", parse: parseKinescope },
  { provider: "youtube", parse: parseYoutube },
  { provider: "vimeo", parse: parseVimeo },
  { provider: "direct", parse: parseDirect },
];

export function parseAndNormalizeVideoUrl(rawUrl: string): NormalizedVideoResult {
  const trimmed = (rawUrl ?? "").trim();

  if (!trimmed) {
    return { isValid: false, error: "empty_url", originalUrl: trimmed };
  }

  const originalUrl = extractUrlFromInput(trimmed).trim();

  for (const { provider, parse } of PARSERS) {
    const parsed = parse(originalUrl);
    if (parsed) {
      return { isValid: true, provider, embedUrl: parsed.embedUrl, originalUrl, warning: parsed.warning };
    }
  }

  return { isValid: false, error: "unsupported_provider", originalUrl };
}
