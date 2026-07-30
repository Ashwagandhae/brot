import type { CodeResult } from "../../src-tauri/bindings/CodeResult";
import EvalWorker from "./workers/evalWorker?worker";
export interface WorkerInput {
  code: string;
}

export type WorkerOutput = CodeResult;
export async function runJsCode(
  code: string,
  timeout = 2000,
): Promise<CodeResult> {
  const worker = new EvalWorker();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ type: "error", message: "Execution timed out" });
    }, timeout);

    worker.onmessage = (e: MessageEvent<WorkerOutput>) => {
      clearTimeout(timer);
      worker.terminate();

      const response = e.data;
      resolve(response);
    };

    worker.postMessage({ code } as WorkerInput);
  });
}
