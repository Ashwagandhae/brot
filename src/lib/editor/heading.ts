import * as view from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { isCursorInside } from "./typstTree";

export const dynamicHeadingTheme: Extension = view.EditorView.theme({
	"&": {
		"--heading-marker-width": "70px",
	},
	".cm-heading-text": { fontWeight: "bold", color: "var(--text)" },
	".cm-heading-1": { fontSize: "2.2em" },
	".cm-heading-2": { fontSize: "1.8em" },
	".cm-heading-3": { fontSize: "1.5em" },
	".cm-heading-4": { fontSize: "1.2em" },
	".cm-heading-5": { fontSize: "1.0em" },
	".cm-heading-6": { fontSize: "0.8em" },
	".cm-heading-marker-hidden": {
		display: "inline-block",
		fontSize: "0 !important",
		width: "0 !important",
		letterSpacing: "-1ch !important",
		opacity: "0 !important",
		overflow: "hidden",
		verticalAlign: "middle",
	},
	".cm-heading-marker": {
		// display: "inline-block",
		// width: "var(--heading-marker-width)",
		// marginLeft: "calc(-1 * var(--heading-marker-width))",
		// textAlign: "right",
	},

	// ".cm-content": { paddingLeft: "var(--heading-marker-width)" },
});

export const dynamicHeadingSizes = view.ViewPlugin.fromClass(
	class {
		decorations: view.DecorationSet;

		constructor(view: view.EditorView) {
			this.decorations = this.buildDecorations(view);
		}

		update(update: view.ViewUpdate) {
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = this.buildDecorations(update.view);
			}
		}

		buildDecorations(view: view.EditorView) {
			const builder = new RangeSetBuilder<view.Decoration>();

			for (const { from, to } of view.visibleRanges) {
				syntaxTree(view.state).iterate({
					from,
					to,
					enter: (node) => {
						if (node.name === "Heading") {
							const markerNode = node.node.getChild("HeadingMarker");

							if (markerNode) {
								const markerText = view.state.sliceDoc(
									markerNode.from,
									markerNode.to,
								);
								const level = Math.min(markerText.trim().length, 6);

								let textStart = markerNode.to;
								const nextNode = markerNode.nextSibling;
								if (nextNode && nextNode.name === "Space") {
									textStart = nextNode.to;
								}

								const markerClass = isCursorInside(view.state, {
									from: markerNode.from,
									to: textStart,
								})
									? "cm-heading-marker"
									: "cm-heading-marker cm-heading-marker-hidden";

								builder.add(
									markerNode.from,
									textStart,
									Decoration.mark({ class: markerClass }),
								);

								if (textStart < node.to) {
									builder.add(
										textStart,
										node.to,
										Decoration.mark({
											class: `cm-heading-text cm-heading-${level}`,
										}),
									);
								}
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
