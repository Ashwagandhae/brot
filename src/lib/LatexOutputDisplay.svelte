<script lang="ts">
  import type { Latex } from "./parse";

  let { val }: { val: Latex; message?: string } = $props();
</script>

{@html val.html}
