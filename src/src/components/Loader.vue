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
      :label="processing || 'Process Files'"
      :loading="!!processing"
      @click="processFiles"
    >
      <template v-slot:loading
        ><div class="q-px-md">
          <span>{{ processing }}</span
          ><q-spinner class="q-ml-md" />
        </div> </template
    ></q-btn>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import csvtojson from "csvtojson";

defineOptions({
  name: "LoaderComponent",
});

//refs
const uploader = ref(null);
const processing = ref(null);

//methods
const parseFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      resolve(e.target.result);
    };

    reader.onerror = (e) => {
      reject(e);
    };

    reader.readAsText(file);
  });
};

const processFiles = async () => {
  processing.value = "Parsing CSV Files";
  for (let i = 0; i < uploader.value.files.length; i++) {
    const csv = await parseFile(uploader.value.files[i]);
    const jsonArray = await csvtojson().fromString(csv);

    // Do something with the JSON data, like sending it to an API
    console.log(jsonArray);
  }
  processing.value = "Processing Data";

  processing.value = null;
};
//computeds
const hasFiles = computed(() => uploader.value?.files?.length > 0);
</script>
<style lang="scss" scoped>
.process-btn {
  width: 200px;
}
</style>