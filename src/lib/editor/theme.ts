import { EditorView } from "codemirror";
export const indentWidth = 12;

export const theme = EditorView.theme(
	{
		"&": {
			backgroundColor: "transparent",
			"--text": "oklch(0.85 0 0)",
			"--text-string": "oklch(0.7 0.2 140)",
			"--text-cursor": "oklch(0 0 0)",
			"--back": "oklch(0.3 0 0)",
			"--back-translucent": "oklch(1 0 0 / 0.1)",
			"--font-prop": "Atkinson Hyperlegible Next",
			"--font-mono": "JetBrains Mono",
			"--indent-width": `${indentWidth}px`,
			"--link-color": "oklch(0.8 0.15 260)",
			"--highlight-color": "oklch(0.3 0.15 110)",
			"--line-color": "oklch(0.6 0 0)",
			"--pad": "4px",
			color: "var(--text)",
			height: "auto",
			margin: "auto",
			maxWidth: "60em",
		},
		".cm-scroller": {
			overflow: "visible",
		},
		".cm-content": {
			caretColor: "oklch(1 0 0)",
			fontFamily: "var(--font-mono)",
			fontSize: "var(--font-size)",
			lineHeight: "1.6",
		},
		"&.cm-focused .cm-cursor": {
			borderLeftColor: "oklch(1 0 0)",
		},
		"&.cm-focused .cm-selectionBackground, ::selection": {
			backgroundColor: "oklch(1 0 0)",
		},
		".cm-gutters": {
			color: "oklch(0.8 0 0)",
			borderRight: "1px solid #333",
		},
		".cm-hx-block-cursor .cm-hx-cursor": {
			background: "var(--text)",
		},
		".cm-hx-block-cursor span.cm-hx-cursor ": {
			background: "var(--text)",
			color: "var(--text-cursor)",
		},
		".cm-hx-status-panel": {
			display: "none",
		},
		".cm-panels": {
			background: "transparent",
		},
		".cm-panels:has(.cm-panel-open)": {
			background: "var(--back)",
		},
		".cm-tooltip.cm-tooltip-lint": {
			fontFamily: "var(--font-prop)",
			fontSize: "14px",
		},
		".cm-diagnostic": {
			fontFamily: "var(--font-prop)",
			fontSize: "14px",
		},
		".cm-line": {
			padding: "0px",
		},
	},
	{ dark: true },
);
