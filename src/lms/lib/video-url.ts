export type VideoProvider = "vk" | "rutube" | "kinescope" | "youtube" | "vimeo" | "direct";

export type NormalizedVideoResult =
  | { isValid: true; provider: VideoProvider; embedUrl: string; originalUrl: string }
  | { isValid: false; error: string; originalUrl: string };

function toUrl(raw: string): URL | null {
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

function parseVk(raw: string): string | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "vk.com" && host !== "vkvideo.ru") return null;

  if (url.pathname === "/video_ext.php") {
    const oid = url.searchParams.get("oid");
    const id = url.searchParams.get("id");
    const hash = url.searchParams.get("hash");
    if (!oid || !id) return null;
    return `https://vk.com/video_ext.php?oid=${oid}&id=${id}${hash ? `&hash=${hash}` : ""}`;
  }

  const idMatch = url.pathname.match(/^\/video(-?\d+)_(\d+)(?:_([a-zA-Z0-9]+))?/);
  if (idMatch) {
    const [, oid, id, hash] = idMatch;
    return `https://vk.com/video_ext.php?oid=${oid}&id=${id}${hash ? `&hash=${hash}` : ""}`;
  }

  return null;
}

function parseRutube(raw: string): string | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "rutube.ru") return null;

  const match = url.pathname.match(/^\/(?:video|play\/embed)\/([a-zA-Z0-9]+)/);
  return match ? `https://rutube.ru/play/embed/${match[1]}` : null;
}

function parseKinescope(raw: string): string | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "kinescope.io") return null;

  const match = url.pathname.match(/^\/(?:embed\/)?([a-zA-Z0-9_-]+)/);
  return match ? `https://kinescope.io/embed/${match[1]}` : null;
}

function parseYoutube(raw: string): string | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (host !== "youtube.com") return null;

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  const shortsMatch = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;

  const embedMatch = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;

  return null;
}

function parseVimeo(raw: string): string | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "vimeo.com") return null;

  const match = url.pathname.match(/^\/(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : null;
}

function parseDirect(raw: string): string | null {
  const url = toUrl(raw);
  if (!url) return null;
  return /\.(mp4|webm|m3u8)$/i.test(url.pathname) ? raw : null;
}

const PARSERS: Array<{ provider: VideoProvider; parse: (raw: string) => string | null }> = [
  { provider: "vk", parse: parseVk },
  { provider: "rutube", parse: parseRutube },
  { provider: "kinescope", parse: parseKinescope },
  { provider: "youtube", parse: parseYoutube },
  { provider: "vimeo", parse: parseVimeo },
  { provider: "direct", parse: parseDirect },
];

export function parseAndNormalizeVideoUrl(rawUrl: string): NormalizedVideoResult {
  const originalUrl = (rawUrl ?? "").trim();

  if (!originalUrl) {
    return { isValid: false, error: "empty_url", originalUrl };
  }

  for (const { provider, parse } of PARSERS) {
    const embedUrl = parse(originalUrl);
    if (embedUrl) {
      return { isValid: true, provider, embedUrl, originalUrl };
    }
  }

  return { isValid: false, error: "unsupported_provider", originalUrl };
}
