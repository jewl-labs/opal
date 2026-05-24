export interface FilterResult {
  ok: boolean;
  hits: string[];
}

const INJECTION_PATTERNS = [
  {
    name: "instruction_override",
    pattern: /\b(ignore|disregard|forget|skip|bypass|override|overwrite|replace|discard|cancel|abort|stop)\s+(previous|prior|above|instruction|prompt|request|directive|rule|step)\b/i,
  },
  {
    name: "role_reassignment",
    pattern: /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|assume\s+the\s+role|from\s+now\s+on|instead|behave\s+like)\b/i,
  },
  {
    name: "system_prompt_impersonation",
    pattern: /(system\s*:|as\s+an\s+ai|as\s+a\s+language\s+model|my\s+instructions|my\s+system\s+prompt|my\s+guidelines|my\s+training)/i,
  },
  {
    name: "tag_escape",
    pattern: /(<\s*\/\s*(claim|auxiliary).*?>|<\s*(claim|auxiliary).*?>)/i,
  },
  {
    name: "verdict_injection",
    pattern: /\b(the\s+verdict\s+is|respond\s+with|output\s+|your\s+answer\s+is|the\s+answer\s+is|verdict\s*[:=])\b/i,
  },
  {
    name: "confidence_override",
    pattern: /(?:confidence|confidence_score)\s*[:=]?\s*(?:0\.99|1\.0|1)(?![0-9.])/i,
  },
  {
    name: "json_injection",
    pattern: /["'`]?\s*}\s*[,;]?\s*["'`]?\s*\{?\s*["']?(verdict|injection_detected)/i,
  },
];

const ZERO_WIDTH_CHARS = [
  "​", // Zero-width space
  "‌", // Zero-width non-joiner
  "‍", // Zero-width joiner
  "﻿", // Zero-width no-break space
  "‎", // Left-to-right mark
  "‏", // Right-to-left mark
];

const UNICODE_TAG_LOOKALIKES = [
  "＜", // Fullwidth less-than
  "＞", // Fullwidth greater-than
  "⟨", // Mathematical left angle bracket
  "⟩", // Mathematical right angle bracket
];

export function filterInjection(text: string): FilterResult {
  const hits: string[] = [];

  for (const { name, pattern } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      hits.push(name);
    }
  }

  for (const char of ZERO_WIDTH_CHARS) {
    if (text.includes(char)) {
      hits.push("zero_width_char");
      break;
    }
  }

  for (const char of UNICODE_TAG_LOOKALIKES) {
    if (text.includes(char)) {
      hits.push("unicode_tag_lookalike");
      break;
    }
  }

  return {
    ok: hits.length === 0,
    hits,
  };
}
