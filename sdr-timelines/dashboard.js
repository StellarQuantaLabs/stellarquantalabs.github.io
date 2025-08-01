// JS for dashboard
document.addEventListener("DOMContentLoaded", () => {
    let chartDiv = document.getElementById("chart");
    Plotly.newPlot(chartDiv, [], {title: "Cumulative SDR Timeline (UTC)"});
    document.getElementById("timeline-grid").innerHTML = "<p>No timelines uploaded yet.</p>";
});
