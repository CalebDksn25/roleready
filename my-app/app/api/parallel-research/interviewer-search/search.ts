import { parallelClient, parallelSearch } from "@/lib/parallelClient";

type interviewerSearchInput = {
  interviewer_linkedin_url?: string;
  timeout_ms?: number;
};

export async function interviewerSearch(input: interviewerSearchInput) {
  // Get body input and ensure we have interviewer linkedin
  const interviewerLinkedInURL = input.interviewer_linkedin_url;

  if (!interviewerLinkedInURL) {
    throw new Error("Missing interviewer LinkedIn URL to search for.");
  }

  // Declare Search Queries and objectives
  const search_queries = [interviewerLinkedInURL];

  const objective = [
    "Given the following LinkedIn URL, extract key professional, educational, and extracurricular information that can be used to create thoughtful, personalized interview questions tailored to their background, experiences, achievements, and interests.",
    `LinkedIn URL: ${interviewerLinkedInURL}`,
  ].join("\n");

  const timeoutMs = input.timeout_ms ?? 15000;
  const withTimeout = <T>(p: Promise<T>) =>
    Promise.race([
      p,
      new Promise<T>((_, r) =>
        setTimeout(() => r(new Error("timeout")), timeoutMs)
      ),
    ]);

  // Call parallel client for response
  const res = await withTimeout(
    parallelSearch({
      objective,
      search_queries,
      processor: "base",
      max_results: 1,
      max_chars_per_result: 6000,
    })
  );

  // Clean result and return evidence
  const evidence = (res?.results ?? []).map((r: any, i: number) => ({
    id: r.id ?? `person-${i}`,
    type: "LinkedIn User",
    title: r.title ?? r.source ?? "LinkedIn Profile",
    url: r.url ?? r.link ?? null,
    raw: r,
  }));

  console.log("Interviewer Search Called.");

  return { evidence };
}
