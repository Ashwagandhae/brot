import { getCurrentWindow } from "@tauri-apps/api/window";

let isClosing = false;

export function onBeforeClose(handler: () => Promise<void>) {
	let win = getCurrentWindow();
	win.onCloseRequested(async (event) => {
		if (isClosing) return;

		event.preventDefault();
		isClosing = true;

		try {
			await handler();
		} finally {
			await win.close();
		}
	});
}
