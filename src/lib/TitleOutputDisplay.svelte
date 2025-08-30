<script lang="ts" generics="T">
  import Title from "./Title.svelte";

  let { val }: { val: string; message?: string } = $props();
  let path = $derived(val.replaceAll(" ", "_"));
</script>

<Title {path}></Title>
