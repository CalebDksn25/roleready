import { NextResponse, NextRequest } from "next/server";
import { Parallel } from "parallel-web";

export async function POST(request: NextRequest) {
  //Check to ensure we have an API key to call
  const apiKey = process.env.PARALLEL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing Parallel API key." },
      { status: 500 }
    );
  }

  const client = new Parallel({ apiKey });
}
