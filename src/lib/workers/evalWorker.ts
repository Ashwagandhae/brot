import type { WorkerInput, WorkerOutput } from "$lib/runJsCode";

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { code } = e.data;
  const logs: string[] = [];

  const mockConsole = {
    log: (...args: any[]) => logs.push(args.map(String).join(" ")),
    warn: (...args: any[]) => logs.push(args.map(String).join(" ")),
    error: (...args: any[]) => logs.push(args.map(String).join(" ")),
  };

  try {
    let result: any;

    const lines = code.trim().split("\n");
    const lastLineIndex = lines.length - 1;
    const previousLines = lines.slice(0, lastLineIndex).join("\n");
    const lastLine = lines[lastLineIndex];

    try {
      const wrappedCode = `${previousLines}\nreturn (${lastLine});`;
      result = new Function("console", wrappedCode)(mockConsole);
    } catch {
      result = new Function("console", code)(mockConsole);
    }

    const response: WorkerOutput =
      logs.length > 0
        ? { type: "ok", text: logs.join("\n") }
        : { type: "ok", text: String(result) };

    ctx.postMessage(response);
  } catch (err) {
    ctx.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
