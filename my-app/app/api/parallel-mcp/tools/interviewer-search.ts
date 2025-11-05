import { tool } from "@anthropic-ai/claude-agent-sdk";
import { parallelClient } from "@/lib/parallelClient";
import { z } from "zod";

export const interviewerSearch = tool(
  "parallel_interviewer_search",
  "Search for public information about an interviewer, including professional background, publications, talks, and interests relevant to professional conversations.",
  {
    interviewer_name: z
      .string()
      .describe("The name of the interviewer to research."),
    company_name: z
      .string()
      .optional()
      .describe(
        "The company or organization the interviewer works for (helps with name disambiguation."
      ),
    guardrails: z
      .object({
        avoid_sensitive_topics: z.boolean().default(true),
        keep_profesional: z.boolean().default(true),
      })
      .default({ avoid_sensitive_topics: true, keep_profesional: true })
      .describe(
        "Flags to ensure that the search results remain appropriate for professional conversations."
      ),
    max_cost_usd: z
      .number()
      .default(0.25)
      .describe("Maximum Parallel API Cost budget in USD."),
    timeout_ms: z
      .number()
      .default(12000)
      .describe("Timeout in milliseconds for the search."),
  },
  async (args) => {
    const data = await parallelClient.run({
      preset: "interviewer",
      ...args,
    });

    return {
      content: [
        {
          type: "text",
          text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);
