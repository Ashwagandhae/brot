import type { PreviewerResult } from "../../../src-tauri/bindings/PreviewerResult";
import { StateField, StateEffect, type ChangeSet } from "@codemirror/state";
import {
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	type PluginValue,
} from "@codemirror/view";
import { PreviewerApi } from "./previewApi";
import type { SourceChange } from "../../../src-tauri/bindings/SourceChange";
import type { Diagnostic } from "../../../src-tauri/bindings/Diagnostic";
import { getPreviewAreas } from "./previewArea";

export type PreviewerResultEffect = {
	version: number;
	result: PreviewerResult;
};

export const previewerResultEffect =
	StateEffect.define<PreviewerResultEffect>();

export type PreviewMap = Partial<Record<`${number}-${number}`, string>>;
export type PreviousPreviewMap = {
	map: PreviewMap;
	changes: ChangeSet;
};
export type PreviewStatusMap =
	| { type: "normal"; map: PreviewMap }
	| {
			type: "compileErr";
			prevMap: PreviousPreviewMap | null;
			diags: Diagnostic[] | null;
	  }
	| { type: "loading"; prevMap: PreviousPreviewMap | null };
export type PreviewState = {
	docVersion: number;
	statusMap: PreviewStatusMap;
};
export function getRangeKey(range: {
	start: number;
	end: number;
}): `${number}-${number}` {
	return `${range.start}-${range.end}`;
}
export function getMap(statusMap: PreviewStatusMap): PreviewMap | null {
	if (statusMap.type === "normal") {
		return statusMap.map;
	} else {
		return statusMap.prevMap?.map ?? null;
	}
}
function getPrevMap(
	statusMap: PreviewStatusMap,
	changes: ChangeSet,
): PreviousPreviewMap | null {
	if (statusMap.type === "normal") {
		return {
			map: statusMap.map,
			changes,
		};
	}
	if (statusMap.prevMap === null) {
		return null;
	}
	return {
		map: statusMap.prevMap.map,
		changes: statusMap.prevMap.changes.compose(changes),
	};
}
export const previewStateField = StateField.define<PreviewState>({
	create: () => ({
		docVersion: 0,
		statusMap: { type: "loading", prevMap: null },
	}),
	update: (value, transaction) => {
		if (transaction.docChanged) {
			return {
				docVersion: value.docVersion + 1,
				statusMap: {
					prevMap: getPrevMap(value.statusMap, transaction.changes),
					type: "loading",
				},
			};
		}
		let newStatusMap = value.statusMap;
		for (const effect of transaction.effects) {
			if (effect.is(previewerResultEffect)) {
				const res = effect.value;
				if (value.statusMap !== null && value.statusMap.type !== "loading")
					continue;
				if (res.version !== value.docVersion) continue;
				if (res.result.type === "Ok") {
					const map: PreviewMap = {};
					for (const [range, html] of res.result.value) {
						const key = getRangeKey(range);
						map[key] = html;
					}
					newStatusMap = { type: "normal", map };
				} else {
					let diags = null;
					if (res.result.err.type == "CompileFailure") {
						diags = res.result.err.diags;
					}
					newStatusMap = {
						type: "compileErr",
						diags,
						prevMap: value.statusMap.prevMap,
					};
				}
			}
		}
		return { docVersion: value.docVersion, statusMap: newStatusMap };
	},
});
export const updateSourcePlugin = ViewPlugin.fromClass(
	class implements PluginValue {
		init: boolean;
		api: PreviewerApi;
		constructor(view: EditorView) {
			this.init = false;
			this.api = new PreviewerApi(crypto.randomUUID());
			this.maybeInit(view);
		}
		maybeInit(view: EditorView) {
			if (this.init) {
				return;
			}
			const previewAreas = getPreviewAreas(view.visibleRanges, view.state);
			if (previewAreas.size > 0) {
				const initialText = view.state.doc.toString();
				updateSource(view, { Replace: initialText }, this.api);
				this.init = true;
			}
		}

		update(update: ViewUpdate) {
			if (!this.init) {
				this.maybeInit(update.view);
			} else {
				if (update.docChanged) {
					const edits: [{ start: number; end: number }, string][] = [];

					update.changes.iterChanges((start, end, _fromB, _toB, inserted) => {
						edits.unshift([{ start, end }, inserted.toString()]);
					});
					updateSource(update.view, { Edits: edits }, this.api);
				}
			}
		}
		destroy(): void {
			this.api.closeEditorView();
		}
	},
);
export function updateSource(
	view: EditorView,
	change: SourceChange,
	api: PreviewerApi,
) {
	(async () => {
		const previewState = view.state.field(previewStateField);
		const version = previewState.docVersion;

		const result = await api.updateSource(change);
		view.dispatch({ effects: previewerResultEffect.of({ version, result }) });
	})();
}

export function getHtmlFromCache(
	previewState: PreviewState,
	start: number,
	end: number,
): string | undefined {
	const statusMap = previewState.statusMap;
	if (statusMap === null) {
		return undefined;
	}
	return getMap(statusMap)?.[getRangeKey({ start, end })];
}
