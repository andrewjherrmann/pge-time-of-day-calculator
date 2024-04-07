<template>
  <div>
    <BarChart  class="q-mt-xl" :chart-data="barChartData" :chart-options="barChartOptions"
      v-if="totalBasicServiceCharges && totalTimeOfUseServiceCharges" />
    <BarChart  class="q-mt-xl" :chart-data="monthlyBarChartData" :chart-options="monthlyBarChartOptions"
      v-if="totalBasicServiceCharges && totalTimeOfUseServiceCharges" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Info } from 'luxon';
import { usePgeUsageStore } from './../stores/pge-usage-store';
import BarChart from "./Charts/BarChart.vue";
defineOptions({
  name: "ResultsViewerComponent",
});

//store 
const pgeUsageStore = usePgeUsageStore()

//ref
const barChartOptions = ref({
  plugins: {
    title: {
      display: true,
      text: 'Basic vs. Time of Day Analysis'
    },
  },
  responsive: true,
  scales: {
    y: {
      beginAtZero: true
    }
  }
})

const monthlyBarChartOptions = ref({
  plugins: {
    title: {
      display: true,
      text: 'Monthly Analysis'
    },
  },
  responsive: true,
  scales: {
    x: {
      stacked: true,
    },
    y: {
      stacked: true
    }
  }
});

//computeds
const totalBasicServiceCharges = computed(() => pgeUsageStore.timeOfDayBuckets.find(b => b.category === "basic"))
const totalTimeOfUseServiceCharges = computed(() => pgeUsageStore.timeOfDayBuckets.find(b => b.category === "timeOfUse"))
const barChartData = computed(() => {
  return {
    labels: ['Data Comparison'],
    datasets: [
      {
        label: 'Basic',
        data: [totalBasicServiceCharges.value.kwhUsageCost]
      },
      {
        label: 'TimeOfUse',
        data: [totalTimeOfUseServiceCharges.value.kwhUsageCost]
      }

    ]
  }
})
const monthlyBarChartData = computed(() => pgeUsageStore.monthlyBarChartData)

</script>
