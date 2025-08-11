import type { MatchedPaletteAction } from "../../src-tauri/bindings/MatchedPaletteAction";
import type { PaletteAction } from "../../src-tauri/bindings/PaletteAction";
import type { PaletteId } from "../../src-tauri/bindings/PaletteId";
import type { PartialAction } from "../../src-tauri/bindings/PartialAction";
import type { PartialActionFilter } from "../../src-tauri/bindings/PartialActionFilter";
import { actions, type ActionRegistryManager, type ArgType } from "./actions";
import { msg } from "./message";

export interface CommandProvider {
  search: (
    search: string,
    start: number,
    end: number
  ) => Promise<MatchedPaletteAction[]>;
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
    case "url":
      return verifyActions(
        (str) => {
          try {
            new URL(str);
            return true;
          } catch {
            try {
              new URL("http://" + str);
              return true;
            } catch {
              return false;
            }
          }
        },
        search,
        action
      );
    case "number":
      return verifyActions(
        (str) => {
          return str.trim() !== "" && !isNaN(Number(str));
        },
        search,
        action
      );
    case "locater":
      return [];
    case "notePath":
      return [];
    case "palette":
      return [];
  }
}

function verifyActions(
  verify: (search: string) => boolean,
  search: string,
  action: PartialAction
): PaletteAction[] {
  if (verify(search)) {
    return [
      {
        title: "ok",
        icon: "check",
        action: addParam(action, search),
        shortcut: null,
      },
    ];
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
        shortcut: null,
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
  private async initId() {
    return await msg("createPalette", {
      paletteKey: this.key,
      filters: this.filters,
    });
  }
  private async searchPalette(
    search: string,
    id: PaletteId,
    start: number,
    end: number
  ) {
    return await msg("searchPalette", {
      search,
      id,
      start,
      end,
    });
  }
  async search(
    search: string,
    start: number,
    end: number
  ): Promise<MatchedPaletteAction[]> {
    if (this.id == null) {
      this.id = await this.initId();
    }
    let res = await this.searchPalette(search, this.id, start, end);
    // if null, then id is invalid, so try reiniting
    if (res == null) {
      this.id = await this.initId();
      res = await this.searchPalette(search, this.id, start, end);
    }
    // if still null then we are cooked
    if (res == null) {
      return [];
    }
    return res;
  }

  async stop(): Promise<void> {
    if (this.id == null) return;
    await msg("deletePalette", { id: this.id });
  }
}

export function stateFromType(
  type: CommandPaletteType,
  registry: ActionRegistryManager
): CommandProvider {
  if (type.type == "arg") {
    return {
      search: async (search, start, end) =>
        getParamActions(search, type.argType, type.action)
          .map((paletteAction) => {
            return { paletteAction, indices: [] };
          })
          .slice(start, end),
    };
  } else {
    return new PaletteCommandProvider(type.key, getFilters(registry));
  }
}

function getFilters(registry: ActionRegistryManager): PartialActionFilter[] {
  return Object.entries(actions).flatMap(([key, _]) => {
    let typedKey = key as keyof typeof actions;
    let argsFilter = registry.getArgsFilter(typedKey);
    if (argsFilter == null) return [];
    return argsFilter().toFilters(key);
  });
}
