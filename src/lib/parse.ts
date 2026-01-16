import * as katex from "katex";
import { tex2typst, typst2tex } from "tex2typst";

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

export function parseLatexRenderFromString(
  str: string,
  block = false
): ParseResult<LatexRender> {
  if (str.length == 0) return parseErr("empty string");
  try {
    let html = katex.renderToString(str, { strict: false, displayMode: block });
    return parseOk({ html, str });
  } catch (e) {
    return parseErrFromErr(e);
  }
}

export function parseLatexFromTypst(
  latex: string,
  block = false
): ParseResult<string> {
  try {
    let typst = typst2tex(latex, { blockMathMode: block });
    return parseOk(typst);
  } catch (e) {
    return parseErrFromErr(e);
  }
}

export function parseTypstFromLatex(typst: string): ParseResult<string> {
  try {
    let latex = tex2typst(typst);
    return parseOk(latex);
  } catch (e) {
    return parseErrFromErr(e);
  }
}

export type LatexRender = {
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
