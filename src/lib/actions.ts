import { getContext, setContext } from "svelte";
import type { Locater } from "../../src-tauri/bindings/Locater";
import type { Editor } from "@tiptap/core";
import type { Writable } from "svelte/store";

export const actions = {
  openPalette: ["palette"],
  editNoteTitle: [],
  goto: ["boolean", "locater"],
  addPinned: ["insertion", "notePath"],
  removeCurrentPinned: [],
  toggleNoteMinimized: [],
  saveNote: [],
  saveWindowState: [],
  refresh: [],
  refreshPage: [],
  editorToggleBold: [],
  toggleFloating: [],
  focusPinnedNote: ["number"],
  focusNote: [],
  copyUrl: [],
  pasteWithoutFormatting: [],
} as const;

export type ActionRegistry = Partial<Mutable<BuildActions<typeof actions>>> & {
  getNoteTitle?: () => string | null;
  getEditor?: () => Editor;
};

type ArgTypesMap = {
  locater: Locater;
  notePath: string;
  insertion: "above" | "below";
  boolean: boolean;
  palette: string;
  number: number;
};
export type ArgType = keyof ArgTypesMap;

type BuildActions<T extends Record<string, readonly string[]>> = {
  [K in keyof T]: T[K] extends readonly []
    ? () => void
    : (...args: BuildArgs<T[K]>) => void;
};

type BuildArgs<T extends readonly string[]> = {
  [K in keyof T]: T[K] extends keyof ArgTypesMap ? ArgTypesMap[T[K]] : never;
};

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

type PartialAction = {
  key: string;
  args: string[];
};

export function continuePartialAction(
  registry: ActionRegistry,
  action: PartialAction,
  requestNextArg: (argType: ArgType) => void
) {
  let key = action.key as keyof typeof actions;
  if (actions[key].length <= action.args.length) {
    let fn = registry[key];
    if (fn != null) {
      (fn as any)(
        ...action.args.map((val, index) =>
          parseArgType(actions[key][index], val)
        )
      );
    } else {
      console.log("didn't do action");
    }
  } else {
    let nextArgIndex = action.args.length;
    let argType = actions[key][nextArgIndex as number];
    requestNextArg(argType);
  }
}

function verifyEnum<T extends string>(val: string, options: T[]): T {
  if ((options as string[]).includes(val)) {
    return val as T;
  }
  throw new Error(`Failed to verify value ${val}`);
}

const parsers: {
  [K in keyof ArgTypesMap]: (val: string) => ArgTypesMap[K];
} = {
  notePath: (val) => val,
  insertion: (val) => verifyEnum(val, ["above", "below"]),
  boolean: (val) => val === "true",
  palette: (val) => val,
  locater: (val) => val as Locater,
  number: (val) => Number(val),
};

export function parseArgType<T extends keyof ArgTypesMap>(
  type: T,
  val: string
): ArgTypesMap[T] {
  return parsers[type](val);
}
export function setActionRegistryContext(registry: Writable<ActionRegistry>) {
  setContext("actionRegistry", registry);
}
export function getActionRegistryContext(): Writable<ActionRegistry> {
  return getContext("actionRegistry");
}
