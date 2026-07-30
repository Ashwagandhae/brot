import type { CodeResult } from "../../src-tauri/bindings/CodeResult";
import { msg } from "./message";
import { runJsCode } from "./runJsCode";

const timeout = 200;
export async function runCode(
  code: string,
  language: string | null,
): Promise<CodeResult> {
  let lang = language ?? "plaintext";

  if (["javascript", "js"].includes(lang)) {
    return await runJsCode(code, timeout);
  }

  if (["text", "plaintext", "txt"].includes(lang)) {
    return getTextStats(code);
  }

  if (["python", "py"].includes(lang)) {
    return await msg("runCode", { code });
  }

  return {
    type: "error",
    message: `unsupported language ${language}`,
  };
}

function getTextStats(code: string): CodeResult {
  let chars = code.length;
  let words = code.split(" ").filter((x) => x !== "").length;

  return { type: "ok", text: `chars: ${chars}, words: ${words}` };
}
