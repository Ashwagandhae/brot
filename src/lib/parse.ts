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
  return parseErr("Unknown error");
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
  if (str.trim() === "") return parseErr("Empty string");
  let val = Number(str);
  if (isNaN(val)) return parseErr("Invalid number");
  return parseOk(val, val.toString());
}

export function parseLangFromString(str: string): ParseResult<string> {
  const hasWhitespace = /\s/.test(str);
  if (hasWhitespace) return parseErr("Contains whitespace");
  return parseOk(str, str);
}

export function parseTitleFromString(str: string): ParseResult<string> {
  if (str.length == 0) return parseErr("Empty string");
  const onlyWhitespace = str.trim().length == 0;
  if (onlyWhitespace) return parseErr("Only contains whitespace");
  return parseOk(str, str);
}
