"use client";

import { useMemo } from "react";
import { parseContent } from "@/lib/linkify";

export default function LinkedContent({ content, className }: { content: string; className?: string }) {
  const segments = useMemo(() => parseContent(content), [content]);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "youtube") {
          return (
            <a
              key={i}
              className={`linkified-url linkified-url-yt${className ? ` ${className}` : ""}`}
              href={seg.url}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent("playYouTube", { detail: { youtubeId: seg.youtubeId } }));
                window.dispatchEvent(new Event("closeChatPanel"));
              }}
            >
              ▶ {seg.url}
            </a>
          );
        }
        if (seg.type === "url") {
          return (
            <a
              key={i}
              className={`linkified-url${className ? ` ${className}` : ""}`}
              href={seg.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {seg.url}
            </a>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </>
  );
}
