import { useEffect, useState } from "react";

type Backdrop = "light" | "dark";
type Mode = "auto" | Backdrop;

/**
 * Decides whether a logo should sit on a light or dark tile.
 *
 * When mode is "auto" it best-effort samples the image's average luminance
 * (ignoring transparent pixels): a bright/white logo returns "dark" so it stays
 * visible, everything else returns "light". If the host blocks cross-origin
 * pixel reads (canvas taint) we can't sample, so it falls back to "light" —
 * that's what the explicit Light/Dark override is for.
 */
export function useLogoBackdrop(url: string | undefined, mode: Mode = "auto"): Backdrop {
  const [auto, setAuto] = useState<Backdrop>("light");

  useEffect(() => {
    if (mode !== "auto" || !url) return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = (canvas.width = 24), h = (canvas.height = 24);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let lum = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 24) continue; // skip transparent pixels
          lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * (a / 255);
          count++;
        }
        if (count && alive) setAuto(lum / count > 170 ? "dark" : "light");
      } catch { /* cross-origin lock — keep the light fallback */ }
    };
    img.src = url;
    return () => { alive = false; };
  }, [url, mode]);

  return mode === "auto" ? auto : mode;
}
