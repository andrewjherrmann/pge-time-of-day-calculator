<template>
  <Bar :data="chartData" :options="chartOptions" />
</template>

<script setup props="props">
import { ref, computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Colors, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, Colors)

// Define props
const props = defineProps({
  chartData: {
    type: Object,
    required: true
  },
  chartOptions: {
    type: Object,
    required: true
  }
})

// Create reactive references for props
const chartData = ref(props.chartData)
const chartOptions = ref(props.chartOptions)

// Computed properties
const computedChartData = computed(() => chartData.value)
const computedChartOptions = computed(() => chartOptions.value)
</script>
