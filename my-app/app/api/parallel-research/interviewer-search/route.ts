import { interviewerSearch } from "./search";
import { NextResponse, NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await interviewerSearch(body);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error in interviewer Parallel Research API: ", error);

    return NextResponse.json(
      { error: (error as Error).message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
