/**
 * Prepares text for a speech voice. Captions and slides keep the original; only what is SPOKEN changes.
 *
 * The rule is the usual one for spoken English: an initialism is said letter by letter (AI is "A I", KPI is "K P I"), an acronym
 * is said as a word (SWOT, RACI, NASA), and written shorthand is said in full ("e.g." is "for example", "%" is "percent").
 * Speech engines guess, and often guess wrong on short capitals: "AI" comes out as one sound. Spelling the letters apart
 * removes the guess on every voice, on every device.
 */

/** Capitals that are said as a word. Everything else in capitals, two to five letters long, is spelled out. */
const SAID_AS_WORDS = new Set([
  "SWOT", "RACI", "SMART", "STAR", "PEST", "PESTLE", "NASA", "NATO", "ASAP", "PIN", "SIM", "RAM", "ROM", "LASER", "RADAR", "SCUBA", "AIDS", "UNESCO", "UNICEF", "OPEC", "ASEAN",
  "SIPOC", "DMAIC", "KANBAN", "KAIZEN", "LEAN", "SCRUM", "AGILE", "JPEG", "GIF", "WIFI", "SAAS", "PAAS", "IAAS", "CAPEX", "OPEX", "EBITDA", "GAAP", "FOMO", "YOLO", "NEFT", "IMPS", "RERA", "SEBI", "NABARD", "ISRO", "AADHAAR",
  "OK", "AM", "PM", "US", "IT", "IS", "IN", "ON", "AT", "TO", "OF", "OR", "AN", "AS", "BE", "BY", "DO", "GO", "HE", "IF", "ME", "MY", "NO", "SO", "UP", "WE",
  "THE", "AND", "FOR", "NOT", "BUT", "YOU", "ALL", "CAN", "HAS", "WAS", "ONE", "OUR", "OUT", "WHO", "WHY", "HOW", "NOW", "NEW", "USE", "TWO", "ANY", "ARE", "YES", "DAY", "TOP", "KEY", "END", "ASK", "TRY", "FIX", "SEE", "SAY", "GET", "SET", "RUN", "ACT", "PLAN", "DO", "CHECK", "WHAT", "WHEN", "WHERE", "WHICH", "THIS", "THAT", "WITH", "FROM", "YOUR", "TURN", "STEP", "RULE", "NOTE", "TIP", "CASE", "MUST", "ONLY", "EVERY", "NEVER", "ALWAYS", "STOP", "START", "DONE",
]);

/** Initialisms a learner hears often, written the way they should sound. These win over the general rule. */
const FIXED: Array<[RegExp, string]> = [
  [/\bGen\s?AI\b/g, "Gen A I"],
  [/\bAI\b/g, "A I"],
  [/\bA\.I\./g, "A I"],
  [/\bIT\b(?=\s+(?:team|department|system|systems|support|services|sector|industry|company|companies|infrastructure|skills|security|manager|head|budget))/g, "I T"],
  [/\bUS\b(?=\s+(?:English|dollar|dollars|market|economy|company|companies|based|government|firm|firms))/g, "U S"],
  [/\be\.g\.,?/gi, "for example,"],
  [/\bi\.e\.,?/gi, "that is,"],
  [/\betc\.?(?=\s|$|[,;)])/gi, "and so on"],
  [/\bvs\.?(?=\s)/gi, "versus"],
  [/\bw\/o\b/gi, "without"],
  [/\bNo\.\s?(?=\d)/g, "number "],
  [/&/g, " and "],
  [/(\d)\s?%/g, "$1 percent"],
  [/₹\s?([\d,.]+)\s?(crore|lakh|thousand|million|billion)?/gi, (_m: string, amount: string, unit?: string) => `${amount}${unit ? ` ${unit}` : ""} rupees`] as unknown as [RegExp, string],
  [/\$\s?([\d,.]+)\s?(thousand|million|billion)?/gi, (_m: string, amount: string, unit?: string) => `${amount}${unit ? ` ${unit}` : ""} dollars`] as unknown as [RegExp, string],
  [/(\d)\s?x\b/g, "$1 times"],
  [/\b5W2H\b/g, "five W two H"],
  [/\b5\s?Whys\b/gi, "five whys"],
  [/\b80\/20\b/g, "eighty twenty"],
  [/\bQ([1-4])\b/g, "quarter $1"],
  [/(\w)\/(\w)/g, "$1 or $2"],
];

export function forSpeech(text: string): string {
  let spoken = text;
  for (const [pattern, replacement] of FIXED) spoken = spoken.replace(pattern, replacement as string);
  // The general rule: capitals of two to five letters that are not said as a word are spelled out, with a plural "s" kept ("KPIs" is "K P I s").
  spoken = spoken.replace(/\b([A-Z]{2,5})(s)?\b/g, (match: string, letters: string, plural?: string) => (SAID_AS_WORDS.has(letters) ? match : `${letters.split("").join(" ")}${plural ? "s" : ""}`));
  return spoken.replace(/[ \t]{2,}/g, " ").trim();
}
