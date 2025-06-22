export class DataManager {
    constructor(chart) {
        this.chart = chart;
        this.data = [];
    }

    setData(data) {
        this.data = data.filter(d => {
            const date = new Date(d.time);
            return d.time && !isNaN(date.getTime()) && !isNaN(d.open) && !isNaN(d.high) && !isNaN(d.low) && !isNaN(d.close);
        });
        this.chart.render();
    }

    async loadDataFromCSV(url) {
        try {
            const response = await fetch(url);
            const csvText = await response.text();
            const rows = csvText.split('\n').map(row => row.split(','));
            const headers = rows[0];
            const data = rows.slice(1).map(row => ({
                time: row[0],
                open: parseFloat(row[1]),
                high: parseFloat(row[2]),
                low: parseFloat(row[3]),
                close: parseFloat(row[4]),
            })).filter(row => row.time && !isNaN(row.close));
            this.setData(data);
        } catch (e) {
            console.error('Failed to load CSV:', e);
        }
    }
}