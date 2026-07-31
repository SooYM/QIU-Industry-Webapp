"use client";
import { useEffect, useState } from "react";

/**
 * A small preview window for an image URL, so the person pasting a logo/photo
 * link can confirm it looks right before saving. Shows nothing until a URL is
 * entered, and a clear warning if the link doesn't load.
 */
export function ImagePreview({ url, label = "Preview" }: { url?: string; label?: string }) {
  const src = (url ?? "").trim();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!/^https?:\/\/.+/i.test(src)) return null;
  return (
    <div className="img-preview" aria-live="polite">
      <span className="img-preview-label">{label}</span>
      {failed
        ? <span className="img-preview-fail">⚠ Couldn&apos;t load this image — check the link is public and points to an image.</span>
        : <img src={src} alt={label} onError={() => setFailed(true)} />}
    </div>
  );
}
