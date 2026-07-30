import { linter, type Diagnostic } from "@codemirror/lint";
import { previewStateField } from "./previewExtension";

export const previewLinter = linter(
	(view) => {
		const previewState = view.state.field(previewStateField);
		if (
			previewState.statusMap.type === "compileErr" &&
			previewState.statusMap.diags != null
		) {
			return previewState.statusMap.diags.map((diag) => {
				const ret: Diagnostic = {
					from: diag.range.start,
					to: diag.range.end,
					severity: "error",
					message: diag.message,
				};
				return ret;
			});
		}
		return [];
	},
	{
		needsRefresh: (update) => {
			const prevField = update.startState.field(previewStateField);
			const nextField = update.state.field(previewStateField);
			return prevField !== nextField;
		},
	},
);
