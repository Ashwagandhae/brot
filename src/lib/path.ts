import { getContext, setContext } from "svelte";
import type { TagConfigs } from "./tagConfig";

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
  let seperated = seperateChar(part.slice(1), "--");
  let res: TagPartNode[] = [];
  let currentChar: number = 0;
  let currentSepCount: number = 0;
  for (let i = 0; i < seperated.length; i++) {
    let part = seperated[i];
    if (part.sep) {
      currentSepCount += 1;
    } else {
      let startPadding = currentSepCount * 2;
      if (i == 0) {
        startPadding += 1;
      }
      let range = {
        from: currentChar,
        to: currentChar + startPadding + part.content.length,
      };
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
    } else {
      let startPadding = currentSepCount;
      let range = {
        from: currentChar,
        to: currentChar + startPadding + part.content.length,
      };
      if (part.content.startsWith("-")) {
        res.push({
          type: "tag",
          parts: partToTagParts(part.content),
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

export function getPathHues(path: string, tagConfigs: TagConfigs): number[] {
  let nodes = pathToTitleNodes(path);
  let parts: null | TagPartNode[] = null;
  for (let node of nodes) {
    if (node.type == "tag") {
      parts = node.parts;
      break;
    }
  }
  if (parts == null) return [];
  let partKeys = getPartConfigKeys(parts);
  return partKeys.map((key) => tagConfigs[key]?.hue).filter((x) => x != null);
}

export function setCssVarsFromHues(hues: number[], body: Document["body"]) {
  if (hues.length == 0) {
    body.style.setProperty("--back-chroma", "0");
    body.style.setProperty("--text-chroma", "0");
    body.style.setProperty("--back-gradient", "oklch(var(--level-1) 0 0)");
    return;
  }

  let backHue = hues[0];
  let frontHue = hues[hues.length - 1];

  body.style.setProperty("--back-chroma", "var(--back-color-chroma)");
  body.style.setProperty("--text-chroma", "var(--text-color-chroma)");
  body.style.setProperty("--back-hue-back", backHue.toString());
  body.style.setProperty("--back-hue-front", frontHue.toString());

  let gradientColors = hues
    .toReversed()
    .map((hue) => `oklch(var(--level-1) var(--back-chroma) ${hue})`);
  let backGradient = `radial-gradient(at 0% 0%, ${gradientColors.join(", ")})`;
  body.style.setProperty("--back-gradient", backGradient);
}

export function getPartConfigKeys(parts: TagPartNode[]) {
  let curr = "";
  let res = [];
  for (let part of parts) {
    curr += part.content;
    res.push(curr);
    curr += "--";
  }
  return res;
}
