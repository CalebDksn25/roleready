import { NextResponse, NextRequest } from "next/server";
import { Parallel } from "parallel-web";

export async function POST(request: NextRequest) {
  try {
    const client = new Parallel({ apiKey: process.env.PARALLEL_API_KEY! });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error initializing Parallel client." },
      { status: 500 }
    );
  }
}
