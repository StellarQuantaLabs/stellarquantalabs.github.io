document.addEventListener("DOMContentLoaded", async () => {
    const chartDiv = document.getElementById("chart");
    const gridDiv = document.getElementById("timeline-grid");

    // Band color mapping based on frequency
    const bandColors = {
        "VHF": "blue",         // 30–88 MHz
        "UHF": "red",          // 225–400 MHz
        "Secure": "green",     // 800–900 MHz
        "Surveillance": "purple" // 1.2–1.3 GHz
    };

    // Helper: determine band by frequency
    function pickBandColor(frequency) {
        if (frequency >= 30e6 && frequency <= 88e6) return bandColors["VHF"];
        if (frequency >= 225e6 && frequency <= 400e6) return bandColors["UHF"];
        if (frequency >= 800e6 && frequency <= 900e6) return bandColors["Secure"];
        if (frequency >= 1.2e9 && frequency <= 1.3e9) return bandColors["Surveillance"];
        return "gray"; // fallback if unknown
    }

    async function fetchFileList() {
        try {
            const res = await fetch('timelines.json');
            if (!res.ok) throw new Error(`Failed to load timelines.json: ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error("Error fetching file list:", e);
            return [];
        }
    }

    // Extract Plotly data from an HTML export
    async function fetchPlotlyData(file) {
        try {
            const res = await fetch(file);
            if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
            const text = await res.text();

            // Parse HTML to DOM
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const scriptTags = Array.from(doc.querySelectorAll('script'));

            // Find the script containing "Plotly.newPlot"
            const plotScript = scriptTags.find(tag => tag.textContent.includes('Plotly.newPlot'));
            if (!plotScript) throw new Error(`No Plotly script found in ${file}`);

            // Extract JSON objects from Plotly.newPlot(...) call
            const match = plotScript.textContent.match(/Plotly\.newPlot\([^,]+,(.+),(.+)\);/s);
            if (!match) throw new Error(`Unable to parse Plotly data in ${file}`);

            const data = JSON.parse(match[1]);
            const layout = JSON.parse(match[2]);

            return { data, layout, file };
        } catch (e) {
            console.error("Error parsing Plotly HTML for", file, e);
            return null;
        }
    }

    // Build the cumulative chart
    async function buildChart(files) {
        const traces = [];
        for (const file of files) {
            const parsed = await fetchPlotlyData(file);
            if (!parsed) continue;

            parsed.data.forEach(trace => {
                trace.name = file.split("/").pop();

                // Try to get frequency from trace name or metadata
                let freq = null;
                if (trace.name && trace.name.match(/\d+(\.\d+)?[MmGg][Hh][Zz]/)) {
                    const mhz = parseFloat(trace.name.match(/\d+(\.\d+)?/)[0]);
                    freq = mhz >= 1000 ? mhz * 1e6 : mhz * 1e6;
                } else if (trace.customdata && trace.customdata.length) {
                    freq = parseFloat(trace.customdata[0]) || null;
                }

                trace.line = trace.line || {};
                trace.line.color = pickBandColor(freq);
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

    // Build the grid of session links
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

    // Main load
    const timelineFiles = await fetchFileList();
    buildGrid(timelineFiles);
    await buildChart(timelineFiles);
});
