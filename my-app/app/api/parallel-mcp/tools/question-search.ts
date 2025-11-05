import { tool } from "@anthropic-ai/claude-agent-sdk";
import { parallelClient } from "@/lib/parallelClient";
import { z } from "zod";

export const questionSearch = tool(
  "parallel_question_search",
  "Search for commonly asked interview questions for a specific company, role, and/or technology stack.",
  {
    company_name: z
      .string()
      .optional()
      .describe("The name of the company to search for."),
    role: z
      .string()
      .optional()
      .describe("The specific role or job title to search for."),
    technologies: z
      .array(z.string())
      .optional()
      .describe(
        "A list of relevant technologies, programming languages, or frameworks."
      ),
    max_cost_usd: z
      .number()
      .default(0.25)
      .describe("Maximum Parallel API cost budget in USD."),
    timeout_ms: z
      .number()
      .default(12000)
      .describe("Timeout in milliseconds for the search."),
  },
  async (args) => {
    const data = await parallelClient.run({
      preset: "questions",
      ...args,
    });

    const text =
      typeof data === "string"
        ? data
        : Object.keys(data ?? {}).length
        ? JSON.stringify(data, null, 2)
        : "No relevant interview questions found.";

    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  }
);
