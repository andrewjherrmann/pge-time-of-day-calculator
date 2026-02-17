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

      const raw = this.historicalData;
      const processed = [];
      let minDateTime = null;
      let maxDateTime = null;

      for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        const date = row["DATE"];
        const startTime = row["START TIME"];
        const endTime = row["END TIME"];
        let kwhUsage = Number.parseFloat(row["USAGE (kWh)"]);
        if (Number.isNaN(kwhUsage)) kwhUsage = 0;

        const startDateTime = DateTime.fromFormat(`${date} ${startTime}`, "yyyy-MM-dd HH:mm");
        const endDateTime = DateTime.fromFormat(`${date} ${endTime}`, "yyyy-MM-dd HH:mm").plus({ minute: 1 }).minus({ millisecond: 1 });
        const dayOfWeek = startDateTime.toLocaleString({ weekday: 'long' });
        const monthName = startDateTime.toLocaleString({ month: 'long' });
        const month = startDateTime.month;
        const year = startDateTime.year;

        let timeOfDayBucket;
        if (["Saturday", "Sunday"].includes(dayOfWeek)) {
          timeOfDayBucket = "offPeak";
        } else if ((startDateTime.hour >= 0 && startDateTime.hour < 7) || startDateTime.hour >= 21) {
          timeOfDayBucket = "offPeak";
        } else if (startDateTime.hour >= 7 && startDateTime.hour < 17) {
          timeOfDayBucket = "midPeak";
        } else {
          timeOfDayBucket = "onPeak";
        }

        processed.push({
          date,
          startTime,
          endTime,
          kwhUsage,
          startDateTime,
          endDateTime,
          dayOfWeek,
          monthName,
          month,
          year,
          timeOfDayBucket,
        });

        if (startDateTime.isValid && (minDateTime === null || startDateTime < minDateTime)) {
          minDateTime = startDateTime;
        }
        if (endDateTime.isValid && (maxDateTime === null || endDateTime > maxDateTime)) {
          maxDateTime = endDateTime;
        }
      }

      this.historicalData = processed;
      this.dateRange.minDateTime = minDateTime;
      this.dateRange.maxDateTime = maxDateTime;
      this.dateRange.minMonth = minDateTime?.month ?? null;
      this.dateRange.minYear = minDateTime?.year ?? null;
      this.dateRange.maxMonth = maxDateTime?.month ?? null;
      this.dateRange.maxYear = maxDateTime?.year ?? null;
    },
    processPricing() {
      this.processing = "Processing Pricing";
      this.timeOfDayBuckets = [];
      this.yearlyBuckets = [];

      const dataByYearMonth = new Map();
      for (let i = 0; i < this.historicalData.length; i++) {
        const d = this.historicalData[i];
        const key = `${d.year}-${d.month}`;
        let arr = dataByYearMonth.get(key);
        if (!arr) {
          arr = [];
          dataByYearMonth.set(key, arr);
        }
        arr.push(d);
      }

      this._dataByYearMonth = dataByYearMonth;
      const timeOfUseTotals = {
        category: "timeOfUse",
        sumKwhUsage: 0,
        kwhUsageCost: 0
      };

      const categories = Object.keys(this.pricing);
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const categoryData = category === "basic" ? this.historicalData : this.historicalData.filter((hd) => hd.timeOfDayBucket === category);
        const totals = this.calculateKwhUsageTotals(category, categoryData);
        this.calculateMonthlyTotals(category, categoryData);
        this.timeOfDayBuckets.push(totals);

        if (category !== "basic") {
          timeOfUseTotals.sumKwhUsage += totals.sumKwhUsage;
          timeOfUseTotals.kwhUsageCost += totals.kwhUsageCost;
        }
      }

      this.timeOfDayBuckets.push(timeOfUseTotals);
      this._dataByYearMonth = null;
    },

    cleanFileString(csvString) {
      let headerIndex = csvString.indexOf("TYPE,DATE,START TIME,END TIME,USAGE (kWh),COST,NOTES");
      return csvString.substring(headerIndex);
    },

    async processFiles(files) {
      this.processing =   "Parsing CSV Files";
      this.historicalData = [];
      for (let i = 0; i < files.length; i++) {
        let csv = await this.parseFile(files[i]);
        csv = this.cleanFileString(csv);
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
          let monthlyData;
          if (this._dataByYearMonth) {
            const key = `${i}-${j}`;
            const monthData = this._dataByYearMonth.get(key) || [];
            monthlyData = category === "basic" ? monthData : monthData.filter((d) => d.timeOfDayBucket === category);
          } else {
            monthlyData = data.filter(d => d.year === i && d.monthName === monthName);
          }
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
