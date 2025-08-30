<script lang="ts" generics="T">
  import type { CommandProvider } from "./command";
  import CommandPalette from "./CommandPalette.svelte";

  let {
    onfinish,
    choices,
  }: {
    onfinish: (out: T | null) => void;
    choices: { title: string; payload: T }[];
  } = $props();

  let provider: CommandProvider<T> = {
    async search(search, start, end) {
      return choices
        .filter(({ title }) => title.includes(search))
        .map(({ title, payload }) => ({
          title,
          payload,
          icon: null,
          shortcut: null,
          indices: [],
          path: null,
        }))
        .slice(start, end);
    },
  };
</script>

<CommandPalette {provider} {onfinish}></CommandPalette>
