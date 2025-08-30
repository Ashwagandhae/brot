import { getContext, setContext, type Component, type Snippet } from "svelte";
import type { Locater } from "../../src-tauri/bindings/Locater";
import type { Editor } from "@tiptap/core";
import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
import type { PartialActionFilter } from "../../src-tauri/bindings/PartialActionFilter";
import { parseUrlFromString } from "./parse";

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
  toggleFloating: [],
  focusScrollPinnedNote: ["number"],
  focusScrollNote: [],
  focusNote: [],
  focusNoteEnd: [],
  copyUrl: [],
  pasteWithoutFormatting: [],
  historyBack: [],
  historyForward: [],
  repeatLastAction: [],
  copySelectionMd: [],

  // editor
  unsetAllMarks: [],
  clearNodes: [],
  clearFormatting: [],
  // hard break
  setHardBreak: [],
  // list
  toggleBulletList: [],
  toggleOrderedList: [],
  splitListItem: [],
  sinkListItem: [],
  liftListItem: [],
  // link
  setLink: ["url"],
  editLink: [],
  unsetLink: [],
  // table
  insertTable: [],
  addColumnBefore: [],
  addColumnAfter: [],
  deleteColumn: [],
  addRowBefore: [],
  addRowAfter: [],
  deleteRow: [],
  deleteTable: [],
  mergeCells: [],
  splitCell: [],
  toggleHeaderColumn: [],
  toggleHeaderRow: [],
  toggleHeaderCell: [],
  mergeOrSplit: [],
  // blockquote
  toggleBlockquote: [],
  setBlockquote: [],
  unsetBlockquote: [],
  // heading
  setHeading: ["level"],
  toggleHeading: ["level"],
  // horizontal rule
  setHorizontalRule: [],
  // paragraph
  setParagraph: [],
  // bold
  setBold: [],
  unsetBold: [],
  toggleBold: [],
  // code
  setCode: [],
  unsetCode: [],
  toggleCode: [],
  // italic
  setItalic: [],
  unsetItalic: [],
  toggleItalic: [],
  // strike
  setStrike: [],
  unsetStrike: [],
  toggleStrike: [],
  // underline
  setUnderline: [],
  unsetUnderline: [],
  toggleUnderline: [],
  // undo redo
  undo: [],
  redo: [],
  // details
  setDetails: [],
  unsetDetails: [],
  // code block
  setCodeBlock: [],
  toggleCodeBlock: [],
  editCodeBlockLang: [],
} as const;

export type ActionRegistry = BuildActions & {
  getNoteTitle?: () => string | null;
  getEditor?: () => Editor;
};

// contains the key mapped to a generator of lists of different sets of arguments to construct the PartialActionFilters
export type DisabledRegistry = Partial<
  Record<keyof typeof actions, () => ArgsFilter>
>;

export class ArgsFilter {
  private argSetFilters: string[][];
  constructor(argSetFilters: string[][]) {
    this.argSetFilters = argSetFilters;
  }

  static alwaysMatch = new ArgsFilter([[]]);
  static neverMatch = new ArgsFilter([]);

  static fromBool(enabled: boolean): ArgsFilter {
    if (enabled) {
      return this.neverMatch;
    }
    return this.alwaysMatch;
  }

  toFilters(key: string): PartialActionFilter[] {
    return this.argSetFilters.map((argSetFilter) => ({
      key,
      args: argSetFilter,
    }));
  }
}

export class ActionRegistryManager {
  private registry: ActionRegistry;
  private disabled: DisabledRegistry;
  private override: ActionRegistryManager | null;
  constructor() {
    this.registry = {};
    this.disabled = {};
    this.override = null;
  }
  add(registry: ActionRegistry, disabled?: DisabledRegistry) {
    this.registry = { ...this.registry, ...registry };
    if (disabled != null) {
      this.disabled = { ...this.disabled, ...disabled };
    }
  }
  get<K extends keyof ActionRegistry>(key: K): ActionRegistry[K] {
    return this.override?.get(key) ?? this.registry[key];
  }
  getArgsFilter<K extends keyof DisabledRegistry>(
    key: K
  ): (() => ArgsFilter) | undefined {
    return this.override?.getArgsFilter(key) ?? this.disabled[key];
  }
  setOverride(registry: ActionRegistryManager) {
    this.override = registry;
  }
}

