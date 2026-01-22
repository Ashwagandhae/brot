import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import {
  NodeSelection,
  TextSelection,
  Selection,
  Plugin,
  PluginKey,
} from "@tiptap/pm/state";
import {
  parseLatexFromTypst,
  parseLatexRenderFromString,
  parseOk,
  type ParseResult,
} from "./parse";

function render(typst: string, isBlock: boolean): ParseResult<string> {
  let latexRes = parseLatexFromTypst(typst, isBlock);
  if (latexRes.type == "err") {
    return latexRes;
  }
  let res = parseLatexRenderFromString(latexRes.val, isBlock);
  if (res.type == "err") {
    return res;
  } else {
    return parseOk(res.val.html);
  }
}

const createMathExtension = (variant: "inline" | "block") => {
  const isBlock = variant === "block";
  const name = isBlock ? "mathBlock" : "inlineMath";
  const tagName = isBlock ? "div" : "span";
  const dataType = isBlock ? "math-block" : "inline-math";

  const inputRegex = isBlock
    ? /(^|[^\$])(\$\$\$([^\$]+?)\$\$\$)(?!\$)/
    : /(^|[^$])(\$\$([^$\n]+?)\$\$)(?!\$)/;

  return Node.create({
    name,
    group: isBlock ? "block" : "inline",
    inline: !isBlock,
    atom: true,
    priority: 1000,

    addAttributes() {
      return {
        latex: {
          default: "x",
          parseHTML: (element) => element.getAttribute("data-latex"),
          renderHTML: (attributes) => ({
            "data-latex": attributes.latex,
          }),
        },
        selection: {
          default: null,
          parseHTML: (element) => {
            const val = element.getAttribute("data-selection");
            return val === null ? null : parseInt(val);
          },
          renderHTML: (attributes) => {
            if (attributes.selection === null) return {};
            return { "data-selection": attributes.selection };
          },
        },
      };
    },

    parseHTML() {
      return [{ tag: `${tagName}[data-type="${dataType}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        tagName,
        mergeAttributes(HTMLAttributes, { "data-type": dataType }),
      ];
    },

    addInputRules() {
      return [
        new InputRule({
          find: inputRegex,
          handler: ({ state, range, match }) => {
            const latex = match[3];
            const start = range.from + match[1].length;
            const end = range.to;
            state.tr.replaceWith(start, end, this.type.create({ latex }));
          },
        }),
      ];
    },

    addProseMirrorPlugins() {
      const nodeName = this.name;

      return [
        new Plugin({
          key: new PluginKey(`${name}-handler`),
          props: {
            handleKeyDown(view, event) {
              const { selection, doc } = view.state;
              const { $from, $to } = selection;

              // --------------------------------------------------------
              // 1. ArrowRight & ArrowDown (Entering from Left/Above)
              // --------------------------------------------------------
              if (
                event.key === "ArrowRight" ||
                (isBlock && event.key === "ArrowDown")
              ) {
                if (selection.empty) {
                  let shouldEnter = false;

                  // Condition A: ArrowRight
                  if (event.key === "ArrowRight") {
                    // Check direct neighbor
                    const nodeAfter = doc.nodeAt($to.pos);
                    if (nodeAfter && nodeAfter.type.name === nodeName) {
                      shouldEnter = true;
                    }
                    // Check Block neighbor (jump over closing tag)
                    else if (
                      !nodeAfter &&
                      $to.parentOffset === $to.parent.content.size
                    ) {
                      const nextNode = doc.nodeAt($to.after());
                      if (nextNode && nextNode.type.name === nodeName) {
                        shouldEnter = true;
                      }
                    }
                  }

                  // Condition B: ArrowDown (Block Only)
                  // Check if we are at the bottom of the current textblock
                  if (
                    isBlock &&
                    event.key === "ArrowDown" &&
                    view.endOfTextblock("down")
                  ) {
                    const nextNode = doc.nodeAt($to.after());
                    if (nextNode && nextNode.type.name === nodeName) {
                      shouldEnter = true;
                    }
                  }

                  if (shouldEnter) {
                    event.preventDefault();
                    // Determine target position: if next node is direct, use $to.pos, else $to.after()
                    // A simple heuristic: check $to.after() first if we are at end of block
                    let targetPos = $to.pos;
                    if (
                      !doc.nodeAt($to.pos) ||
                      doc.nodeAt($to.pos)?.type.name !== nodeName
                    ) {
                      targetPos = $to.after();
                    }

                    const node = doc.nodeAt(targetPos);
                    if (node && node.type.name === nodeName) {
                      const tr = view.state.tr
                        .setSelection(NodeSelection.create(doc, targetPos))
                        .setNodeMarkup(targetPos, undefined, {
                          ...node.attrs,
                          selection: 0, // Start of input
                        });
                      view.dispatch(tr);
                      return true;
                    }
                  }
                }
              }

              // --------------------------------------------------------
              // 2. ArrowLeft & ArrowUp (Entering from Right/Below)
              // --------------------------------------------------------
              if (
                event.key === "ArrowLeft" ||
                (isBlock && event.key === "ArrowUp")
              ) {
                if (selection.empty) {
                  let shouldEnter = false;
                  let targetPos: number | null = null;

                  // Logic for Previous Node Discovery
                  const findPrevNode = () => {
                    // 1. Check direct neighbor (Inline)
                    let node = $from.nodeBefore;
                    if (node && node.type.name === nodeName) {
                      return { pos: $from.pos - node.nodeSize, node };
                    }

                    // 2. Check previous Block (Block)
                    // If at start of current block ($from.parentOffset === 0)
                    // or if ArrowUp and at top of textblock
                    const atStart = $from.parentOffset === 0;
                    const atTop =
                      event.key === "ArrowUp" && view.endOfTextblock("up");

                    if (atStart || atTop) {
                      // Look at the node immediately before the current parent block
                      const prevBlockPos = $from.before(); // Start of current parent
                      // Node ending at prevBlockPos is the one we want.
                      // We can get it via resolve(prevBlockPos).nodeBefore usually refers to parent container?
                      // Safer: resolve(prevBlockPos - 1) gives us position inside the previous element?
                      // Or simply use $from.index check.

                      const index = $from.index($from.depth - 1);
                      if (index > 0) {
                        const prevNode = $from
                          .node($from.depth - 1)
                          .child(index - 1);
                        if (prevNode && prevNode.type.name === nodeName) {
                          return {
                            pos: prevBlockPos - prevNode.nodeSize,
                            node: prevNode,
                          };
                        }
                      }
                    }
                    return null;
                  };

                  const result = findPrevNode();
                  if (result) {
                    shouldEnter = true;
                    targetPos = result.pos;
                  }

                  if (shouldEnter && targetPos !== null) {
                    event.preventDefault();
                    // Re-fetch node to be safe
                    const node = doc.nodeAt(targetPos);
                    if (node) {
                      const tr = view.state.tr
                        .setSelection(NodeSelection.create(doc, targetPos))
                        .setNodeMarkup(targetPos, undefined, {
                          ...node.attrs,
                          selection: node.attrs.latex.length, // End of input
                        });
                      view.dispatch(tr);
                      return true;
                    }
                  }
                }
              }
              return false;
            },
          },
        }),
      ];
    },

    addNodeView() {
      return ({ node, getPos, editor }) => {
        const wrapper = document.createElement(tagName);
        wrapper.className = "tiptap-mathematics-render";
        wrapper.classList.add(
          isBlock ? "math-render-block" : "math-render-inline",
        );
        wrapper.dataset.type = dataType;
        wrapper.contentEditable = "false";

        wrapper.style.position = "relative";
        wrapper.style.userSelect = "none";

        const preview = document.createElement("span");
        preview.className = "math-preview";

        if (isBlock) {
          preview.style.display = "flex";
          preview.style.justifyContent = "center";
          preview.style.width = "100%";
          preview.style.cursor = "pointer";
        }

        wrapper.onclick = () => {
          if (typeof getPos === "function") {
            const pos = getPos();
            if (pos !== undefined) {
              const tr = editor.state.tr
                .setSelection(NodeSelection.create(editor.state.doc, pos))
                .setNodeMarkup(pos, undefined, { ...node.attrs, selection: 0 });
              editor.view.dispatch(tr);
            }
          }
        };

        const input = document.createElement("input");
        input.className = "math-input";
        input.value = node.attrs.latex;
        input.style.display = "none";
        input.style.zIndex = "1000";

        wrapper.appendChild(preview);
        wrapper.appendChild(input);

        const repositionInput = () => {
          if (input.style.display === "none") return;

          const len = input.value.length;
          input.style.width = `${Math.max(1, len) + 2}ch`;

          input.style.left = "50%";
          input.style.transform = "translateX(-50%)";

          const rect = input.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const padding = 10;

          let shiftX = 0;

          if (rect.left < padding) {
            shiftX = padding - rect.left;
          } else if (rect.right > viewportWidth - padding) {
            shiftX = viewportWidth - padding - rect.right;
          }

          if (shiftX !== 0) {
            input.style.transform = `translateX(calc(-50% + ${shiftX}px))`;
          }
        };

        function renderMath() {
          if (!node.attrs.latex) return;
          const res = render(node.attrs.latex, isBlock);

          if (res.type === "err") {
            preview.textContent = node.attrs.latex;
            preview.title = res.message || "Error parsing math";
            wrapper.classList.add("math-error");
            wrapper.classList.remove("math-rendered");
          } else {
            preview.innerHTML = res.val;
            preview.title = "";
            wrapper.classList.remove("math-error");
            wrapper.classList.add("math-rendered");
          }
        }

        input.addEventListener("mousedown", (e) => e.stopPropagation());
        input.addEventListener("click", (e) => e.stopPropagation());

        input.addEventListener("blur", () => {
          if (typeof getPos === "function") {
            const pos = getPos();
            if (pos !== undefined) {
              const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                selection: null,
              });
              tr.setMeta("addToHistory", false);
              editor.view.dispatch(tr);
            }
          }
        });

        input.addEventListener("keydown", (e) => {
          const isRight = e.key === "ArrowRight";
          const isLeft = e.key === "ArrowLeft";
          const isEnter = e.key === "Enter";
          const isUp = isBlock && e.key === "ArrowUp";
          const isDown = isBlock && e.key === "ArrowDown";

          if (typeof getPos !== "function") return;
          const pos = getPos();
          if (pos === undefined) return;

          setTimeout(repositionInput, 0);

          // ESCAPE LEFT / UP
          // ArrowLeft: at start of input
          // ArrowUp: (Block only) anytime
          if ((isLeft && input.selectionStart === 0) || isUp) {
            e.preventDefault();
            const resolvePos = editor.state.doc.resolve(pos);
            const prevSelection = Selection.near(resolvePos, -1);
            const tr = editor.state.tr
              .setSelection(prevSelection)
              .setNodeMarkup(pos, undefined, {
                ...node.attrs,
                selection: null,
              });
            editor.view.dispatch(tr);
            editor.view.focus();
            return;
          }

          // ESCAPE RIGHT / DOWN
          // ArrowRight: at end of input
          // Enter: anytime
          // ArrowDown: (Block only) anytime
          const selEnd = input.selectionEnd ?? 0;
          if ((isRight && selEnd === input.value.length) || isEnter || isDown) {
            e.preventDefault();
            const resolvePos = editor.state.doc.resolve(pos + node.nodeSize);
            const nextSelection = Selection.near(resolvePos, 1);
            const tr = editor.state.tr
              .setSelection(nextSelection)
              .setNodeMarkup(pos, undefined, {
                ...node.attrs,
                selection: null,
              });
            editor.view.dispatch(tr);
            editor.view.focus();
            return;
          }
        });

        input.addEventListener("input", (e) => {
          repositionInput();
          if (typeof getPos === "function") {
            const pos = getPos();
            if (pos !== undefined) {
              const target = e.target as HTMLInputElement;
              const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
                latex: target.value,
                selection: target.selectionStart,
              });
              editor.view.dispatch(tr);
            }
          }
        });

        const syncSelection = () => {
          if (typeof getPos !== "function") return;
          const pos = getPos();
          if (pos === undefined) return;

          if (
            node.attrs.selection !== null &&
            node.attrs.selection !== input.selectionStart
          ) {
            const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              selection: input.selectionStart,
            });
            tr.setMeta("addToHistory", false);
            editor.view.dispatch(tr);
          }
        };

        input.addEventListener("keyup", syncSelection);
        input.addEventListener("mouseup", syncSelection);

        renderMath();

        return {
          dom: wrapper,

          update: (updatedNode) => {
            if (updatedNode.type.name !== name) return false;
            node = updatedNode;

            if (input.value !== node.attrs.latex) {
              input.value = node.attrs.latex;
            }

            const selectionAttr = node.attrs.selection;

            if (selectionAttr === null) {
              input.style.display = "none";
              if (document.activeElement === input) {
                input.blur();
              }
            } else {
              input.style.display = "block";

              requestAnimationFrame(() => {
                repositionInput();
                if (document.activeElement !== input) {
                  input.focus();
                }
              });

              try {
                if (input.selectionStart !== selectionAttr) {
                  if (document.activeElement !== input) {
                    input.setSelectionRange(selectionAttr, selectionAttr);
                  }
                }
              } catch (err) {}
            }

            renderMath();
            return true;
          },

          selectNode: () => {},

          stopEvent: (event) => event.target === input,
          ignoreMutation: (mutation) =>
            mutation.target === input || wrapper.contains(mutation.target),
        };
      };
    },

    parseMarkdown: (token: any) => {
      return {
        type: name,
        attrs: {
          latex: token.latex,
        },
      };
    },

    renderMarkdown: (node) => {
      const delimiter = isBlock ? "$$" : "$";
      return `${delimiter}${node.attrs?.latex}${delimiter}`;
    },

    markdownTokenizer: {
      name,
      level: isBlock ? "block" : "inline",
      start: (src: string) => src.indexOf(isBlock ? "$$" : "$"),
      tokenize: (src: string) => {
        const regex = isBlock ? /^\$\$([^$]+)\$\$/ : /^\$([^$]+)\$(?!\$)/;

        const match = src.match(regex);
        if (!match) return undefined;
        return {
          type: name,
          raw: match[0],
          latex: match[1].trim(),
        };
      },
    },
  });
};

export const MathInline = createMathExtension("inline");
export const MathBlock = createMathExtension("block");
