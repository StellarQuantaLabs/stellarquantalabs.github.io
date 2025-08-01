
document.addEventListener("DOMContentLoaded", async () => {
    const chartDiv = document.getElementById("chart");
    const gridDiv = document.getElementById("timeline-grid");

    const bandColors = {
        "VHF": "blue",
        "UHF": "red",
        "Secure": "green",
        "Surveillance": "purple"
    };

    async function fetchFileList() {
        const res = await fetch('timelines.json');
        return await res.json();
    }

    async function fetchPlotlyData(file) {
        const res = await fetch(file);
        const text = await res.text();
        const match = text.match(/Plotly\.newPlot\([^,]+,(.+),(.+)\);/s);
        if (!match) return null;
        try {
            const data = JSON.parse(match[1]);
            const layout = JSON.parse(match[2]);
            return {data, layout, file};
        } catch (e) {
            console.error("Error parsing Plotly JSON in", file, e);
            return null;
        }
    }

    async function buildChart(files) {
        const traces = [];
        for (const file of files) {
            const parsed = await fetchPlotlyData(file);
            if (!parsed) continue;
            parsed.data.forEach(trace => {
                trace.name = file.split("/").pop();
                trace.line = trace.line || {};
                trace.line.color = bandColors["VHF"]; // Placeholder - can refine based on trace meta
                traces.push(trace);
            });
        }
        Plotly.newPlot(chartDiv, traces, {
            title: "Cumulative SDR Timeline (UTC)",
            xaxis: { title: "Timestamp (UTC)" },
            yaxis: { title: "Power (dB)" },
            legend: { orientation: "h" }
        });
    }

    function buildGrid(files) {
        gridDiv.innerHTML = "";
        files.forEach(file => {
            const a = document.createElement("a");
            a.href = file;
            a.textContent = file.split("/").pop();
            a.target = "_blank";
            const div = document.createElement("div");
            div.className = "timeline-item";
            div.appendChild(a);
            gridDiv.appendChild(div);
        });
    }

    const timelineFiles = await fetchFileList();
    buildGrid(timelineFiles);
    await buildChart(timelineFiles);
});
