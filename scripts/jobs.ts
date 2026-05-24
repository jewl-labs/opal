import { VERIFIER_PROMPT, VERDICT_ENCODING } from "./constants";

export interface OracleJobTask {
  httpTask?: {
    url: string;
    method: "GET" | "POST" | "PUT";
    headers?: Record<string, string>;
    body?: string;
  };
  jsonParseTask?: {
    path: string;
  };
  stringMapTask?: {
    map: Record<string, string>;
    defaultValue: string;
  };
}

export interface OracleJob {
  tasks: OracleJobTask[];
}

export function buildOracleJob(): OracleJob {
  return {
    tasks: [
      {
        httpTask: {
          url: "https://api.openai.com/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer ${OPENAI_API_KEY}",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: VERIFIER_PROMPT,
              },
            ],
            temperature: 0,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "OpalVerdict",
                schema: {
                  type: "object",
                  properties: {
                    verdict: {
                      type: "string",
                      enum: ["TRUE", "FALSE", "TOO_EARLY", "UNRESOLVABLE"],
                    },
                    confidence: { type: "number" },
                    sources: { type: "array", items: { type: "string" } },
                    reasoning: { type: "string" },
                    injection_detected: { type: "boolean" },
                  },
                  required: [
                    "verdict",
                    "confidence",
                    "sources",
                    "reasoning",
                    "injection_detected",
                  ],
                },
              },
            },
          }),
        },
      },
      {
        jsonParseTask: {
          path: "$.choices[0].message.content",
        },
      },
      {
        jsonParseTask: {
          path: "$.verdict",
        },
      },
      {
        stringMapTask: {
          map: {
            TRUE: String(VERDICT_ENCODING.TRUE),
            FALSE: String(VERDICT_ENCODING.FALSE),
            TOO_EARLY: String(VERDICT_ENCODING.TOO_EARLY),
            UNRESOLVABLE: String(VERDICT_ENCODING.UNRESOLVABLE),
          },
          defaultValue: String(VERDICT_ENCODING.UNRESOLVABLE),
        },
      },
    ],
  };
}
