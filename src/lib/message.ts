import { invoke } from "@tauri-apps/api/core";
import { type ClientMessage } from "../../src-tauri/bindings/ClientMessage";
import { type ServerMessage } from "../../src-tauri/bindings/ServerMessage";
import type { Settings } from "../../src-tauri/bindings/Settings";
import type { Note } from "../../src-tauri/bindings/Note";
import { errorMessage } from "./error";

import { platform, type Platform } from "./platform";
import type { PaletteAction } from "../../src-tauri/bindings/PaletteAction";
import type { PartialActionFilter } from "../../src-tauri/bindings/PartialActionFilter";
import type { Actions } from "../../src-tauri/bindings/Actions";

let $platform: Platform = null;
platform.subscribe((newPlatform) => {
  $platform = newPlatform;
});

export async function sendMessage(
  message: ClientMessage
): Promise<ServerMessage> {
  let serverMessage: ServerMessage;
  if (!(window as unknown as any).__TAURI_INTERNALS__) {
    const response = await fetch("http://localhost:4242/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    serverMessage = result;
  } else {
    serverMessage = await invoke("message_command", { message });
  }
  if (serverMessage.type == "Error") {
    errorMessage.set(serverMessage.error);
  }
  return serverMessage;
}

export async function getSettings(): Promise<Settings> {
  let res = await sendMessage({ type: "RequestSettings" });
  return (res as { settings: Settings }).settings;
}

export async function setSettings(settings: Settings): Promise<null> {
  await sendMessage({ type: "UpdateSettings", settings });
  return null;
}

export async function getNote(path: string): Promise<Note> {
  let res = await sendMessage({ type: "RequestNote", path });

  return (res as { note: Note }).note;
}

export async function setNote(path: string, note: Note): Promise<null> {
  await sendMessage({ type: "UpdateNote", path, note });
  return null;
}

export async function createNote(title: string): Promise<string> {
  let res = await sendMessage({ type: "CreateNote", title });
  return (res as { path: string }).path;
}

export async function getPaletteActions(
  search: string,
  palette_key: string,
  filters: PartialActionFilter[]
): Promise<Array<PaletteAction>> {
  let res = await sendMessage({
    type: "GetPaletteActions",
    search,
    palette_key,
    filters,
  });
  return (res as { actions: Array<PaletteAction> }).actions;
}

export async function getPinned(): Promise<Array<string>> {
  let res = await sendMessage({ type: "GetPinned" });
  return (res as { pinned: Array<string> }).pinned;
}

export async function addPinned(path: string, position: number): Promise<null> {
  await sendMessage({ type: "AddPinned", path, position });
  return null;
}

export async function removePinned(path: string): Promise<null> {
  await sendMessage({ type: "RemovePinned", path });
  return null;
}

export async function refresh(): Promise<null> {
  await sendMessage({ type: "Refresh" });
  return null;
}

export async function getActions(): Promise<Actions> {
  let res = await sendMessage({ type: "GetActions" });
  return (res as { actions: Actions }).actions;
}
