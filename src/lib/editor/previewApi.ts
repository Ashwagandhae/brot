import type { SourceChange } from "../../../src-tauri/bindings/SourceChange";
import type { PreviewerResult } from "../../../src-tauri/bindings/PreviewerResult";
import { msg } from "$lib/message";

export class PreviewerApi {
	constructor(private editorViewId: string) {}

	async updateSource(change: SourceChange): Promise<PreviewerResult> {
		return await msg("previewerUpdateSource", {
			change,
			editorViewId: this.editorViewId,
		});
	}
	async closeEditorView(): Promise<void> {
		return await msg("previewerCloseEditorView", {
			editorViewId: this.editorViewId,
		});
	}
}
