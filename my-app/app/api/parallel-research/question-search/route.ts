import { NextResponse, NextRequest } from "next/server";
import { Parallel } from "parallel-web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Extract the company from the request body and validate
    const body = await request.json().catch(() => ({}));
    const company = (body.company ?? body.company_name ?? "").trim();
    const role = (body.role ?? "").trim();
    const jobURL = (body.jobURL ?? body.job_link ?? "").trim();

    //Check to ensure we have fields
    if (!company) {
      return NextResponse.json(
        JSON.stringify({ error: "Missing the company to search for." }),
        { status: 400 }
      );
    }
    if (!process.env.PARALLEL_API_KEY) {
      return NextResponse.json(
        { error: "Missing PARALLEL_API_KEY on server" },
        { status: 500 }
      );
    }

    //Create client and ensure API Key exists
    const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY! });
    console.log("Comapny: ", company);
    console.log("Role: ", role);
    console.log("JobURL: ", jobURL);

    //Build the search query
    const search_query = [
      company || undefined,
      role || undefined,
      jobURL || undefined,
      "site:glassdoor.com interview questions",
      "site:reddit.com interview questions",
      "site:leetcode.com interview questions",
    ].filter(Boolean) as string[];

    //Build the objective
    const objective = [
      "Find the most common interview questions for this company/role.",
      company && `Company: ${company}`,
      role && `Role: ${role}`,
      jobURL && `Use this job posting URL if helpful: ${jobURL}`,
    ]
      .filter(Boolean)
      .join("\n");

    //Add a timeout if search is taking > 15s
    const timeoutMs = body.timeout_ms ?? 15000;
    const withTimeout = <T>(p: Promise<T>) =>
      Promise.race([
        p,
        new Promise<T>((_, r) =>
          setTimeout(() => r(new Error("timeout")), timeoutMs)
        ),
      ]);

    //Make the search request to Parallel
    const res = await withTimeout(
      client.beta.search({
        objective: objective,
        search_queries: search_query,
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

    //Send the results back
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
