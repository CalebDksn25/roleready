import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { parallelClient } from "@/lib/parallelClient";

export const companySearch = tool(
  "parallel_company_search",
  "Search for company products, tech stack, culture/values, news, and interview tips.",
  {
    company_name: z.string().describe("The name of the company to research."),
    domain: z
      .string()
      .optional()
      .describe("The company's domain (e.g., openai.com)."),
    lookback_days: z
      .number()
      .default(45)
      .describe("How many days of recent news to include."),
    include: z
      .array(
        z.enum([
          "products",
          "tech_stack",
          "culture",
          "values",
          "news",
          "interview_tips",
        ])
      )
      .default(["products", "culture", "values", "interview_tips"])
      .describe("Which categories of information to retrieve."),
    max_cost_usd: z
      .number()
      .default(0.25)
      .describe("Maximum Parallel API cost budget in USD."),
    timeout_ms: z.number().default(12000).describe("Timeout in milliseconds."),
  },
  async (args) => {
    const data = await parallelClient.run({
      preset: "company",
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
