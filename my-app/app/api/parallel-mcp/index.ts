import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { companySearch } from "./tools/company-search";
import { interviewerSearch } from "./tools/interviewer-search";
import { questionSearch } from "./tools/question-search";

export const mcpServer = createSdkMcpServer({
  name: "ai-interview-prep-mcp-server",
  version: "1.0.0",
  tools: [companySearch, interviewerSearch, questionSearch],
});
