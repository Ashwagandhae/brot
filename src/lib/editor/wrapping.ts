import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	type DecorationSet,
	type ViewUpdate,
} from "@codemirror/view";
import { indentWidth } from "./theme";

export const wrappingPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = getWrappingDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = getWrappingDecorations(update.view);
			}
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);
function getWrappingDecorations(view: EditorView) {
	const builder = new RangeSetBuilder<Decoration>();
	for (const block of view.viewportLineBlocks) {
		const line = view.state.doc.lineAt(block.from);
		const matches = line.text.match(/^\s*(-|\d*\.|\+|(\/\s+\S+:))?\s*/);
		if (matches == null) continue;
		const p = matches[0].length * indentWidth,
			v = `text-indent: -${p}px; padding-inline-start: ${p + 6}px`,
			decoration = Decoration.line({
				attributes: {
					style: v,
				},
			});
		builder.add(line.from, line.from, decoration);
	}
	return builder.finish();
}
