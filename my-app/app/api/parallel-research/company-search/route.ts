import { NextResponse, NextRequest } from "next/server";
import { companySearch } from "./search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await companySearch(body);

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Error in Parallel Research API:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
