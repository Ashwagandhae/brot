import * as katex from "katex";

export type ParseResult<T> =
  | {
      type: "ok";
      val: T;
      message?: string;
    }
  | {
      type: "err";
      message: string;
    };

export function parseOk<T>(val: T, message?: string): ParseResult<T> {
  return { type: "ok", val, message };
}

export function parseErr<T>(message: string): ParseResult<T> {
  return { type: "err", message };
}

export function parseErrFromErr<T>(err: unknown): ParseResult<T> {
  if (err instanceof Error) {
    return parseErr(err.message);
  }
  return parseErr("unknown error");
}

export function parseUrlFromString(str: string): ParseResult<URL> {
  try {
    let url = new URL(str);
    return parseOk(url, url.toString());
  } catch {
    try {
      let url = new URL("http://" + str);
      return parseOk(url, url.toString());
    } catch (err) {
      return parseErrFromErr(err);
    }
  }
}

export function parseNumberFromString(str: string): ParseResult<number> {
  if (str.trim() === "") return parseErr("empty string");
  let val = Number(str);
  if (isNaN(val)) return parseErr("invalid number");
  return parseOk(val, val.toString());
}

export function parseLangFromString(str: string): ParseResult<string> {
  const hasWhitespace = /\s/.test(str);
  if (hasWhitespace) return parseErr("contains whitespace");
  return parseOk(str, str);
}

export function parseTitleFromString(str: string): ParseResult<string> {
  if (str.length == 0) return parseErr("empty string");
  const onlyWhitespace = str.trim().length == 0;
  if (onlyWhitespace) return parseErr("only contains whitespace");
  return parseOk(str, str);
}

export function parseLatexFromString(str: string): ParseResult<Latex> {
  if (str.length == 0) return parseErr("empty string");
  try {
    var html = katex.renderToString(str);
    return parseOk({ html, str });
  } catch (e) {
    if (e instanceof katex.ParseError) {
      return parseErr("Error in LaTeX" + e.message);
      // .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    } else {
      return parseErrFromErr(e);
    }
  }
}

export type Latex = {
  html: string;
  str: string;
};

export function unwrapParse<T>(
  parseFn: (str: string) => ParseResult<T>
): (str: string) => T {
  return (str) => {
    let res = parseFn(str);
    if (res.type == "err") throw new Error(`parse unwrap: ${res.message}`);
    return res.val;
  };
}
