document.addEventListener("DOMContentLoaded", async () => {
    const chartDiv = document.getElementById("chart");
    const gridDiv = document.getElementById("timeline-grid");

    const bandColors = {
        "VHF": "blue",         // 30–88 MHz
        "UHF": "red",          // 225–400 MHz
        "Secure": "green",     // 800–900 MHz
        "Surveillance": "purple" // 1.2–1.3 GHz
    };

    function pickBandColor(frequency) {
        if (!frequency) return "gray";
        if (frequency >= 30e6 && frequency <= 88e6) return bandColors["VHF"];
        if (frequency >= 225e6 && frequency <= 400e6) return bandColors["UHF"];
        if (frequency >= 800e6 && frequency <= 900e6) return bandColors["Secure"];
        if (frequency >= 1.2e9 && frequency <= 1.3e9) return bandColors["Surveillance"];
        return "gray";
    }

    function showError(message) {
        chartDiv.innerHTML = `<div style="color:red; font-weight:bold; padding:20px;">${message}</div>`;
        console.error(message);
    }

    async function fetchFileList() {
        try {
            const res = await fetch('timelines.json');
            if (!res.ok) throw new Error(`Failed to load timelines.json: ${res.status}`);
            return await res.json();
        } catch (e) {
            showError("Error loading timelines.json — check that it exists and is valid JSON.");
            return [];
        }
    }

    async function fetchPlotlyData(file) {
        try {
            const res = await fetch(file);
            if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
            const text = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const scriptTags = Array.from(doc.querySelectorAll('script'));

            // Try multiple extraction patterns
            let data = null, layout = null;

            // Pattern 1: Standard Plotly.newPlot(...) call
            const plotScript = scriptTags.find(tag => tag.textContent.includes('Plotly.newPlot') || tag.textContent.includes('Plotly.react'));
            if (plotScript) {
                const match = plotScript.textContent.match(/Plotly\.(?:newPlot|react)\([^,]+,(.+),(.+)\);/s);
                if (match) {
                    data = JSON.parse(match[1]);
                    layout = JSON.parse(match[2]);
                }
            }

            // Pattern 2: window.PLOTLYENV or embedded JSON figure
            if (!data) {
                const figureScript = scriptTags.find(tag => tag.textContent.includes('PLOTLYENV') || tag.textContent.includes('data') && tag.textContent.includes('layout'));
                if (figureScript) {
                    const jsonMatch = figureScript.textContent.match(/({\s*"data":.+?"layout":.+?})/s);
                    if (jsonMatch) {
                        const fig = JSON.parse(jsonMatch[1]);
                        data = fig.data;
                        layout = fig.layout;
                    }
                }
            }

            if (!data || !layout) throw new Error(`Could not parse Plotly figure data in ${file}`);

            return { data, layout, file };
        } catch (e) {
            console.error("Error parsing", file, e);
            return null;
        }
    }

    async function buildChart(files) {
        const traces = [];
        for (const file of files) {
            const parsed = await fetchPlotlyData(file);
            if (!parsed) {
                console.warn(`Skipping ${file} (failed to parse).`);
                continue;
            }

            parsed.data.forEach(trace => {
                trace.name = file.split("/").pop();
                let freq = null;

                // Infer frequency from trace name or customdata
                if (trace.name && trace.name.match(/\d+(\.\d+)?[MmGg][Hh][Zz]/)) {
                    const mhz = parseFloat(trace.name.match(/\d+(\.\d+)?/)[0]);
                    freq = mhz * 1e6;
                } else if (trace.customdata && trace.customdata.length) {
                    freq = parseFloat(trace.customdata[0]) || null;
                }

                trace.line = trace.line || {};
                trace.line.color = pickBandColor(freq);
                traces.push(trace);
            });
        }

        if (traces.length === 0) {
            showError("No valid timeline data loaded — check your timeline files and JSON manifest.");
            return;
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
        if (files.length === 0) {
            gridDiv.innerHTML = "<p style='color:red;'>No timeline files listed in timelines.json</p>";
            return;
        }
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


