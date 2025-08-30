import { getContext, setContext } from "svelte";

function stripMd(path: string) {
  return path.endsWith(".md") ? path.slice(0, -3) : path;
}
export function pathToTitleString(path: string) {
  const noUnderscores = stripMd(path).replace(/_/g, " ");
  return noUnderscores;
}

export type Range = { from: number; to: number };

type Node = { range: Range; startPadding: number };
export type TitleNode =
  | (Node & {
      type: "text";
      content: string;
    })
  | (Node & {
      type: "tag";
      parts: TagPartNode[];
    });

export type TagPartNode = Node & { content: string };

// Seperates any instances of sep from the rest of the string
// e.g. "hello_world__hello", "_" -> "hello" "_" "world" "_" "_" "hello"
function seperateChar(
  str: string,
  sep: string
): ({ sep: false; content: string } | { sep: true })[] {
  let seperated: ({ sep: false; content: string } | { sep: true })[] = str
    .split(sep)
    .flatMap((p, i, arr) =>
      i < arr.length - 1
        ? [{ sep: false, content: p }, { sep: true }]
        : { sep: false, content: p }
    );

  return seperated.filter((part) => part.sep || part.content.length > 0);
}

function partToTagParts(part: string): TagPartNode[] {
  let seperated = seperateChar(part, "--");
  let res: TagPartNode[] = [];
  let currentChar: number = 0;
  let currentSepCount: number = 0;
  for (let part of seperated) {
    if (part.sep) {
      currentSepCount += 1;
      currentChar += 2;
    } else {
      let startPadding = currentSepCount * 2;
      let range = { from: currentChar, to: currentChar + part.content.length };
      res.push({
        content: part.content,
        startPadding,
        range,
      });
      currentSepCount = 0;
      currentChar = range.to;
    }
  }
  return res;
}

export function pathToTitleNodes(path: string): TitleNode[] {
  path = stripMd(path);
  let underscoreSeperated = seperateChar(path, "_");

  let currentSepCount: number = 0;
  let res: TitleNode[] = [];
  let currentChar: number = 0;
  for (let part of underscoreSeperated) {
    if (part.sep) {
      currentSepCount += 1;
      currentChar += 1;
    } else {
      let startPadding = currentSepCount;
      let range = { from: currentChar, to: currentChar + part.content.length };
      if (part.content.startsWith("-")) {
        res.push({
          type: "tag",
          parts: partToTagParts(part.content.slice(1)),
          startPadding,
          range,
        });
      } else {
        res.push({ type: "text", content: part.content, startPadding, range });
      }
      currentSepCount = 0;
      currentChar = range.to;
    }
  }
  return res;
}

type PathContext = {
  setPath: (from: string, to: string) => void;
};

export function getPathContext(): PathContext {
  return getContext("path");
}

export function setPathContext(pathContext: PathContext) {
  setContext("path", pathContext);
}

export function pathToUrl(path: string) {
  return `http://localhost:4242/note?p=${path}`;
}
