import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { parseLatexFromTypst, parseLatexRenderFromString } from "./parse";
import * as katex from "katex";

function errorSpan(message: string) {
  let err = document.createElement("span");
  err.classList.add("error");
  err.textContent = message;
  return err.outerHTML;
}

function render(typst: string, isBlock: boolean): string {
  let latexRes = parseLatexFromTypst(typst, isBlock);
  if (latexRes.type == "err") {
    return errorSpan(latexRes.message);
  }
  let res = parseLatexRenderFromString(latexRes.val, isBlock);
  if (res.type == "err") {
    return errorSpan(res.message);
  } else {
    return res.val.html;
  }
}

const createMathExtension = (type: "inline" | "block") => {
  const isBlock = type === "block";
  const name = isBlock ? "math_display" : "math_inline";
  const tagName = isBlock ? "div" : "span";
  const className = isBlock ? "math-display" : "math-inline";
  const delimiter = isBlock ? "$$" : "$";

  const markdownDelimiter = isBlock ? "$$" : "$";

  return Node.create({
    name,
    group: isBlock ? "block" : "inline",
    content: "text*",
    inline: !isBlock,

    parseHTML() {
      return [
        {
          tag: tagName,
          getAttrs: (node) =>
            (node as HTMLElement).getAttribute("data-type") === type
              ? {}
              : false,
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        tagName,
        mergeAttributes(HTMLAttributes, {
          "data-type": type,
          class: className,
        }),
        0,
      ];
    },

    addInputRules() {
      const inlineRegex = /(^|[^$])(\$\$([^$\n]+?)\$\$)(?!\$)/;

      const blockRegex = /(^|[^$])(\$\$\$([^$\n]+?)\$\$\$)(?!\$)/;

      return [
        new InputRule({
          find: isBlock ? blockRegex : inlineRegex,
          handler: ({ state, range, match }) => {
            const typst = match[3];
            const { tr, schema } = state;

            const start = range.from + match[1].length;
            const end = range.to;

            const node = this.type.create({}, schema.text(typst));

            if (isBlock) {
              const $start = state.doc.resolve(start);

              if (
                $start.parent.type.name === "paragraph" &&
                $start.parent.content.size === end - start
              ) {
                const parentStart = $start.before();
                const parentEnd = $start.after();

                tr.replaceWith(parentStart, parentEnd, node);
                return;
              }
            }

            tr.replaceWith(start, end, node);
          },
        }),
      ];
    },

    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations: (state) => {
              const { selection } = state;
              const decorations: Decoration[] = [];
              state.doc.descendants((node, pos) => {
                if (node.type.name !== this.name) return;
                const isSelected =
                  selection.from >= pos && selection.to <= pos + node.nodeSize;
                if (isSelected) {
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: "focused",
                    }),
                  );
                }
              });
              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },

    addKeyboardShortcuts() {
      return {
        Backspace: () => {
          const { state } = this.editor;
          const { selection } = state;
          const { $from, empty } = selection;

          if (!empty || $from.parent.type.name !== this.name) {
            return false;
          }

          if ($from.parent.content.size === 0) {
            return this.editor.commands.deleteNode(this.name);
          }

          return false;
        },
      };
    },

    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement(tagName);
        dom.classList.add("math", className);

        const display = document.createElement("span");
        display.contentEditable = "false";
        display.classList.add("display");
        display.innerHTML = render(node.textContent, isBlock);

        const leftGuard = document.createElement("span");
        leftGuard.contentEditable = "false";
        leftGuard.classList.add("guard");
        leftGuard.textContent = markdownDelimiter;

        const rightGuard = document.createElement("span");
        rightGuard.contentEditable = "false";
        rightGuard.classList.add("guard");
        rightGuard.textContent = markdownDelimiter;

        const content = document.createElement("span");
        content.classList.add("content");

        dom.append(display);
        dom.append(leftGuard);
        dom.append(content);
        dom.append(rightGuard);

        return {
          dom,
          contentDOM: content,
          update: (updatedNode) => {
            if (updatedNode.type !== node.type) return false;
            if (updatedNode.textContent !== node.textContent) {
              display.innerHTML = render(updatedNode.textContent, isBlock);
            }
            return true;
          },
        };
      };
    },

    parseMarkdown: (token: any) => {
      return {
        type: name,
        content: [
          {
            type: "text",
            text: token.text,
          },
        ],
      };
    },

    renderMarkdown: (node) => {
      const latex = node.content
        ? node.content.map((child) => child.text).join("")
        : "";

      return `${delimiter}${latex}${delimiter}`;
    },

    markdownTokenizer: {
      name: name,
      level: isBlock ? "block" : "inline",
      start: (src: string) => src.indexOf("$"),
      tokenize: (src: string) => {
        const regex = isBlock ? /^\$\$([^$]+)\$\$/ : /^\$([^$]+)\$(?!\$)/;

        const match = src.match(regex);
        if (!match) {
          return undefined;
        }

        const [fullMatch, latex] = match;

        return {
          type: name,
          raw: fullMatch,
          text: latex.trim(),
          latex: latex.trim(),
        };
      },
    },
  });
};

// export const MathInline = createMathExtension("inline");
export const MathBlock = createMathExtension("block");

export const MathInline = Node.create({
  name: "inlineMath",

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex"),
        renderHTML: (attributes) => {
          return {
            "data-latex": attributes.latex,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-math"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "inline-math" }),
    ];
  },

  parseMarkdown: (token: any) => {
    return {
      type: "inlineMath",
      attrs: {
        latex: token.latex,
      },
    };
  },

  renderMarkdown: (node) => {
    const latex = node.attrs?.latex || "";

    return `$${latex}$`;
  },

  markdownTokenizer: {
    name: "inlineMath",
    level: "inline",
    start: (src: string) => src.indexOf("$"),
    tokenize: (src: string) => {
      const match = src.match(/^\$([^$]+)\$(?!\$)/);
      if (!match) {
        return undefined;
      }

      const [fullMatch, latex] = match;

      return {
        type: "inlineMath",
        raw: fullMatch,
        latex: latex.trim(),
      };
    },
  },

  addInputRules() {
    return [
      new InputRule({
        find: /(^|[^$])(\$\$([^$\n]+?)\$\$)(?!\$)/,
        handler: ({ state, range, match }) => {
          const latex = match[3];
          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.replaceWith(start, end, this.type.create({ latex }));
        },
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const wrapper = document.createElement("span");
      wrapper.className = "tiptap-mathematics-render";

      if (this.editor.isEditable) {
        wrapper.classList.add("tiptap-mathematics-render--editable");
      }

      wrapper.dataset.type = "inline-math";
      wrapper.setAttribute("data-latex", node.attrs.latex);

      function renderMath() {
        try {
          katex.render(node.attrs.latex, wrapper);
          wrapper.classList.remove("inline-math-error");
        } catch {
          wrapper.textContent = node.attrs.latex;
          wrapper.classList.add("inline-math-error");
        }
      }

      renderMath();

      return {
        dom: wrapper,
      };
    };
  },
});
