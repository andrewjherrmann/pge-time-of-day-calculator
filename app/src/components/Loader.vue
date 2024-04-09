<template>
  <div>
    <q-uploader
      ref="uploader"
      class="full-width"
      hide-upload-btn
      multiple
    ></q-uploader>
    <q-btn
      v-if="hasFiles"
      class="q-mt-md process-btn"
      color="primary"
      :label="pgeUsageStore.processing || 'Process Files'"
      :loading="!!pgeUsageStore.processing"
      @click="processFiles"
    >
      <template v-slot:loading
        ><div class="q-px-md">
          <span>{{ pgeUsageStore.processing }}</span
          ><q-spinner class="q-ml-md" />
        </div> </template
    ></q-btn>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { usePgeUsageStore } from './../stores/pge-usage-store'

defineOptions({
  name: "LoaderComponent",
});

//store 
const pgeUsageStore = usePgeUsageStore()

//refs
const uploader = ref(null);

//methods
const processFiles = async () => {
  await pgeUsageStore.processFiles(uploader.value.files);
}

//computeds
const hasFiles = computed(() => uploader.value?.files?.length > 0);

</script>
<style lang="scss" scoped>
.process-btn {
  width: 200px;
}
</style>