import {
	RangeSetBuilder,
	type Extension,
	RangeSet,
	StateField,
	type EditorState,
} from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	type DecorationSet,
	type ViewUpdate,
	WidgetType,
	type Tooltip,
	showTooltip,
} from "@codemirror/view";
import {
	getMap,
	getRangeKey,
	previewerResultEffect,
	previewStateField,
} from "./previewExtension";
import { getPreviewAreas, type PreviewArea } from "./previewArea";

export const previewTheme: Extension = EditorView.theme({
	".cm-preview-inline-hidden": {
		display: "inline-block",
		fontSize: "0 !important",
		width: "0 !important",
		letterSpacing: "-1ch !important",
		opacity: "0 !important",
		overflow: "hidden",
		verticalAlign: "middle",
	},
	".cm-preview-block-hidden": {
		// opacity: "0 !important",
	},
	".cm-block-preview": {
		display: "block",
		width: "0px",
		overflow: "visible",
	},
	".cm-inline-preview": {
		display: "inline-block",
	},
	".cm-block-preview-inner": {
		display: "block",
		width: "max-content",
	},
	".cm-preview-content": {
		fontFamily: "var(--font-prop)",
		fontSize: "var(--font-size)",
	},
	".cm-preview-content table": {
		borderCollapse: "collapse",
		borderSpacing: "0",
		margin: "0",
		tableLayout: "fixed",
		width: "auto",
	},
	".cm-preview-content table :is(th, td)": {
		border: "1px solid var(--line-color)",
		padding: "var(--pad)",
	},
});
const inlineHiddenMark = Decoration.mark({
	class: "cm-preview-inline-hidden",
});
const blockHiddenMark = Decoration.mark({
	class: "cm-preview-block-hidden",
});
class PreviewWidget extends WidgetType {
	html: string;
	isBlock: boolean;
	constructor(html: string, isBlock: boolean) {
		super();
		this.html = html;
		this.isBlock = isBlock;
	}

	toDOM() {
		if (this.isBlock) {
			const wrap = document.createElement("div");
			wrap.className = "cm-block-preview";
			const inner = document.createElement("div");
			inner.className = "cm-block-preview-inner cm-preview-content";
			if (this.html) {
				inner.innerHTML = this.html;
				wrap.appendChild(inner);
			}
			return wrap;
		} else {
			const wrap = document.createElement("span");
			wrap.className = "cm-inline-preview cm-preview-content";
			wrap.innerHTML = this.html;
			return wrap;
		}
	}

	ignoreEvent() {
		return false;
	}
}
export const previewDecorationPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = getPreviewDecorations(view);
		}

		update(update: ViewUpdate) {
			const previewStateChanged =
				update.startState.field(previewStateField) !==
				update.state.field(previewStateField);
			if (
				update.docChanged ||
				update.selectionSet ||
				update.viewportChanged ||
				previewStateChanged
			) {
				this.decorations = getPreviewDecorations(update.view);
			}
		}
	},
	{
		decorations: (v) => v.decorations,
	},
);

function getPreviewDecorations(view: EditorView): DecorationSet {
	return RangeSet.join([
		buildHideDecorations(view),
		buildPreviewDecorations(view),
	]);
}
function buildHideDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { area } of getPreviews(view.visibleRanges, view.state)) {
		if (area.isCursorInside(view.state)) continue;
		builder.add(
			area.docRange.from,
			area.docRange.to,
			area.isBlock ? blockHiddenMark : inlineHiddenMark,
		);
	}
	return builder.finish();
}

function buildPreviewDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const { area, html } of getPreviews(view.visibleRanges, view.state)) {
		if (area.isTooltip(view.state)) continue;
		const widget = new PreviewWidget(html, area.isBlock);
		let pos = area.docRange.from;
		if (area.isBlock) {
			pos = area.docRange.to;
			if (pos >= view.state.doc.length) {
				continue;
			}
			if (view.state.sliceDoc(pos, pos + 1) !== "\n") {
				continue;
			}
		}
		builder.add(pos, pos, Decoration.widget({ widget }));
	}
	return builder.finish();
}
export const previewTooltipField = StateField.define<readonly Tooltip[]>({
	create: getPreviewTooltips,

	update(tooltips, tr) {
		if (
			!tr.docChanged &&
			!tr.selection &&
			!tr.effects.some((e) => e.is(previewerResultEffect))
		)
			return tooltips;
		return getPreviewTooltips(tr.state);
	},

	provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
});
function getPreviewTooltips(state: EditorState): readonly Tooltip[] {
	// we don't move area ranges because this runs before syntaxTree has time to update
	return getPreviews([state.selection.main], state, false)
		.filter(({ area }) => area.isTooltip(state))
		.map(({ html, area }) => {
			const docText = state.sliceDoc(area.docRange.from, area.docRange.to);
			let pos = area.docRange.from;
			if (docText.includes("\n")) {
				pos = area.docRange.to;
			}

			return {
				pos,
				above: false,
				strictSide: false,
				// arrow: true,
				create: () => {
					const dom = document.createElement("div");
					dom.classList.add("cm-preview-content");
					dom.classList.add("cm-tooltip-preview");
					dom.innerHTML = html;
					return { dom };
				},
			};
		});
}

function getPreviews(
	ranges: readonly { from: number; to: number }[],
	state: EditorState,
	moveAreaRanges: boolean = true,
): { area: PreviewArea; html: string }[] {
	const previewState = state.field(previewStateField);
	let previewAreas = getPreviewAreas(ranges, state);
	if (
		moveAreaRanges &&
		previewState.statusMap.type !== "normal" &&
		previewState.statusMap.prevMap !== null
	) {
		// map preview ranges back to last valid compile
		// so that they point to valid things in the map
		const changesSinceValidCompile = previewState.statusMap.prevMap.changes;
		previewAreas = previewAreas.map(changesSinceValidCompile.invertedDesc);
	}
	const map = getMap(previewState.statusMap);

	const cursor = previewAreas.iter();
	const res = [];
	while (cursor.value !== null) {
		const area = cursor.value;
		const html = map?.[getRangeKey({ start: cursor.from, end: cursor.to })];

		if (html !== undefined) {
			res.push({ area, html });
		}
		cursor.next();
	}
	return res;
}
