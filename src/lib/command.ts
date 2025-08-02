import type { MatchedPaletteAction } from "../../src-tauri/bindings/MatchedPaletteAction";
import type { PaletteAction } from "../../src-tauri/bindings/PaletteAction";
import type { PaletteId } from "../../src-tauri/bindings/PaletteId";
import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
import type { PartialActionFilter } from "../../src-tauri/bindings/PartialActionFilter";
import type { ArgType } from "./actions";
import { msg } from "./message";

export interface CommandProvider {
  search: (search: string) => Promise<MatchedPaletteAction[]>;
  stop?: () => void;
}

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

function getParamActions(
  search: string,
  argType: ArgType,
  action: PartialAction
): PaletteAction[] {
  switch (argType) {
    case "boolean":
      return enumPaletteActions(["true", "false"], search, action);
    case "insertion":
      return enumPaletteActions(["above", "below"], search, action);
  }
  return [];
}

function enumPaletteActions(
  choices: string[],
  search: string,
  action: PartialAction
): PaletteAction[] {
  return choices
    .filter((choice) => choice.includes(search))
    .map((choice) => {
      return {
        title: choice,
        icon: null,
        action: addParam(action, choice),
      };
    });
}

function addParam(action: PartialAction, arg: string): PartialAction {
  return {
    key: action.key,
    args: [...action.args, arg],
  };
}

class PaletteCommandProvider implements CommandProvider {
  id: PaletteId | null;
  key: string;
  filters: PartialActionFilter[];
  constructor(key: string, filters: PartialActionFilter[]) {
    this.id = null;
    this.key = key;
    this.filters = filters;
  }
  async search(search: string): Promise<MatchedPaletteAction[]> {
    if (this.id == null) {
      this.id = await msg("createPalette", {
        paletteKey: this.key,
        filters: this.filters,
      });
    }
    return await msg("searchPalette", {
      search,
      id: this.id,
      start: 0,
      end: 10,
    });
  }
}

export function stateFromType(type: CommandPaletteType): CommandProvider {
  if (type.type == "arg") {
    return {
      search: async (search) =>
        getParamActions(search, type.argType, type.action).map(
          (paletteAction) => {
            return { paletteAction, indices: [] };
          }
        ),
    };
  } else {
    return new PaletteCommandProvider(type.key, []);
  }
}
