// lib/tools/runTool.ts
import { TOOLS } from "./registry";
import { withRetry } from "./retry";

export function asOpenAITools() {
  return TOOLS.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export async function runToolByName(name: string, args: any) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
  return withRetry(() => tool.run(args), { retries: 2, baseMs: 300 });
}