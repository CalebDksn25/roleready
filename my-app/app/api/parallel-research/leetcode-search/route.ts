import { NextResponse, NextRequest } from "next/server";
import { Parallel } from "parallel-web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    //Extract the body from request and validate
    const body = await request.json().catch(() => ({}));
    const company = (body.company ?? body.company_name ?? "").trim();
    const role = (body.role ?? "").trim();

    //Check to ensure we have company and role fields
    if (!company) {
      return NextResponse.json(
        JSON.stringify({ error: "Missing company name from request." }),
        { status: 400 }
      );
    }
    if (!role) {
      return NextResponse.json(
        JSON.stringify({ error: "Missing role to search for." })
      );
    }

    //Check to ensure we have API key and create client
    if (!process.env.PARALLEL_API_KEY) {
      return NextResponse.json(
        { error: "Missing Parallel API Key." },
        { status: 500 }
      );
    }

    const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });

    //Build the search query to find technical leetcode questions given role

    const search_queries = [
      //Official LeetCode company problems & tags
      `site:leetcode.com/company/${company.toLowerCase().replace(/\s+/g, "-")}`,

      //LeetCode discussions mentioning interview questions
      `site:leetcode.com/discuss "interview questions" ${company}`,

      //GitHub repos with curated problem sets
      `site:github.com ${company} leetcode interview questions`,

      //Medium or blog posts summarizing company interview prep
      `site:medium.com ${company} leetcode interview`,

      //Reddit discussions (LeetCode & interview prep)
      `site:reddit.com ${company} leetcode interview questions`,
    ];

    const objective = `
    Find LeetCode-style interview questions asked by ${company}.
    Prefer official LeetCode company pages, discussion threads, and GitHub repositories.
    Return 5–10 representative questions with short summaries and URLs.
    Exclude unrelated results.
    `;

    //Add a timeout if search is taking > 15s
    const timeoutMs = body.timeout_ms ?? 15000;
    const withTimeout = <T>(p: Promise<T>) =>
      Promise.race([
        p,
        new Promise<T>((_, r) =>
          setTimeout(() => r(new Error("timeout")), timeoutMs)
        ),
      ]);

    //Make a search request to parallel
    const res = await withTimeout(
      client.beta.search({
        objective: objective,
        search_queries: search_queries,
        processor: "base",
        max_results: 10,
        max_chars_per_result: 6000,
      })
    );

    //Take the uploaded evidence and normalize it so AI can cite source_ids
    const evidence = (res?.results ?? []).map((r: any, i: number) => ({
      id: r.id ?? `question-${i}`,
      type: "question",
      title: r.title ?? r.source ?? "Interview question source",
      url: r.url ?? r.link ?? null,
      snippet:
        r.snippet ??
        r.summary ??
        (typeof r.text === "string" ? r.text.slice(0, 280) : null),
      raw: r,
    }));

    //Return the response
    return NextResponse.json({ evidence });
  } catch (error) {
    console.error("Error calling Parallel Search API: ", error);

    //Log the full error message
    if (error instanceof Error) {
      console.error("Error message: ", error.message);
      console.error("Error stack: ", error.stack);
    }

    //Send the error message to the fronend
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Error initializing Parallel client.", details: errorMessage },
      { status: 500 }
    );
  }
}
