import { parallelSearch } from "@/lib/parallelClient";

type questionSearchInput = {
  company?: string;
  company_name?: string;
  role?: string;
  jobURL?: string;
  job_link?: string;
  timeout_ms?: number;
};

export async function questionSearch(input: questionSearchInput) {
  const body = input ?? {};

  const company = (body.company ?? body.company_name ?? "").trim();
  const role = (body.role ?? "").trim();
  const companyRole = `${company} ${role}`.trim();

  //Check to ensure we got data to search for
  if (!company) {
    throw new Error("Missing company to search data for.");
  }
  if (!role) {
    throw new Error("Missing role to search data for.");
  }

  const search_queries = [
    companyRole || undefined,
    "site:glassdoor.com interview questions",
    "site:reddit.com interview questions",
    "site:indeed.com interview questions",
  ].filter(Boolean) as string[];

  const objective = [
    "Find the most commonly asked interview questions for this company and role.",
    company && `Company: ${company}`,
    role && `Role: ${role}`,
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

  console.log("Question Search API called");

  return { evidence };
}
