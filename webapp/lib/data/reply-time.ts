import type { ChatLog } from "./types";

/**
 * A company's typical reply speed, estimated from what has actually happened
 * rather than from anything they promise.
 *
 * The portal has no reply timestamps of its own, so this uses the assistant
 * chat log as the closest available signal: how long a student typically waits
 * between asking about a company and that company's next recorded activity.
 * It is an estimate and is labelled as one — a company with too little history
 * gets no figure at all rather than a made-up one.
 */
export const MIN_SAMPLES = 3;

function millis(ts: unknown): number {
  return (ts as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
}

/** Median, not mean: one company that answered a question three weeks late
 *  should not drag the whole estimate with it. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Hours a student typically waits, or null when there is not enough history.
 * Gaps beyond a week are dropped: they are almost always someone returning to
 * the portal days later, not a reply.
 */
export function estimateReplyHours(logs: ChatLog[]): number | null {
  const times = logs.map((log) => millis(log.createdAt)).filter(Boolean).sort((a, b) => a - b);
  if (times.length < MIN_SAMPLES + 1) return null;

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    const hours = (times[i] - times[i - 1]) / 3_600_000;
    if (hours > 0 && hours <= 24 * 7) gaps.push(hours);
  }
  if (gaps.length < MIN_SAMPLES) return null;
  return Math.round(median(gaps) * 10) / 10;
}

/** Human phrasing for an estimate. Vague on purpose — it is not a promise. */
export function replyTimeLabel(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours < 1) return "usually replies within the hour";
  if (hours < 24) return `usually replies in about ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `usually replies in about ${days} day${days === 1 ? "" : "s"}`;
}

/** wa.me deep link. Digits only; the caller supplies a prefilled message. */
export function whatsappLink(number: string, message: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
