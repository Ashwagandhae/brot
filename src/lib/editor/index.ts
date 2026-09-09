import { bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { EditorSelection, type StateCommand } from "@codemirror/state";
import {
	history,
	insertNewlineAndIndent,
	insertNewlineKeepIndent,
} from "@codemirror/commands";
import { highlightSpecialChars, drawSelection, keymap } from "@codemirror/view";
import { Prec, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "codemirror";
import { dynamicHeadingSizes, dynamicHeadingTheme } from "./heading";
import { indentPlugin, listPlugin, listTheme } from "./list";
import { tagHighlight } from "./tagHighlight";
import { typst } from "./typstLang";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { defaultKeymap } from "@codemirror/commands";
import {
	previewTheme,
	previewTooltipField,
	previewDecorationPlugin,
} from "./previewRender";
import { previewStateField, updateSourcePlugin } from "./previewExtension";
import {
	clickableLinkHandler,
	inlineMarkupPlugin,
	inlineMarkupTheme,
} from "./inlineMarkup";
import { closeBrackets } from "@codemirror/autocomplete";
import { theme } from "./theme";
import { previewLinter } from "./previewLinter";
import { helix } from "./helix/lib";
import { commands, type TypableCommand } from "./helix/lib";

export type Options = {
	helix: boolean;
	linkHandler: (url: string) => void;
	commands?: TypableCommand[];
};

export async function typstishLivePreview(
	options: Options,
): Promise<Extension> {
	const livePreview = Prec.highest([
		syntaxHighlighting(oneDarkHighlightStyle),
		syntaxHighlighting(tagHighlight),
		theme,
		dynamicHeadingSizes,
		dynamicHeadingTheme,
		inlineMarkupTheme,
		inlineMarkupPlugin,
		clickableLinkHandler({
			linkHandler: options.linkHandler,
		}),
		listTheme,
		listPlugin,
		indentPlugin,
		previewStateField,
		updateSourcePlugin,
		previewTheme,
		previewDecorationPlugin,
		previewTooltipField,
		previewLinter,
	]);
	const res = [
		highlightSpecialChars(),
		history(),
		drawSelection(),
		await typst(),
		EditorView.lineWrapping,
		EditorState.tabSize.of(2),
		bracketMatching(),
		closeBrackets(),
	];
	if (options.helix) {
		res.push(
			Prec.high([
				helix({
					config: { "editor.cursor-shape.insert": "bar" },
					drawSelection: false,
					linkHandler: options.linkHandler,
				}),
				commands.of(options.commands ?? []),
			]),
		);
	} else {
		res.push(Prec.high(keymap.of(defaultKeymap)));
	}
	res.push(
		Prec.highest(
			keymap.of([
				{
					key: "Enter",
					run: insertNewlineContinueTypstList,
				},
			]),
		),
	);
	res.push(livePreview);
	return res;
}

export const insertNewlineContinueTypstList: StateCommand = ({
	state,
	dispatch,
}) => {
	if (state.readOnly) return false;

	const changes = state.changeByRange((range) => {
		const line = state.doc.lineAt(range.head);

		const match = line.text.match(/^(\s*)([-+]\s)?/);
		const indent = match ? match[1] : "";
		const marker = match && match[2] ? match[2] : "";

		if (marker && line.text.trim() === marker.trim()) {
			return {
				changes: {
					from: line.from + indent.length,
					to: line.to,
					insert: "",
				},

				range: EditorSelection.cursor(line.from + indent.length),
			};
		}

		const prefix = indent + marker;

		return {
			changes: { from: range.from, to: range.to, insert: "\n" + prefix },
			range: EditorSelection.cursor(range.from + 1 + prefix.length),
		};
	});

	if (dispatch) {
		dispatch(
			state.update(changes, { scrollIntoView: true, userEvent: "input" }),
		);
	}

	return true;
};
