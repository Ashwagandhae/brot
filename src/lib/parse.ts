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
    return parseOk(new URL(str));
  } catch {
    try {
      return parseOk(new URL("http://" + str));
    } catch (err) {
      return parseErrFromErr(err);
    }
  }
}
