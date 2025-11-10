import { NextResponse, NextRequest } from "next/server";
import { Parallel } from "parallel-web/client.js";

export async function POST(request: NextRequest) {
  try {
    //Parse the body of request
    const body = await request.json().catch(() => ({} as any));

    //Normalize the inputs
    const company = (body.company ?? body.company_name ?? "").trim();

    //Check for API key before building client
    if (!process.env.PARALLEL_API_KEY) {
      return NextResponse.json(
        { error: "Missing PARALLEL_API_KEY on the server" },
        { status: 500 }
      );
    }

    const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY! });

    //Build the search queries
    const q = (s?: string) => (s ? `"${s}` : undefined);

    const search_queries = [
      //Direct entity combos
      company || undefined,
    ].filter(Boolean) as string[];

    //Build the objective
    const objective = [
      "Identify the companies culture, values, and recent news to help prepare tailored interview questions.",
      company && `Company: ${company}`,
      "Prefer primary sources (company site, news articles, employee reviews). Include URLs and short snippets.",
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

    //Execute the parallel search
    const res = await withTimeout(
      client.beta.search({
        objective,
        search_queries,
        processor: "base",
        max_results: 10,
        max_chars_per_result: 6000,
      })
    );

    //Normalize the result to "evidence" (sources)
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

    //Return the response
    return NextResponse.json({
      objective,
      search_queries,
      evidence,
    });
  } catch (error: any) {
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
