<script lang="ts" generics="T extends ArgType">
  import { type ArgType, type ArgTypesMap } from "./actions";
  import PaletteOutput from "./PaletteOutput.svelte";

  let {
    onfinish,
    argType,
  }: { onfinish: (out: ArgTypesMap[T] | null) => void; argType: T } = $props();
</script>

<svelte:window onkeydown={() => onfinish(null)} />
<PaletteOutput selected={false}>
  <div class="text">
    unsupported arg type: {argType}
  </div>
</PaletteOutput>

<style>
  .text {
    padding: 8px;
  }
</style>
