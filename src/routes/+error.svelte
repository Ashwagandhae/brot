<script lang="ts">
  export let error;
  export let status;
</script>

<h1>{status}</h1>
<p>{error?.message}</p>

<a href="./">Home</a>
