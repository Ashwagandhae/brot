<script lang="ts">
  import { getSettings, setSettings } from "$lib/message";
  import { onMount } from "svelte";
  import type { Settings } from "../../../src-tauri/bindings/Settings";
  import { getViewStateContext } from "$lib/viewState";
  let viewState = getViewStateContext();
  $viewState = { type: "settings" };

  let settings: Settings = $state({ notes_path: null, window_states: {} });

  onMount(async () => {
    settings = await getSettings();
  });

  async function updateSettings() {
    await setSettings(settings);
  }
</script>

<main>
  <h1>Settings</h1>
  <form onsubmit={updateSettings}>
    <textarea bind:value={settings.notes_path}></textarea>
    <button type="submit">Submit</button>
    <a href="../">back</a>
  </form>
</main>

<style>
  main {
    width: 100%;
    height: 100%;
  }
</style>
