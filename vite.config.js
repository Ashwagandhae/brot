import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import svgr from "vite-plugin-svelte-svgr";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(async () => ({
	plugins: [sveltekit(), svgr(), wasm(), topLevelAwait()],
	build: { target: "esnext" },
	ssr: {
		noExternal: ["@codemirror-lang-typst/wasm"],
	},
	resolve: {
		alias: {
			"@codemirror-lang-typst/wasm/typst_syntax.js": path.resolve(
				__dirname,
				"node_modules/codemirror-lang-typst/wasm/typst_syntax.js",
			),
		},
	},

	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			// 3. tell vite to ignore watching `src-tauri`
			ignored: ["**/src-tauri/**"],
		},
		fs: {
			allow: [".."],
		},
	},
}));
