<template>
  <q-page class="q-pa-xl">
    <LoaderComponent />
    <ResultsViewer />
  </q-page>
</template>

<script setup>
import LoaderComponent from './../components/Loader.vue'
import ResultsViewer from 'src/components/ResultsViewer.vue';

defineOptions({
  name: 'IndexPage'
});
</script>
