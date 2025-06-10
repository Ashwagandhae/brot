import type { PaletteAction } from "../../src-tauri/bindings/PaletteAction";
import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
import type { ArgType } from "./actions";

export type CommandProvider = (search: string) => Promise<PaletteAction[]>;

export type CommandPaletteState = {
  provider: CommandProvider;
} | null;

export type CommandPaletteType =
  | {
      type: "palette";
      key: string;
    }
  | {
      type: "arg";
      argType: ArgType;
      action: PartialAction;
    };
