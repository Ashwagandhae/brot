<script lang="ts">
  import type { LatexRender } from "./parse";

  let { val }: { val: LatexRender; message?: string } = $props();
</script>

{@html val.html}
