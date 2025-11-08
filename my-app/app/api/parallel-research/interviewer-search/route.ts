import { NextResponse, NextRequest } from "next/server";
import { Parallel } from "parallel-web";

export async function POST(request: NextRequest) {
  try {
    //Extract the interviewer, and company from the body and validate the request
    const body = await request.json().catch(() => ({}));
    const interviewer = (
      body.interviewer ??
      body.interviewer_name ??
      ""
    ).trim();
    const company = (body.company ?? body.company_name ?? "").trim();
    const jobURL = (body.jobURL ?? body.job_link ?? "").trim();

    //Check to ensure we have the needed field of interviewer
    if (!interviewer) {
      return NextResponse.json(
        JSON.stringify({ error: "Missing the interviewer name to search for" }),
        { status: 400 }
      );
    }

    //Check to ensure we have an API key to call
    if (!process.env.PARALLEL_API_KEY) {
      return NextResponse.json(
        { error: "Missing PARALLEL_API_KEY on the server" },
        { status: 500 }
      );
    }

    //Create the parallel client
    const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });
    console.log("Company: ", company);
    console.log("Interviewer Name: ", interviewer);
    console.log("JobURL: ", jobURL);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error initializing Parallel client." },
      { status: 500 }
    );
  }
}
