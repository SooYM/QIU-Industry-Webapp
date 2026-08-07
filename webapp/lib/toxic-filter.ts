/**
 * Toxicity gate for everywhere a student types at a company or a speaker: the
 * live talk Q&A and the assistant chatboxes.
 *
 * WHY THIS IS TOKEN-BASED, NOT ONE BIG REGEX
 * A single regex over the whole message kept failing in both directions.
 * `\bshit\b` never matches "bullshit" (there is no word boundary between "l"
 * and "s"), while loosening the boundaries made "mass hit" and "do you recycle
 * your trash?" trip the filter. Splitting into words first fixes both: a stem
 * matches ANYWHERE inside a single word, and words never join across a space.
 *
 * Each token is normalised before matching, so "sh1t", "f*ck", "fuuuck" and
 * "f u c k" all collapse onto the same form. Deliberate obfuscations that are
 * not substrings of the real word ("fk", "fxk", "wtf") are listed explicitly —
 * no pattern can derive those without also eating ordinary words.
 *
 * The list stays narrow on purpose. This portal exists so students can ask
 * employers hard questions; "is this a scam?", "I don't like the hours" and
 * "the process is stupid" must all get through. A filter that eats real
 * questions teaches students not to ask, which costs more than it saves.
 *
 * LIMITATION: this runs in the browser and is bypassable by anyone willing to
 * open the console. It reduces accidental and casual abuse. It is not a
 * security control, and the security rules do not inspect message content.
 */

/** Matched anywhere inside a single word — "bullshit" and "shithead" both hit. */
const STEMS = [
  "fuck", "shit", "shite", "bitch", "cunt", "slut", "whore", "nigger", "nigga",
  "faggot", "retard", "wanker", "asshole", "arsehole", "bastard", "dickhead",
  "motherfuck", "bollock", "twat", "prick",
];

/**
 * Deliberate obfuscations, matched as a WHOLE word. These are not substrings of
 * the real word, so no stem rule catches them — and matching them loosely would
 * wreck ordinary words ("fk" inside "folk", "arse" inside "coarse").
 */
const OBFUSCATIONS = new Set([
  "fk", "fck", "fuk", "fux", "fxk", "fkin", "fkn", "fking", "fcking", "fukin",
  "phuck", "phuk", "wtf", "stfu", "gtfo", "ffs", "fu", "fuc",
  "sht", "shyt", "btch", "biatch", "azz", "arse", "cnt", "dik",
]);

/** Whole-message patterns: threats, sexual remarks, and abuse aimed at a person. */
const PHRASES: RegExp[] = [
  /\b(kill\s+your\s?self|kys|go\s+die|hope\s+you\s+die|die\s+in\s+a\s+fire|i'?ll\s+(kill|hurt|find)\s+you)\b/,
  /\b(send\s+nudes|nudes?|porn|dick\s?pic|horny)\b|\b(sexy|hot)\s+(speaker|presenter|girl|guy|recruiter|hr)\b/,
  // The insult must be pointed at someone: "you are an idiot" is abuse,
  // "the process is stupid" is feedback.
  /\b(you|your|u|ur|he|she|they)('?re|\s+(are|is|r|look|sound|seem)s?)?\s+(a\s+|an\s+|so\s+|such\s+a\s+)?(idiot|moron|stupid|dumb(ass)?|loser|ugly|pathetic|worthless|clown|scum)\b/,
  // Hostility as a verb. The object is required: "I hate you" is abuse,
  // "I hate the commute" is not.
  /\b(hate|despise|loathe)\s+(you|u|ur|your\s+(guts|face))\b|\b(shut\s+up|screw\s+you|piss\s+off)\b/,
  // Dislike aimed at a person, with or without the apostrophe and with the
  // optional filler people actually type: "i dont like you", "i really don't
  // like you guys". Aimed at a THING it stays allowed — "I don't like the
  // hours" is feedback a company should hear.
  /\b(do\s?n'?o?t|don'?t|dont|didn'?t|never)\s+(really\s+|even\s+|at\s+all\s+)?(like|respect|trust)\s+(you|u|ur|him|her|them)\b/,
  /\bi\s+(really\s+|just\s+)?(dislike|despise|detest)\s+(you|u|ur|him|her|them)\b/,
];

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "@": "a", "$": "s", "!": "i", "+": "t",
};

/** Strips obfuscation from one word: leet digits and symbols. */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[0134578@$!+]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, "");
}