export type ArgTypesMap = {
  locater: Locater;
  notePath: string;
  insertion: "above" | "below";
  boolean: boolean;
  palette: string;
  number: number;
  url: URL;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  lang: string;
};
export type ArgType = keyof ArgTypesMap;

export type BuildRegistry<
  T extends Record<string, readonly string[]>,
  U
> = Partial<
  Mutable<{
    [K in keyof T]: T[K] extends readonly []
      ? () => U
      : (...args: BuildArgs<T[K]>) => U;
  }>
>;

export type BuildRegistryPartialArgs<
  T extends Record<string, readonly string[]>,
  U
> = Partial<
  Mutable<{
    [K in keyof T]: T[K] extends readonly []
      ? () => U
      : (...args: Partial<BuildArgs<T[K]>>) => U;
  }>
>;

type BuildActions = BuildRegistry<typeof actions, void>;

type BuildArgs<T extends readonly string[]> = {
  [K in keyof T]: T[K] extends keyof ArgTypesMap ? ArgTypesMap[T[K]] : never;
};

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export async function continuePartialAction<T extends ActionsKey>(
  registry: ActionRegistryManager,
  action: ParsedPartialAction<T>,
  requestNextArg: (argType: ArgType) => void
) {
  let key = action.key as keyof typeof actions;
  if (actions[key].length <= action.parsedArgs.length) {
    let fn = registry.get(key);
    if (fn != null) {
      console.log("doing action", key, [...action.parsedArgs]);
      (fn as any)(...action.parsedArgs);
    } else {
      console.log("didn't do action");
    }
  } else {
    let nextArgIndex = action.parsedArgs.length;
    let argType = actions[key][nextArgIndex as number];
    requestNextArg(argType);
  }
}

export function parsePartialAction(action: PartialAction): ParsedPartialAction {
  let key = action.key as ActionsKey;
  return {
    key,
    parsedArgs: action.args.map((val, index) =>
      parseArgType(actions[key][index], val)
    ),
  } as any;
}

function verifyEnum<T extends string>(val: string, options: T[]): T;
function verifyEnum<T extends number>(val: number, options: T[]): T;
function verifyEnum<T extends string | number>(val: T, options: T[]): T {
  if (options.includes(val)) {
    return val;
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
  url: (val) => new URL(val),
  level: (val) => verifyEnum(Number(val), [1, 2, 3, 4, 5, 6]),
  lang: (val) => val,
};

export function parseArgType<T extends keyof ArgTypesMap>(
  type: T,
  val: string
): ArgTypesMap[T] {
  console.log("parsing arg of type: ", type);
  return parsers[type](val);
}
export function setActionRegistryContext(registry: ActionRegistryManager) {
  setContext("actionRegistry", registry);
}
export function getActionRegistryContext(): ActionRegistryManager {
  return getContext("actionRegistry");
}

export type ActionsKey = keyof typeof actions;

export type MapArgs<T extends (keyof ArgTypesMap)[]> = {
  [K in keyof T]: T[K] extends keyof ArgTypesMap ? ArgTypesMap[T[K]] : never;
};

// type TypedPartialAction<T extends keyof typeof actions> = {
//   key: T;
//   args: MapArgsToTypes<(typeof actions)[T]>;
// };

type WritableTuple<T extends readonly any[]> = {
  -readonly [P in keyof T]: T[P];
};

export type ParsedPartialAction<K extends ActionsKey = ActionsKey> = {
  [P in K]: {
    key: P;
    parsedArgs: PartialTuple<MapArgs<WritableTuple<(typeof actions)[P]>>>;
  };
}[K];

type PartialTuple<T extends any[]> = T extends [infer First, ...infer Rest]
  ? [] | [First] | [First, ...PartialTuple<Rest>]
  : [];

let y: ActionsKey;
let x: ParsedPartialAction<ActionsKey> = {
  key: "goto",
  parsedArgs: [true, "note:sk"],
};
