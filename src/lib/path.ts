import { getContext, setContext } from "svelte";

export function pathToTitle(path: string) {
  const noUnderscores = path.replace(/_/g, " ");
  return noUnderscores.endsWith(".md")
    ? noUnderscores.slice(0, -3)
    : noUnderscores;
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
