import type { ChainedCommands, Editor } from "@tiptap/core";
import {
  ArgsFilter,
  type ActionRegistry,
  type ActionRegistryManager,
  type actions,
  type BuildRegistryPartialArgs,
  type DisabledRegistry,
} from "./actions";

export type EditorActionRegistry = BuildRegistryPartialArgs<
  typeof actions,
  (commands: ChainedCommands) => boolean
>;

export function addEditorActions(
  manager: ActionRegistryManager,
  editor: Editor,
  actions: EditorActionRegistry
) {
  let actionRegistry: ActionRegistry = typedFromEntries(
    Object.keys(actions).map((key) => {
      let typedKey = key as keyof EditorActionRegistry;
      let getEditorConsumer = actions[typedKey]!;
      return [
        typedKey,
        composeVarArg(getEditorConsumer, (editorConsumer) =>
          editorConsumer(editor.chain())
        ),
      ];
    })
  );
  let disabledRegistry: DisabledRegistry = typedFromEntries(
    Object.keys(actions).map((key) => {
      let typedKey = key as keyof EditorActionRegistry;
      let getEditorConsumer = actions[typedKey]!;
      return [
        typedKey,
        () => {
          let canRun = getEditorConsumer()(editor.can().chain());
          if (canRun) {
            return ArgsFilter.neverMatch; // turn disabled off if can run
          } else {
            return ArgsFilter.alwaysMatch;
          }
        },
      ];
    })
  );
  manager.add(actionRegistry, disabledRegistry);
}

function composeVarArg<T extends any[], U, V>(
  func: (...args: T) => U,
  func2: (x: U) => V
): (...args: T) => V {
  return (...args: T) => {
    return func2(func(...args));
  };
}

function typedFromEntries<K extends string | number | symbol, V>(
  entries: [K, V][]
): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>;
}
