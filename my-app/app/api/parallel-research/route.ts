import { NextResponse, NextRequest } from "next/server";
import { questionSearch } from "./question-search/search";
import { companySearch } from "./company-search/search";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    //Start all of the parallel searches
    const [companyData, questionData] = await Promise.all([
      companySearch(body),
      questionSearch(body),
    ]);

    //Combine results to pass to claude
    const allData = {
      original_request: body,
      company: companyData,
      questions: questionData,
    };

    //Call OpenAI to summarize and analyze
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content:
            "You are an expert interview prep assisntant.\n\n" +
            "Using the following data, help the user prepare for their interview by providing tailored advice, suggested questions to ask, and strategies to succeed.\n\n" +
            "Here is aggregated research data from multiple sources:\n\n" +
            "Please analyze it and produce a consise, structured summary " +
            "That highlights: \n" +
            "- The most common interview questions\n" +
            "- Themes across sources\n" +
            "- Insights about the company, role, and expectations\n" +
            "Any red flags or patterns\n\n" +
            "DATA: \n\n" +
            JSON.stringify(allData, null, 2),
        },
      ],
      max_tokens: 800,
      temperature: 0.5,
    });

    //Return the response
    return NextResponse.json({
      aggregated: allData,
      summary: response.choices[0].message?.content ?? "",
    });
  } catch (error: any) {
    console.error("Error in the Parallel to OPEN AI Research call: ", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error Occured" },
      { status: 500 }
    );
  }
}
