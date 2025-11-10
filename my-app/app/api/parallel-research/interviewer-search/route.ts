import { NextResponse, NextRequest } from "next/server";
import { Parallel } from "parallel-web";

export async function POST(request: NextRequest) {
  try {
    // Parse body safely
    const body = await request.json().catch(() => ({} as any));

    // Normalize inputs
    const interviewer = (
      body.interviewer ??
      body.interviewer_name ??
      ""
    ).trim();
    const company = (
      body.company ??
      body.company_name ??
      body.company_legal_name ??
      body.org ??
      ""
    ).trim();

    const companyDomain = (body.company_domain ?? body.domain ?? "").trim();

    if (!process.env.PARALLEL_API_KEY) {
      return NextResponse.json(
        { error: "Missing PARALLEL_API_KEY on the server" },
        { status: 500 }
      );
    }

    const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });

    // Build search queries (prefer quoted exacts and profile sites)
    const q = (s?: string) => (s ? `"${s}"` : undefined);

    const search_queries = [
      // Direct entity combos
      interviewer && company ? `${q(interviewer)} ${q(company)}` : undefined,
      interviewer || undefined,
      company || undefined,

      /*}

      // Profiles
      interviewer && `site:linkedin.com/in ${q(interviewer)}`,
      company && `site:linkedin.com/company ${q(company)}`,
      interviewer && `site:x.com ${q(interviewer)}`,
      interviewer && `site:twitter.com ${q(interviewer)}`,
      interviewer &&
        company &&
        `site:github.com ${q(interviewer)} ${q(company)}`,

      // Interview insights
      company && `site:glassdoor.com interview ${q(company)}`,
      company && `site:reddit.com r/cscareerquestions ${q(company)} interview`,
      company && `site:blind.com ${q(company)} interview`,
      */ // Domain-based searches
    ].filter(Boolean) as string[];

    // Build objective
    const objective = [
      "Identify the interviewer associated with the uploaded company data and return relevant details about their background, role, and interests to create personalized questions for the interview.",
      company && `Company: ${company}`,
      interviewer && `Interviewer Name: ${interviewer}`,
      "Prefer primary sources (LinkedIn, company site, talks, posts). Include URLs and short snippets.",
    ]
      .filter(Boolean)
      .join("\n");

    // Timeout guard
    const timeoutMs = Number(body.timeout_ms ?? 15000);
    const withTimeout = <T>(p: Promise<T>) =>
      Promise.race<T>([
        p,
        new Promise<T>((_, r) =>
          setTimeout(() => r(new Error("timeout")), timeoutMs)
        ),
      ]);

    // Execute Parallel search
    const res = await withTimeout(
      client.beta.search({
        objective,
        search_queries,
        processor: "base",
        max_results: 10,
        max_chars_per_result: 6000,
      })
    );

    // Normalize results to "evidence" (sources)
    const evidence =
      (res?.results ?? []).map((r: any, i: number) => ({
        id: r.id ?? `source-${i}`,
        type: "source",
        title: r.title ?? r.source ?? "Source",
        url: r.url ?? r.link ?? null,
        snippet:
          r.snippet ??
          r.summary ??
          (typeof r.text === "string" ? r.text.slice(0, 280) : null),
        raw: r,
      })) ?? [];

    return NextResponse.json({
      objective,
      search_queries,
      evidence,
    });
  } catch (error: unknown) {
    console.error("Error calling Parallel Search API:", error);
    const message = error instanceof Error ? error.message : String(error);

    // Distinguish timeout vs other errors
    const status = message === "timeout" ? 504 : 500;
    const userMessage =
      message === "timeout"
        ? "The search timed out before completing."
        : "Error initializing or calling the Parallel API.";

    return NextResponse.json(
      { error: userMessage, details: message },
      { status }
    );
  }
}
