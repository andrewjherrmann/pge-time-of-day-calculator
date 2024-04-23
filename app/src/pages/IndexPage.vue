<template>
  <q-page>
    <div class="q-px-xl">
      <h6>Upload Your Data
        <q-icon class="q-ml-sm" name="info">
          <q-tooltip anchor="top right" self="top right" class="bg-white text-black">
            <q-banner class="bg-orange text-white q-mt-md">
              None of your data will be uploaded to any servers. This is only running on your computer.
            </q-banner>
            <q-banner :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-2'" class="q-my-md" >
              <p>Download your usage for the past year from the PGE website and upload into the tool. </p>
              <p>
                Doing so will tell you your utilization costs at the current PGE rate and will also estimate your costs if
                you
                switch to Time of Day billing.
              </p>
            </q-banner>
          </q-tooltip>
        </q-icon>
      </h6>

      <LoaderComponent />
      <ResultsViewer />
    </div>
  </q-page>
</template>

<script setup>
import LoaderComponent from './../components/Loader.vue'
import ResultsViewer from 'src/components/ResultsViewer.vue';

defineOptions({
  name: 'IndexPage'
});
</script>
