import { getContext, setContext } from "svelte";
import type { Locater } from "../../src-tauri/bindings/Locater";
import type { Editor } from "@tiptap/core";
import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
import type { PartialActionFilter } from "../../src-tauri/bindings/PartialActionFilter";

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
  historyBack: [],
  historyForward: [],
  repeatLastAction: [],

  // editor
  unsetAllMarks: [],
  // link
  setLink: ["url"],
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

type ArgTypesMap = {
  locater: Locater;
  notePath: string;
  insertion: "above" | "below";
  boolean: boolean;
  palette: string;
  number: number;
  url: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
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

export async function continuePartialAction(
  registry: ActionRegistryManager,
  action: PartialAction,
  requestNextArg: (argType: ArgType) => void
) {
  let key = action.key as keyof typeof actions;
  if (actions[key].length <= action.args.length) {
    let fn = registry.get(key);
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
  url: (val) => val,
  level: (val) => verifyEnum(Number(val), [1, 2, 3, 4, 5, 6]),
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
