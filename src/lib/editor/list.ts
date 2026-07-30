import {
	EditorView,
	ViewPlugin,
	Decoration,
	type DecorationSet,
	type ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import { RangeSetBuilder, type Extension, type Text } from "@codemirror/state";

const bulletMark = Decoration.mark({
	class: "cm-bullet-marker",
});

function getEnumMark(number: number) {
	const digits = number.toString().length;
	const markText = `${number}.`;

	return Decoration.mark({
		class: "cm-enum-marker",
		attributes: {
			"data-number": markText,
			style: `width: calc(var(--indent-width) + ${(digits - 1) * 10}px)`,
		},
	});
}

function getEnumMarkerNumber(
	node: SyntaxNode,
	doc: Text,
): { type: "auto" | "explicit"; val: number } {
	const markerText = doc.sliceString(node.from, node.to);
	if (markerText !== "+") {
		return { type: "explicit", val: parseInt(markerText, 10) };
	}
	const parent = node.parent;
	if (parent == null) return { type: "auto", val: 0 };

	let prevEnumSibling = parent.prevSibling;
	while (prevEnumSibling !== null && prevEnumSibling.name !== "EnumItem") {
		prevEnumSibling = prevEnumSibling.prevSibling;
	}
	if (prevEnumSibling == null) return { type: "auto", val: 1 };
	if (prevEnumSibling.firstChild == null) return { type: "auto", val: 0 };

	const val = getEnumMarkerNumber(prevEnumSibling.firstChild, doc).val + 1;
	return { type: "auto", val };
}

export const listTheme: Extension = EditorView.theme({
	".cm-bullet-marker": {
		color: "transparent",
		position: "relative",
		display: "inline-block",
		width: "var(--indent-width)",
		fontFamily: "var(--font-prop)",
		textIndent: "0",
	},
	".cm-bullet-marker::before": {
		content: "'•'",
		color: "var(--text)",
		position: "absolute",
		left: 0,
		fontWeight: "bold",
	},

	".cm-enum-marker": {
		color: "transparent",
		position: "relative",
		display: "inline-block",
		width: "var(--indent-width)",
		fontFamily: "var(--font-prop)",
		textIndent: "0",
	},
	".cm-enum-marker::before": {
		content: "attr(data-number)",
		color: "var(--text)",
		position: "absolute",
		width: "100px",
		whitespace: "nowrap",
		left: 0,
	},
	".cm-indent-space": {
		display: "inline-block",
		width: "var(--indent-width)",
		fontFamily: "var(--font-prop)",
	},
	".cm-hx-cursor .cm-bullet-marker::before, .cm-hx-cursor .cm-enum-marker::before":
		{
			color: "transparent",
		},
	".cm-hx-cursor .cm-bullet-marker, .cm-hx-cursor .cm-enum-marker": {
		color: "var(--text-cursor)",
	},
});
export const listPlugin: Extension = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = this.buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = this.buildDecorations(update.view);
			}
		}

		buildDecorations(view: EditorView) {
			const builder = new RangeSetBuilder<Decoration>();
			const { doc } = view.state;

			for (const { from, to } of view.visibleRanges) {
				syntaxTree(view.state).iterate({
					from,
					to,
					enter: (node) => {
						if (node.name !== "ListMarker" && node.name !== "EnumMarker") {
							return;
						}

						if (node.name === "ListMarker") {
							builder.add(node.from, node.to, bulletMark);
						} else {
							const enumNumber = getEnumMarkerNumber(node.node, doc);
							if (enumNumber.type === "auto") {
								builder.add(node.from, node.to, getEnumMark(enumNumber.val));
							}
						}
					},
				});
			}

			return builder.finish();
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);
const spaceMark = Decoration.mark({
	class: "cm-indent-space",
});

export const indentPlugin: Extension = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = this.buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = this.buildDecorations(update.view);
			}
		}

		buildDecorations(view: EditorView) {
			const builder = new RangeSetBuilder<Decoration>();
			const { doc } = view.state;

			for (const { from, to } of view.visibleRanges) {
				for (let pos = from; pos <= to; ) {
					const line = doc.lineAt(pos);
					const lineText = line.text;

					const leadingSpaceMatch = lineText.match(/^ */);
					const spaceCount = leadingSpaceMatch
						? leadingSpaceMatch[0].length
						: 0;

					if (spaceCount > 0) {
						for (let i = 0; i < spaceCount; i++) {
							builder.add(line.from + i, line.from + i + 1, spaceMark);
						}
					}
					pos = line.to + 1;
				}
			}
			return builder.finish();
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);
