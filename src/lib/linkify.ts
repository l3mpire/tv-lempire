export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();

  // Raw ID (11 alphanumeric + dash/underscore chars)
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);

    // youtube.com/watch?v=ID
    if (url.hostname.includes("youtube.com") && url.searchParams.has("v")) {
      const v = url.searchParams.get("v")!;
      if (/^[\w-]{11}$/.test(v)) return v;
    }

    // youtube.com/embed/ID
    const embedMatch = url.pathname.match(/\/embed\/([\w-]{11})/);
    if (embedMatch) return embedMatch[1];

    // youtu.be/ID
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      if (/^[\w-]{11}$/.test(id)) return id;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

export type ContentSegment =
  | { type: "text"; text: string }
  | { type: "youtube"; url: string; youtubeId: string }
  | { type: "url"; url: string };

const URL_REGEX = /https?:\/\/[^\s<]+/gi;

export function parseContent(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const start = match.index;
    // Add preceding text
    if (start > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, start) });
    }

    // Strip trailing punctuation that's likely not part of the URL
    let url = match[0];
    const trailingMatch = url.match(/[).,;:!?]+$/);
    if (trailingMatch) {
      url = url.slice(0, -trailingMatch[0].length);
    }

    const youtubeId = extractYoutubeId(url);
    if (youtubeId) {
      segments.push({ type: "youtube", url, youtubeId });
    } else {
      segments.push({ type: "url", url });
    }

    lastIndex = start + url.length;
    // If we stripped trailing punctuation, the remaining chars become text in the next iteration
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex) });
  }

  return segments;
}
