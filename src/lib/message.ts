import { invoke } from "@tauri-apps/api/core";
import { type ClientMessage } from "../../src-tauri/bindings/ClientMessage";
import { type ServerMessage } from "../../src-tauri/bindings/ServerMessage";
import type { ServerResult } from "../../src-tauri/bindings/ServerResult";
import { errorMessage } from "./error";

import { isTauri, platform, type Platform } from "./platform";

let $platform: Platform = null;
platform.subscribe((newPlatform) => {
  $platform = newPlatform;
});

export async function sendMessage(
  message: ClientMessage
): Promise<ServerMessage> {
  let serverResult: ServerResult;
  if (!isTauri()) {
    const response = await fetch("http://localhost:4242/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    serverResult = result;
  } else {
    serverResult = await invoke("message_command", { message });
  }
  if (serverResult.type == "err") {
    errorMessage.set(serverResult.error);
    throw new Error(serverResult.error);
  }
  return serverResult.message;
}

type ClientDataFor<T extends ClientMessage["type"]> = Extract<
  ClientMessage,
  { type: T }
> extends { data: infer D }
  ? D
  : undefined;

type ServerDataFor<T extends ServerMessage["type"]> = Extract<
  ServerMessage,
  { type: T }
> extends { data: infer D }
  ? D
  : undefined;

export async function msg<T extends ClientMessage["type"]>(
  ...args: ClientDataFor<T> extends undefined
    ? [type: T]
    : [type: T, data: ClientDataFor<T>] // allow user to omit data arg if no data is required
): Promise<ServerDataFor<T>> {
  const [type, maybeData] = args as [T, ClientDataFor<T> | undefined];

  const msg: ClientMessage = {
    type,
    ...(maybeData !== undefined ? { data: maybeData } : {}),
  } as ClientMessage;

  const response: ServerMessage = await sendMessage(msg);
  return (response as unknown as any).data as ServerDataFor<T>;
}
