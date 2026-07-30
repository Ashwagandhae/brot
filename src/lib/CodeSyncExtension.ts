import {
  Node,
  Extension,
  mergeAttributes,
  type CommandProps,
} from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { CodeResult } from "../../src-tauri/bindings/CodeResult";

/**
 * Result Types
 */

type RunCodeFn = (
  code: string,
  language: string | null,
) => CodeResult | Promise<CodeResult>;

interface CodeSyncOptions {
  runCode: RunCodeFn;
  debounceMs: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    runCodeBlock: {
      runCodeBlock: () => ReturnType;
    };
  }
}

function debounce(fn: Function, ms: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

export const CodeOutput = Node.create({
  name: "codeOutput",
  group: "block",
  selectable: false,
  atom: true,

  addAttributes() {
    return {};
  },

  parseHTML() {
    return [{ tag: 'pre[data-type="code-output"]' }];
  },

  renderHTML() {
    return ["pre", { "data-type": "code-output", class: "code-output-node" }];
  },

  renderMarkdown() {
    return `<pre data-type="code-output"></pre>`;
  },

  addNodeView() {
    return ({ editor, getPos }) => {
      const dom = document.createElement("pre");
      dom.className = "code-output-node";
      dom.setAttribute("data-type", "code-output");

      let currentRequestId = 0;

      const syncContent = async () => {
        const pos = getPos();
        if (typeof pos !== "number") return;

        const $pos = editor.state.doc.resolve(pos);
        const prevNode = $pos.nodeBefore;

        if (prevNode?.type.name === "codeBlock") {
          const requestId = ++currentRequestId;

          const syncExt = editor.extensionManager.extensions.find(
            (e) => e.name === "codeSyncPlugin",
          );
          const options = syncExt?.options as CodeSyncOptions;
          const runCode = options?.runCode;

          if (!runCode) return;

          try {
            // Initial loading state
            dom.classList.add("is-loading");

            const result = await runCode(
              prevNode.textContent,
              prevNode.attrs.language,
            );

            // Guard against race conditions
            if (requestId !== currentRequestId) return;

            dom.classList.remove("is-loading", "is-ok", "is-error");

            if (result.type === "ok") {
              dom.classList.add("is-ok");
              dom.innerText = result.text;
            } else {
              dom.classList.add("is-error");
              dom.textContent = result.message;
            }
          } catch (err) {
            if (requestId === currentRequestId) {
              dom.classList.remove("is-loading", "is-ok");
              dom.classList.add("is-error");
              dom.textContent = `Runtime Error: ${err instanceof Error ? err.message : String(err)}`;
            }
          }
        }
      };

      const syncExt = editor.extensionManager.extensions.find(
        (e) => e.name === "codeSyncPlugin",
      );
      const wait = (syncExt?.options as any)?.debounceMs ?? 300;

      const debouncedSync = debounce(syncContent, wait);

      editor.on("transaction", debouncedSync);
      syncContent();

      return {
        dom,
        update: () => true,
        destroy: () => {
          editor.off("transaction", debouncedSync);
        },
      };
    };
  },
});

/**
 * 2. EnhancedCodeBlock
 */
export const EnhancedCodeBlock = CodeBlockLowlight.extend({
  addCommands() {
    return {
      ...this.parent?.(),
      runCodeBlock:
        () =>
        ({ state, chain }: CommandProps) => {
          const { selection, doc } = state;
          const $pos = selection.$from;

          let depth = $pos.depth;
          while (depth > 0 && $pos.node(depth).type.name !== this.name) {
            depth--;
          }

          if ($pos.node(depth).type.name !== this.name) return false;

          const posAfter = $pos.after(depth);
          const nodeAfter = doc.nodeAt(posAfter);

          if (nodeAfter?.type.name === "codeOutput") return true;

          return chain()
            .focus()
            .insertContentAt(posAfter, { type: "codeOutput" })
            .run();
        },
    };
  },
});

/**
 * 3. CodeSyncPlugin
 */
export const CodeSyncPlugin = Extension.create<CodeSyncOptions>({
  name: "codeSyncPlugin",

  addOptions() {
    return {
      runCode: async (code): Promise<CodeResult> => {
        await new Promise((res) => setTimeout(res, 400));
        if (code.includes("error")) {
          return { type: "error", message: "Manual error triggered" };
        }
        return { type: "ok", text: `Success: ${code.length} chars` };
      },
      debounceMs: 300,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("codeSyncLogic"),
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return;

          const tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name === "codeOutput") {
              const $pos = newState.doc.resolve(pos);
              const prevNode = $pos.nodeBefore;

              if (!prevNode || prevNode.type.name !== "codeBlock") {
                const mappedPos = tr.mapping.map(pos);
                tr.delete(mappedPos, mappedPos + node.nodeSize);
                modified = true;
              }
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
