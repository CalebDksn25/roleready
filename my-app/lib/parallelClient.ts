// lib/parallelClient.ts
import { Parallel } from "parallel-web";

if (!process.env.PARALLEL_API_KEY) {
  throw new Error("Missing PARALLEL_API_KEY environment variable");
}

// Singleton client instance
export const parallelClient = new Parallel({
  apiKey: process.env.PARALLEL_API_KEY,
});

// Optional: helper for search
export async function parallelSearch(options: {
  objective: string;
  search_queries: string[];
  processor?: string;
  max_results?: number;
  max_chars_per_result?: number;
  timeout_ms?: number;
}) {
  const {
    objective,
    search_queries,
    processor = "base",
    max_results = 10,
    max_chars_per_result = 6000,
    timeout_ms = 15000,
  } = options;

  const withTimeout = <T>(p: Promise<T>) =>
    Promise.race<T>([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeout_ms)
      ),
    ]);

  return withTimeout(
    parallelClient.beta.search({
      objective,
      search_queries,
      processor: "base",
      max_results,
      max_chars_per_result,
    })
  );
}
