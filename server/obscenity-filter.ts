const BLOCKED_WORDS = [
  "fuck", "shit", "ass", "bitch", "dick", "cock", "pussy", "damn",
  "bastard", "cunt", "whore", "slut", "fag", "nigger", "nigga",
  "retard", "twat", "wanker", "piss", "bollocks", "arse",
  "motherfucker", "asshole", "bullshit", "goddamn", "douchebag",
  "jackass", "dipshit", "shithead", "dumbass", "fatass",
  "stfu", "gtfo", "lmfao", "wtf", "kys", "killyourself",
];

const BLOCKED_PATTERNS = BLOCKED_WORDS.map((word) => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const leetSpeak = escaped
    .replace(/a/gi, "[a@4]")
    .replace(/e/gi, "[e3]")
    .replace(/i/gi, "[i1!|]")
    .replace(/o/gi, "[o0]")
    .replace(/s/gi, "[s$5]")
    .replace(/t/gi, "[t7]")
    .replace(/l/gi, "[l1|]");
  return new RegExp(`\\b${leetSpeak}\\b`, "gi");
});

export function filterObscenity(text: string): string {
  let filtered = text;
  for (const pattern of BLOCKED_PATTERNS) {
    filtered = filtered.replace(pattern, (match) => "*".repeat(match.length));
  }
  return filtered;
}

export function containsObscenity(text: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}
