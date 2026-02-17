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
      offPeak: 0.0908,
      midPeak: 0.1699,
      onPeak: 0.4389
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
      const monthNames = Info.months();
      let minTs = Number.POSITIVE_INFINITY;
      let maxTs = Number.NEGATIVE_INFINITY;

      for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        const date = row["DATE"];
        const startTime = row["START TIME"];
        const endTime = row["END TIME"];
        let kwhUsage = Number.parseFloat(row["USAGE (kWh)"]);
        if (Number.isNaN(kwhUsage)) kwhUsage = 0;
        const costStr = row["COST"];
        const cost = costStr != null && costStr !== '' ? Number.parseFloat(String(costStr).replace(/[$,]/g, '')) : 0;
        const actualCost = Number.isNaN(cost) ? 0 : cost;

        const startStr = `${date} ${startTime}`;
        const endStr = `${date} ${endTime}`;
        const startDate = new Date(startStr);
        const endDate = new Date(endStr);
        const startTs = startDate.getTime();
        const endTs = endDate.getTime();

        if (Number.isNaN(startTs)) continue;

        const month = startDate.getMonth() + 1;
        const year = startDate.getFullYear();
        const monthName = monthNames[month - 1];
        const day = startDate.getDay();
        const hour = startDate.getHours();

        let timeOfDayBucket;
        const isWeekend = day === 0 || day === 6;
        if (isWeekend) timeOfDayBucket = "offPeak";
        else if (hour < 7 || hour >= 21) timeOfDayBucket = "offPeak";
        else if (hour < 17) timeOfDayBucket = "midPeak";
        else timeOfDayBucket = "onPeak";

        processed.push({
          date,
          startTime,
          endTime,
          kwhUsage,
          actualCost,
          month,
          year,
          monthName,
          timeOfDayBucket,
        });

        if (startTs < minTs) minTs = startTs;
        if (!Number.isNaN(endTs) && endTs > maxTs) maxTs = endTs;
      }

      this.historicalData = processed;
      this.dateRange.minDateTime = Number.isFinite(minTs) ? DateTime.fromMillis(minTs) : null;
      this.dateRange.maxDateTime = Number.isFinite(maxTs) ? DateTime.fromMillis(maxTs) : null;
      this.dateRange.minMonth = this.dateRange.minDateTime?.month ?? null;
      this.dateRange.minYear = this.dateRange.minDateTime?.year ?? null;
      this.dateRange.maxMonth = this.dateRange.maxDateTime?.month ?? null;
      this.dateRange.maxYear = this.dateRange.maxDateTime?.year ?? null;
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
      const sumKwhUsage = data.length
        ? data.reduce((acc, d) => acc + (d.kwhUsage || 0), 0)
        : 0;
      const pricing = this.pricing[category];
      let kwhUsageCost;
      if (category === "basic") {
        const sumActualCost = data.reduce((acc, d) => acc + (d.actualCost || 0), 0);
        kwhUsageCost = sumActualCost > 0 ? sumActualCost : sumKwhUsage * pricing;
      } else {
        kwhUsageCost = sumKwhUsage * pricing;
      }
      return {
        category,
        sumKwhUsage,
        kwhUsageCost,
      };
    }

    // increment() {
    //   this.counter++;
    // },
  },
});
