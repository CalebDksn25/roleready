import { parallelSearch } from "@/lib/parallelClient";

type companySearchInput = {
  company?: string;
  company_name?: string;
  role?: string;
  jobURL?: string;
  job_link?: string;
  timeout_ms?: number;
};

export async function companySearch(input: companySearchInput) {
  const body = input ?? {};

  const company = (body.company ?? body.company_name ?? "").trim();

  //Check to ensure we got a company to search questions for
  if (!company) {
    throw new Error("Missing company data to search for.");
  }

  if (!process.env.PARALLEL_API_KEY) {
    throw new Error("Missing Parallel API key for search.");
  }

  const search_queries = [company || undefined].filter(Boolean) as string[];

  const objective = [
    "Identify the companies culture, values, and recent news to help prepare tailored interview questions.",
    company && `Company: ${company}`,
    "Prefer primary sources (company site, news articles, employee reviews). Include URLs and short snippets.",
  ]
    .filter(Boolean)
    .join("\n");

  const timeoutMs = body.timeout_ms ?? 15000;
  const withTimeout = <T>(p: Promise<T>) =>
    Promise.race([
      p,
      new Promise<T>((_, r) =>
        setTimeout(() => r(new Error("timeout")), timeoutMs)
      ),
    ]);

  const res = await withTimeout(
    parallelSearch({
      objective: objective,
      search_queries,
      processor: "base",
      max_results: 10,
      max_chars_per_result: 6000,
    })
  );

  const evidence = (res?.results ?? []).map((r: any, i: number) => ({
    id: r.id ?? `question-${i}`,
    type: "question",
    title: r.title ?? r.source ?? "Interview Question Source",
    url: r.url ?? r.link ?? null,
    snippet:
      r.snippet ??
      r.summary ??
      (typeof r.text === "string" ? r.text.slice(0, 280) : null),
    raw: r,
  }));

  console.log("Company Search API called");

  return { evidence };
}