/**
 * "fuuuuck" -> "fuck". Only runs of THREE or more collapse: a doubled letter is
 * ordinary English, and squashing pairs turns "shiitake" into "shitake" and
 * "sheet" into "shet", both of which would then match a stem. Three in a row is
 * deliberate stretching, not spelling.
 */
const collapseRuns = (word: string) => word.replace(/(.)\1{2,}/g, "$1");

/**
 * Splits into words, first joining runs of single characters so "f u c k" and
 * "s.h.i.t" become one token. Only single-character runs are joined — joining
 * everything would turn "mass hit" into profanity.
 */
function tokenize(text: string): string[] {
  const joined = text
    .toLowerCase()
    .replace(/\b(?:[a-z0-9][\s.\-_*+]+){2,}[a-z0-9]\b/g, (run) => run.replace(/[\s.\-_*+]/g, ""));
  return joined.split(/\s+/).map(normalizeWord).filter(Boolean);
}

export const TOXIC_REPLY =
  "⚠️ Your message was flagged for containing inappropriate or offensive content. Please maintain professional communication.";

export interface ToxicityResult {
  isToxic: boolean;
  score?: number;
  reason?: string;
}

export function isToxicText(text: string): boolean {
  if (PHRASES.some((pattern) => pattern.test(text.toLowerCase()))) return true;
  return tokenize(text).some((token) => {
    if (OBFUSCATIONS.has(token)) return true;
    const squashed = collapseRuns(token);
    return STEMS.some((stem) => token.includes(stem) || squashed.includes(collapseRuns(stem)));
  });
}

/** Optional remote classifier. No config = local pass only. */
const REMOTE_ENDPOINT =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_TOXIC_API_URL : undefined;

type Prediction = { label: string; score: number };

function highestToxicScore(payload: unknown): number {
  if (!Array.isArray(payload)) return 0;
  // HF text-classification returns either [{label,score},…] or [[{…}]].
  const rows = (Array.isArray(payload[0]) ? payload[0] : payload) as Prediction[];
  return rows
    .filter((p) => p && typeof p.label === "string" && /toxic|hate|offensive|insult|obscene|threat/i.test(p.label))
    .reduce((best, p) => Math.max(best, Number(p.score) || 0), 0);
}

/**
 * Screens one message. The local pass always runs; Intel/toxic-prompt-roberta
 * runs after it when NEXT_PUBLIC_TOXIC_API_URL points at a proxy holding the
 * Hugging Face token. This app is a static export, so there is no server route
 * to hide a key behind — never put the token itself in a NEXT_PUBLIC_ variable,
 * as everything with that prefix ships in the JS the browser downloads.
 */
export async function checkToxicContent(text: string): Promise<ToxicityResult> {
  const trimmed = text.trim();
  if (!trimmed) return { isToxic: false };

  if (isToxicText(trimmed)) {
    return { isToxic: true, score: 1, reason: "Message contains inappropriate or offensive language." };
  }

  if (!REMOTE_ENDPOINT) return { isToxic: false };

  try {
    const response = await fetch(REMOTE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: trimmed }),
    });
    if (!response.ok) return { isToxic: false };

    const score = highestToxicScore(await response.json());
    if (score > 0.5) {
      return { isToxic: true, score, reason: "Message detected as toxic or inappropriate." };
    }
  } catch {
    // The classifier being unreachable must never block a student from asking a
    // question — the local pass above already ran.
  }

  return { isToxic: false };
}
