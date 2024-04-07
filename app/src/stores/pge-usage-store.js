import { defineStore } from 'pinia';
import csvtojson from "csvtojson";
import { DateTime, Info } from 'luxon';

export const usePgeUsageStore = defineStore('pge-usage', {
  state: () => ({
    processing: false,
    historicalData: [],
    timeOfDayBuckets: [],
    yearlyBuckets: [],
    monthlyBarChartData: null,
    dateRange: {
      minDateTime: null,
      maxDateTime: null,
      minYear: null,
      maxYear: null,
      minMonth: null,
      maxMonth: null,
    },
    pricing: {
      basic: 0.1966,
      offPeak: 0.0839,
      midPeak: 0.1577,
      onPeak: 0.4111
    }
  }),
  getters: {
    // doubleCount: (state) => state.counter * 2,
  },
  actions: {
    async parseFile(file) {
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
    },
    processData() {
      this.processing = "Processing Data";

      for (let i = 0; i < this.historicalData.length; i++) {
        const entry = this.historicalData[i];
        entry.date = entry["DATE"];
        entry.startTime = entry["START TIME"];
        entry.endTime = entry["END TIME"];
        let kwhUsage = Number.parseFloat(entry["USAGE (kWh)"]);
        if (Number.isNaN(kwhUsage)) {
          kwhUsage = 0;
        }
        entry.kwhUsage = kwhUsage;
        entry.startDateTime = DateTime.fromFormat(`${entry.date} ${entry.startTime}`, "yyyy-MM-dd HH:mm")
        entry.endDateTime = DateTime.fromFormat(`${entry.date} ${entry.endTime}`, "yyyy-MM-dd HH:mm").plus({ minute: 1 }).minus({ millisecond: 1 })
        entry.dayOfWeek = entry.startDateTime.toLocaleString({ weekday: 'long' });
        entry.monthName = entry.startDateTime.toLocaleString({ month: 'long' });
        entry.month = entry.startDateTime.month;
        entry.year = entry.startDateTime.year;
        if (["Saturday", "Sunday"].includes(entry.dayOfWeek)) {
          entry.timeOfDayBucket = "offPeak";
        } else if ((entry.startDateTime.hour >= 0 && entry.startDateTime.hour < 7) ||
          (entry.startDateTime.hour >= 21)) {
          entry.timeOfDayBucket = "offPeak";
        } else if (entry.startDateTime.hour >= 7 && entry.startDateTime.hour < 17) {
          entry.timeOfDayBucket = "midPeak";
        } else {
          entry.timeOfDayBucket = "onPeak";
        }
        if (i === 0 && entry.startDateTime.isValid) {
          this.dateRange.minDateTime = entry.startDateTime;
        }
        if (i === 0 && entry.endDateTime.isValid) {
          this.dateRange.maxDateTime = entry.endDateTime;
        }
        if (entry.startDateTime.isValid && entry.startDateTime < this.dateRange.minDateTime) {
          this.dateRange.minDateTime = entry.startDateTime;
        }
        if (entry.endDateTime.isValid && entry.endDateTime > this.dateRange.maxDateTime) {
          this.dateRange.maxDateTime = entry.endDateTime;
        }
      }

      //Set minimum and maximum month and year
      this.dateRange.minMonth = this.dateRange.minDateTime.month;
      this.dateRange.minYear = this.dateRange.minDateTime.year;
      this.dateRange.maxMonth = this.dateRange.maxDateTime.month;
      this.dateRange.maxYear = this.dateRange.maxDateTime.year;
    },
    processPricing() {
      this.processing = "Processing Pricing";
      let timeOfUseTotals = {
        category: "timeOfUse",
        sumKwhUsage: 0,
        kwhUsageCost: 0
      };

      for (let i = 0; i < Object.keys(this.pricing).length; i++) {
        let category = Object.keys(this.pricing)[i];
        let categoryData = category === "basic" ? this.historicalData : this.historicalData.filter(hd => hd.timeOfDayBucket === category);
        let totals = this.calculateKwhUsageTotals(category, categoryData);
        this.calculateMonthlyTotals(category, categoryData);

        this.timeOfDayBuckets.push(totals);

        if (category !== "basic") {
          timeOfUseTotals.sumKwhUsage += totals.sumKwhUsage;
          timeOfUseTotals.kwhUsageCost += totals.kwhUsageCost;
        }
      }

      this.timeOfDayBuckets.push(timeOfUseTotals);

      console.log(this.timeOfDayBuckets);

    },

    async processFiles(files) {
      this.processing = "Parsing CSV Files";
      this.historicalData = [];
      for (let i = 0; i < files.length; i++) {
        const csv = await this.parseFile(files[i]);
        const jsonArray = await csvtojson().fromString(csv);
        this.historicalData = this.historicalData.concat(jsonArray);
      }

      this.processData();

      this.processPricing();

      this.calculateBarChartData();

      this.processing = null;
    },
    calculateBarChartData() {
      let datasets = [];
      this.yearlyBuckets.forEach(yb => {
        ["offPeak", "midPeak", "onPeak"].forEach(p => {
          datasets.push({
            label: `${yb.year} ${p}`,
            data: yb.months.map(m => m[p].kwhUsageCost),
            stack: yb.year
          })
        })
      })
      this.monthlyBarChartData = {
        labels: Info.months(),
        datasets: datasets,
      }
    },
    calculateMonthlyTotals(category, data) {
      for (let i = this.dateRange.minYear; i <= this.dateRange.maxYear; i++) {
        let year = this.yearlyBuckets.find(yb => yb.year === i);
        if (!year) {
          year = { year: i, months: [] };
          this.yearlyBuckets.push(year)
        }
        for (let j = 1; j <= 12; j++) {
          let month = year.months.find(m => m.id === j)
          let monthName = Info.months()[j - 1];
          if (!month) {
            month = {
              id: j,
              name: monthName,
              basic: {},
              offPeak: {},
              midPeak: {},
              onPeak: {}
            }
            year.months.push(month);
          }
          let monthlyData = data.filter(d => d.year === i && d.monthName === monthName);
          month[category] = this.calculateKwhUsageTotals(category, monthlyData);
        }
      }
    },
    calculateKwhUsageTotals(category, data) {
      let pricing = this.pricing[category]
      let usageData = data.map(cd => cd.kwhUsage);
      let sumKwhUsage = 0;
      if (data.length) {
        sumKwhUsage = usageData.reduce(
          (accumulator, currentValue) => accumulator + currentValue
        );
      }
      let kwhUsageCost = sumKwhUsage * pricing;
      return {
        category,
        sumKwhUsage,
        kwhUsageCost,
      }
    }

    // increment() {
    //   this.counter++;
    // },
  },
});
