import * as d3 from "d3";

// ── Load & filter for Winter season ─────────────────────────────────────────
const athletes = await d3.csv("data/athlete_events.csv", d3.autoType)
	.then(rows => rows.filter(d => d.Season === "Winter" && d.Sport !== "Alpinism"));

const city_country = await d3.json("data/city_to_country.json");
console.log(athletes);
console.log(city_country);


// ── Medal-counting helper ─────────────────────────────────────────────────────
/** Count unique event podium places (Year-Event-Medal) in a row array. */
function countMedals(rows) {
	return new Set(rows.map(d => `${d.Year}-${d.Event}-${d.Medal}`)).size;
}

// ── 1. Inject CSS ────────────────────────────────────────────────────────────
const styleEl = document.createElement("style");
styleEl.textContent = `
  #scatter-section { margin: 1.5rem 0 2rem; }
  #scatter-section h3 { font-size: 1.8rem; font-weight: 400; margin: 0 0 .25rem; }
  .scatter-subtitle { font-size: .85rem; color: #666; margin: 0 0 .6rem; font-style: italic; }

  #scatter-tooltip {
    position: absolute; pointer-events: none;
    background: rgba(255,255,255,.97);
    border: 1px solid #ccc; border-radius: 6px;
    padding: 8px 12px; font-size: .8rem; line-height: 1.55;
    box-shadow: 0 4px 14px rgba(0,0,0,.13);
    max-width: 230px; opacity: 0;
    transition: opacity .12s ease; z-index: 9999;
  }

  #scatter-svg .axis path, #scatter-svg .axis line { stroke: #ddd; }
  #scatter-svg .axis text { fill: #555; font-size: 11px; }
  #scatter-svg .axis-label { fill: #444; font-size: 12px; font-weight: 500; }

  #scatter-svg .legend-item { cursor: pointer; }
  #scatter-svg .legend-item text { font-size: 11px; fill: #333; }
  #scatter-svg .legend-title { font-size: 11.5px; font-weight: 600; fill: #444; }

  #scatter-svg .brush .selection { fill: rgba(100,120,220,.12); stroke: #667eea; stroke-width: 1.5; }
  #scatter-svg .brush .handle { fill: #667eea; }
  #scatter-svg .hint { fill: #aaa; font-size: 10px; font-style: italic; }
`;
document.head.appendChild(styleEl);

// ── 2. Create DOM section ────────────────────────────────────────────────────
const main = document.querySelector("main");
const section = document.createElement("section");
section.id = "scatter-section";
section.innerHTML = `
  <h3>Q1 · Do bodily attributes affect success?</h3>
  <p class="scatter-subtitle">
    Each dot = one athlete in one sport &nbsp;·&nbsp;
    Dot size = medals won &nbsp;·&nbsp;
    Colour = sport &nbsp;·&nbsp;
    <strong>Click sport legend</strong> to highlight &nbsp;·&nbsp;
    <strong>Drag</strong> to zoom &nbsp;·&nbsp;
    <strong>Dbl-click</strong> to reset
  </p>
`;
const h2 = main.querySelector("h2");
h2.insertAdjacentElement("afterend", section);

// ── 4. Aggregate data — any medal winner, Height & Weight required ────────────
const byKey = new Map();
for (const d of athletes) {
	if (d.Height == null || d.Weight == null) continue;          // drop rows with missing body data
	if (d.Weight < 40 || d.Weight > 200) continue;              // filter implausible weights
	if (d.Height < 130 || d.Height > 230) continue;             // filter implausible heights
	if (d.Medal == null) continue;                               // drop rows with no medal
	const sport = d.Sport;
	const key = `${d.ID}-${sport}`;
	if (!byKey.has(key)) {
		byKey.set(key, { name: d.Name, sex: d.Sex, height: d.Height, weight: d.Weight, sport: sport, noc: d.NOC, medals: 0 });
	}
	byKey.get(key).medals += 1;
}
const data = Array.from(byKey.values());

const topSports = Array.from(d3.rollup(data, v => v.length, d => d.sport))
	.sort((a, b) => b[1] - a[1])
	.map(([s]) => s);

// ── 5. Layout & Setup ─────────────────────────────────────────────────────────
const MARGIN = { top: 60, right: 20, bottom: 60, left: 60 };
const W = 460;
const H = 480;
const IW = W - MARGIN.left - MARGIN.right;
const IH = H - MARGIN.top - MARGIN.bottom;

const xExt = d3.extent(data, d => d.weight);
const yExt = d3.extent(data, d => d.height);

const xScale = d3.scaleLinear().domain(xExt).nice().range([0, IW]);
const yScale = d3.scaleLinear().domain(yExt).nice().range([IH, 0]);

const colorScale = d3.scaleOrdinal().domain(topSports)
	.range(d3.schemeTableau10.concat(d3.schemePastel1));

const rScale = d3.scaleSqrt()
	.domain([0, d3.max(data, d => d.medals)])
	.range([3, 12]);

// Container for side-by-side plots
const scatterContainer = d3.select(section).append("div")
	.style("display", "flex")
	.style("flex-wrap", "wrap")
	.style("gap", "20px")
	.style("justify-content", "center");

// Tooltip
const tooltip = d3.select("body").append("div").attr("id", "scatter-tooltip");
let selectedSport = null;

const plots = [];

function buildScatter(container, title, plotData) {
	const svg = container.append("svg")
		.attr("class", "scatter-svg")
		.attr("viewBox", `0 0 ${W} ${H}`)
		.attr("preserveAspectRatio", "xMidYMid meet")
		.style("width", "100%")
		.style("max-width", "460px")
		.style("height", "auto")
		.style("overflow", "visible");

	const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

	// Title
	svg.append("text")
		.attr("x", W / 2)
		.attr("y", 30)
		.attr("text-anchor", "middle")
		.style("font-size", "15px")
		.style("font-weight", "600")
		.style("fill", "#333")
		.text(title);

	const clipId = `clip-${title.replace(/\s+/g, '-')}`;
	svg.append("defs").append("clipPath").attr("id", clipId)
		.append("rect").attr("width", IW).attr("height", IH);

	// Axes
	const xAxis = d3.axisBottom(xScale).ticks(6);
	const yAxis = d3.axisLeft(yScale).ticks(6);

	const xAxisG = g.append("g").attr("class", "axis x-axis")
		.attr("transform", `translate(0,${IH})`).call(xAxis);
	const yAxisG = g.append("g").attr("class", "axis y-axis").call(yAxis);

	g.append("text").attr("class", "axis-label")
		.attr("x", IW / 2).attr("y", IH + 40).attr("text-anchor", "middle")
		.text("Weight (kg)");
	g.append("text").attr("class", "axis-label")
		.attr("transform", "rotate(-90)").attr("x", -IH / 2).attr("y", -40)
		.attr("text-anchor", "middle").text("Height (cm)");

	// Dots
	const dotsG = g.append("g").attr("class", "dots").attr("clip-path", `url(#${clipId})`);
	
	const dots = dotsG.selectAll("circle")
		.data(plotData).join("circle")
		.attr("cx", d => xScale(d.weight))
		.attr("cy", d => yScale(d.height))
		.attr("r", d => rScale(d.medals))
		.attr("fill", d => colorScale(d.sport))
		.attr("fill-opacity", 0.65) 
		.attr("stroke", "rgba(255,255,255,.8)")
		.attr("stroke-width", 1)
		.style("cursor", "default");

	dots.on("mouseenter", function (event, d) {
			tooltip
				.html(`<strong>${d.name}</strong><br/>
				       Sport: ${d.sport}<br/>
				       Height: ${d.height} cm &nbsp;|&nbsp; Weight: ${d.weight} kg<br/>
				       🏅 Medals: ${d.medals}<br/>
				       NOC: ${d.noc} &nbsp;|&nbsp; Sex: ${d.sex}`)
				.style("opacity", 1)
				.style("left", `${event.pageX + 12}px`)
				.style("top", `${event.pageY - 28}px`);
			d3.select(this).raise().attr("stroke", "#333").attr("stroke-width", 2).attr("fill-opacity", 1);
		})
		.on("mousemove", function (event) {
			tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
		})
		.on("mouseleave", function (_, d) {
			tooltip.style("opacity", 0);
			d3.select(this)
				.attr("stroke", "rgba(255,255,255,.8)")
				.attr("stroke-width", 1)
				.attr("fill-opacity", selectedSport ? (d.sport === selectedSport ? 0.85 : 0.07) : 0.65);
		});

	const update = () => {
		xAxisG.transition().duration(400).call(xAxis);
		yAxisG.transition().duration(400).call(yAxis);
		dots.transition().duration(400)
			.attr("cx", d => xScale(d.weight))
			.attr("cy", d => yScale(d.height));
	};

	// Brush
	const brush = d3.brush()
		.extent([[0, 0], [IW, IH]])
		.on("end", function (event) {
			if (!event.selection) return;
			const [[x0, y0], [x1, y1]] = event.selection;
			xScale.domain([xScale.invert(x0), xScale.invert(x1)]);
			yScale.domain([yScale.invert(y1), yScale.invert(y0)]);
			
			// Update BOTH plots to keep scales coordinated
			plots.forEach(p => p.update());
			
			brushG.call(brush.move, null);
		});

	const brushG = g.append("g").attr("class", "brush").call(brush);

	svg.on("dblclick", () => {
		xScale.domain(xExt).nice();
		yScale.domain(yExt).nice();
		plots.forEach(p => p.update());
	});

	// Hint text
	svg.append("text").attr("class", "hint")
		.attr("x", MARGIN.left).attr("y", H - 4)
		.text("Drag to zoom · Dbl-click to reset");

	plots.push({ update, dots });
}

// Separate data by Gender
const maleData = data.filter(d => d.sex === "M");
const femaleData = data.filter(d => d.sex === "F");

buildScatter(scatterContainer, "Men", maleData);
buildScatter(scatterContainer, "Women", femaleData);

// ── 6. Shared Legends ─────────────────────────────────────────────────────────
const legendContainer = d3.select(section).append("div")
	.style("margin-top", "30px")
	.style("display", "flex")
	.style("flex-wrap", "wrap")
	.style("gap", "40px")
	.style("justify-content", "center")
	.style("padding", "0 20px");

// Sport color legend
const sportLegSvg = legendContainer.append("svg")
	.attr("width", 560)
	.attr("height", Math.ceil(topSports.length / 4) * 24 + 30)
	.style("overflow", "visible");

const legendG = sportLegSvg.append("g").attr("id", "scatter-svg"); // reuse css for text
legendG.append("text").attr("class", "legend-title").attr("y", 12).text("Sport (click to filter)");

const legendItems = legendG.selectAll(".legend-item")
	.data(topSports).join("g")
	.attr("class", "legend-item")
	.attr("transform", (_, i) => `translate(${(i % 4) * 140}, ${Math.floor(i / 4) * 24 + 26})`);

legendItems.append("rect").attr("class", "leg-swatch")
	.attr("width", 13).attr("height", 13).attr("rx", 2)
	.attr("fill", d => colorScale(d));

legendItems.append("text").attr("x", 19).attr("y", 11).text(d => d).style("font-size", "11px");

legendItems.on("click", function (_, sport) {
	if (selectedSport === sport) {
		selectedSport = null;
		plots.forEach(p => p.dots.attr("fill-opacity", 0.65));
		legendItems.select(".leg-swatch").attr("stroke", "none").attr("stroke-width", 0);
		d3.selectAll(".hm-axis-x text").style("font-weight", "normal").style("fill", null);
	} else {
		selectedSport = sport;
		plots.forEach(p => {
			p.dots.attr("fill-opacity", d => d.sport === sport ? 0.85 : 0.07);
		});
		legendItems.select(".leg-swatch")
			.attr("stroke", s => s === sport ? "#333" : "none")
			.attr("stroke-width", s => s === sport ? 2 : 0);
		d3.selectAll(".hm-axis-x text")
			.style("font-weight", s => s === sport ? "bold" : "normal")
			.style("fill", s => s === sport ? "#000" : null);
	}
});

// Medal size legend
const sizeLegSvg = legendContainer.append("svg")
	.attr("width", 200)
	.attr("height", 80)
	.style("overflow", "visible")
	.attr("id", "scatter-svg");

const sizeG = sizeLegSvg.append("g");
sizeG.append("text").attr("class", "legend-title").attr("y", 12).text("🏅 Medals won");

[1, 2, 4, 7].forEach((v, i) => {
	sizeG.append("circle")
		.attr("cx", 20 + i * 40).attr("cy", 40).attr("r", rScale(v))
		.attr("fill", "#f5c518").attr("fill-opacity", .6)
		.attr("stroke", "#fff").attr("stroke-width", 1);
	sizeG.append("text")
		.attr("x", 20 + i * 40).attr("y", 65)
		.attr("text-anchor", "middle")
		.attr("font-size", "11px").attr("fill", "#555")
		.text(v === 7 ? "7+" : String(v));
});

// ════════════════════════════════════════════════════════════════════════════════
// Q3: GENDER DISTRIBUTION STACKED BAR CHART
// ════════════════════════════════════════════════════════════════════════════════

// ── 1. Create DOM section ──────────────────────────────────────────────────
const sbSection = document.createElement("section");
sbSection.id = "stacked-section";
sbSection.innerHTML = `
  <h3 style="margin-top: 4rem;">Q3 · Are certain sports more popular for men or women in certain teams?</h3>
  <p class="scatter-subtitle">
    <strong>Click a team</strong> on the left to filter &nbsp;·&nbsp;
    Hover bars for details
  </p>
  <div id="sb-container" style="display: flex; gap: 30px; margin-top: 1.5rem; justify-content: center;">
    <div id="sb-teams"></div>
    <div id="sb-chart"></div>
  </div>
`;
section.insertAdjacentElement("afterend", sbSection);

// ── 2. Data Preparation ────────────────────────────────────────────────────
// Deduplicate athletes by ID + Year + Sport so we count participation per Games
const uniqueAthletes = new Map();
for (const d of athletes) {
	const sport = d.Sport;
	const key = `${d.ID}-${d.Year}-${sport}`;
	if (!uniqueAthletes.has(key)) {
		uniqueAthletes.set(key, { noc: d.NOC, sport: sport, sex: d.Sex });
	}
}
const partData = Array.from(uniqueAthletes.values());

// Count participants per team
const teamCounts = d3.rollups(partData, v => v.length, d => d.noc)
	.sort((a, b) => b[1] - a[1]);
const top15Teams = teamCounts.slice(0, 15).map(d => d[0]);

const allSports = Array.from(new Set(partData.map(d => d.sport))).sort();

// Tooltip for stacked bars
const sbTooltip = d3.select("body").append("div").attr("id", "scatter-tooltip");

// ── 3. Team Selector (Bar Chart) ─────────────────────────────────────────
const tMargin = { top: 30, right: 20, bottom: 20, left: 40 };
const tW = 180 - tMargin.left - tMargin.right;
const tH = 380 - tMargin.top - tMargin.bottom;

const tSvg = d3.select("#sb-teams").append("svg")
	.attr("width", tW + tMargin.left + tMargin.right)
	.attr("height", tH + tMargin.top + tMargin.bottom)
	.append("g").attr("transform", `translate(${tMargin.left},${tMargin.top})`);

tSvg.append("text").attr("x", -20).attr("y", -15).style("font-weight", "600").style("font-size", "14px").text("Top 15 Teams");

const tYScale = d3.scaleBand().domain(top15Teams).range([0, tH]).padding(0.2);
const tXScale = d3.scaleLinear().domain([0, teamCounts[0][1]]).range([0, tW]);

let activeTeam = "USA"; // default

const tBars = tSvg.selectAll(".team-bar")
	.data(teamCounts.slice(0, 15)).join("g")
	.attr("class", "team-bar")
	.attr("transform", d => `translate(0,${tYScale(d[0])})`)
	.style("cursor", "pointer");

tBars.append("rect")
	.attr("width", d => Math.max(2, tXScale(d[1])))
	.attr("height", tYScale.bandwidth())
	.attr("fill", d => d[0] === activeTeam ? "#667eea" : "#ddd")
	.attr("rx", 2);

tBars.append("text")
	.attr("x", -8).attr("y", tYScale.bandwidth() / 2 + 4)
	.attr("text-anchor", "end").style("font-size", "11px").style("fill", "#333")
	.text(d => d[0]);

// ── 4. Stacked Bar Chart ─────────────────────────────────────────────────
const sMargin = { top: 30, right: 100, bottom: 90, left: 40 };
const sW = 680 - sMargin.left - sMargin.right;
const sH = 380 - sMargin.top - sMargin.bottom;

const sSvg = d3.select("#sb-chart").append("svg")
	.attr("width", sW + sMargin.left + sMargin.right)
	.attr("height", sH + sMargin.top + sMargin.bottom)
	.append("g").attr("transform", `translate(${sMargin.left},${sMargin.top})`);

const sTitle = sSvg.append("text").attr("x", sW/2).attr("y", -15)
	.attr("text-anchor", "middle").style("font-weight", "600").style("font-size", "14px");

const sXScale = d3.scaleBand().domain(allSports).range([0, sW]).padding(0.3);
const sYScale = d3.scaleLinear().range([sH, 0]);

const sexColors = d3.scaleOrdinal().domain(["M", "F"]).range(["#4c9aff", "#ff6b8b"]);

const sXAxis = sSvg.append("g").attr("transform", `translate(0,${sH})`);
const sYAxis = sSvg.append("g");

sXAxis.call(d3.axisBottom(sXScale)).selectAll("text")
	.attr("transform", "rotate(-45)").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em");

const stackG = sSvg.append("g");

function updateStackedChart(team) {
	activeTeam = team;
	sTitle.text(`Gender Split in Sports for ${team}`);
	
	// Update team bars
	tBars.select("rect").transition().duration(200).attr("fill", d => d[0] === activeTeam ? "#667eea" : "#ddd");

	// Filter data
	const tData = partData.filter(d => d.noc === team);
	
	// Aggregate by sport -> M/F
	const aggregated = allSports.map(sport => {
		const sData = tData.filter(d => d.sport === sport);
		return {
			sport,
			M: sData.filter(d => d.sex === "M").length,
			F: sData.filter(d => d.sex === "F").length
		};
	});

	// Update Y scale
	const maxCount = d3.max(aggregated, d => d.M + d.F);
	sYScale.domain([0, maxCount || 10]).nice();
	sYAxis.transition().duration(400).call(d3.axisLeft(sYScale));

	// Stack data
	const stack = d3.stack().keys(["M", "F"]);
	const stackedData = stack(aggregated);

	// Render
	stackG.selectAll("g.layer")
		.data(stackedData, d => d.key)
		.join(
			enter => enter.append("g").attr("class", "layer").attr("fill", d => sexColors(d.key)),
			update => update,
			exit => exit.remove()
		)
		.selectAll("rect")
		.data(d => d, d => d.data.sport)
		.join("rect")
		.on("mouseenter", function (event, d) {
			const key = d3.select(this.parentNode).datum().key;
			const count = d.data[key];
			sbTooltip.html(`<strong>${d.data.sport}</strong><br/>${key === "M" ? "Men" : "Women"}: ${count} athletes`)
				.style("opacity", 1).style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 20}px`);
			d3.select(this).attr("opacity", 0.7);
		})
		.on("mousemove", event => sbTooltip.style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 20}px`))
		.on("mouseleave", function () {
			sbTooltip.style("opacity", 0);
			d3.select(this).attr("opacity", 1);
		})
		.transition().duration(400)
		.attr("x", d => sXScale(d.data.sport))
		.attr("y", d => sYScale(d[1]))
		.attr("height", d => sYScale(d[0]) - sYScale(d[1]))
		.attr("width", sXScale.bandwidth());
}

tBars.on("click", (_, d) => updateStackedChart(d[0]));
updateStackedChart("USA");

// Legend for Gender
const gLeg = sSvg.append("g").attr("transform", `translate(${sW + 20}, 20)`);
gLeg.append("text").attr("y", -5).style("font-weight", "600").style("font-size", "12px").text("Gender");
["M", "F"].forEach((sex, i) => {
	gLeg.append("rect").attr("y", i * 20).attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", sexColors(sex));
	gLeg.append("text").attr("x", 18).attr("y", i * 20 + 10).style("font-size", "11px").text(sex === "M" ? "Men" : "Women");
});


// ════════════════════════════════════════════════════════════════════════════════
// HEATMAP  –  Q2 · Which teams dominate which sports?
// ════════════════════════════════════════════════════════════════════════════════

// ── HM-1. Inject heatmap CSS ──────────────────────────────────────────────────
const hmStyleEl = document.createElement("style");
hmStyleEl.textContent = `
  #heatmap-section { margin: 2rem 0; }
  #heatmap-section h3 { font-size: 1.8rem; font-weight: 400; margin: 0 0 .25rem; }
  .heatmap-subtitle { font-size: .85rem; color: #666; margin: 0 0 .6rem; font-style: italic; }

  #heatmap-tooltip {
    position: absolute; pointer-events: none;
    background: rgba(255,255,255,.97);
    border: 1px solid #ccc; border-radius: 6px;
    padding: 8px 12px; font-size: .8rem; line-height: 1.55;
    box-shadow: 0 4px 14px rgba(0,0,0,.13);
    max-width: 230px; opacity: 0;
    transition: opacity .12s ease; z-index: 9999;
  }

  #heatmap-svg .hm-axis path, #heatmap-svg .hm-axis line { stroke: #ddd; }
  #heatmap-svg .hm-axis text { fill: #555; font-size: 11px; }
  #heatmap-svg .hm-axis-label { fill: #444; font-size: 12px; font-weight: 500; }
`;
document.head.appendChild(hmStyleEl);

// ── HM-2. Inject DOM section ──────────────────────────────────────────────────
const hmSection = document.createElement("section");
hmSection.id = "heatmap-section";
hmSection.innerHTML = `
  <h3>Q2 · Which teams dominate which sports?</h3>
  <p class="heatmap-subtitle">
    Top 30 NOCs by total medals &nbsp;·&nbsp;
    Colour = share of that sport's all-time best (normalised per sport) &nbsp;·&nbsp;
    <strong>Hover</strong> for detail
  </p>
  <div id="heatmap-container"></div>
`;
// Insert after the scatter section
section.insertAdjacentElement("afterend", hmSection);

// ── HM-3. Clean data — remap "Military Ski Patrol" → "Biathlon" ──────────────
const hmAthletes = athletes.map(d =>
	d.Sport === "Military Ski Patrol" ? { ...d, Sport: "Biathlon" } : d
);

// ── HM-4. Build medal-count rollup ───────────────────────────────────────────
const hmTeamMedalCounts = d3.rollups(
	hmAthletes.filter(d => d.Medal !== null),
	v => countMedals(v),
	d => d.NOC
);

// Top 30 teams
const hmTopTeams = hmTeamMedalCounts
	.sort((a, b) => b[1] - a[1])
	.slice(0, 30)
	.map(d => d[0]);

// All sports present in the (cleaned) dataset
const hmDistinctSports = [...new Set(hmAthletes.map(d => d.Sport))];

// Build flat heatmap data array — one cell per (team × sport) pair
const hmData = [];
hmTopTeams.forEach(team => {
	hmDistinctSports.forEach(sport => {
		const cellRows = hmAthletes.filter(
			d => d.NOC === team && d.Sport === sport && d.Medal !== null
		);
		hmData.push({ team, sport, value: countMedals(cellRows) });
	});
});

// ── HM-5. Normalise per-sport ─────────────────────────────────────────────────
const hmGlobalMaxPerSport = d3.rollup(
	hmAthletes.filter(d => d.Medal !== null),
	v => {
		const nocCounts = d3.rollups(v, g => countMedals(g), d => d.NOC);
		return d3.max(nocCounts, d => d[1]);
	},
	d => d.Sport
);

// ── HM-6. Sort axes ───────────────────────────────────────────────────────────
const hmTeamScores = hmTopTeams.map(team => {
	const cells = hmData.filter(d => d.team === team);
	const avg = d3.mean(cells, d => {
		const mx = hmGlobalMaxPerSport.get(d.sport);
		return mx > 0 ? d.value / mx : 0;
	});
	return { team, score: avg };
});
const hmSortedTeams = hmTeamScores.sort((a, b) => b.score - a.score).map(d => d.team);

const hmSortedSports = [...hmDistinctSports].sort((a, b) => {
	const sumA = d3.sum(hmData.filter(d => d.sport === a), d => d.value);
	const sumB = d3.sum(hmData.filter(d => d.sport === b), d => d.value);
	return sumB - sumA;
});

// ── HM-7. Layout & scales ─────────────────────────────────────────────────────
const hmMargin = { top: 50, right: 120, bottom: 160, left: 80 };
const hmWidth  = 860 - hmMargin.left - hmMargin.right;
const hmHeight = 620 - hmMargin.top  - hmMargin.bottom;

const hmXScale = d3.scaleBand().domain(hmSortedSports).range([0, hmWidth]).padding(0.05);
const hmYScale = d3.scaleBand().domain(hmSortedTeams).range([0, hmHeight]).padding(0.05);
const hmColorScale = d3.scaleSequential().interpolator(d3.interpolatePurples).domain([0, 1]);

// ── HM-8. SVG ─────────────────────────────────────────────────────────────────
const hmSvg = d3.select("#heatmap-container").append("svg")
	.attr("id", "heatmap-svg")
	.attr("viewBox", `0 0 ${hmWidth + hmMargin.left + hmMargin.right} ${hmHeight + hmMargin.top + hmMargin.bottom}`)
	.attr("preserveAspectRatio", "xMidYMid meet")
	.style("width", "100%").style("height", "auto").style("overflow", "visible")
	.append("g").attr("transform", `translate(${hmMargin.left},${hmMargin.top})`);

// ── HM-9. Cells ───────────────────────────────────────────────────────────────
const hmTooltip = d3.select("body").append("div").attr("id", "heatmap-tooltip");

hmSvg.selectAll("rect.hm-cell")
	.data(hmData).join("rect")
	.attr("class", "hm-cell")
	.attr("x", d => hmXScale(d.sport))
	.attr("y", d => hmYScale(d.team))
	.attr("width", hmXScale.bandwidth())
	.attr("height", hmYScale.bandwidth())
	.attr("fill", d => {
		if (d.value === 0) return "#f0f0f0";
		const mx = hmGlobalMaxPerSport.get(d.sport);
		return hmColorScale(mx > 0 ? d.value / mx : 0);
	})
	.attr("stroke", "white").attr("stroke-width", 1).style("cursor", "default")
	.on("mouseenter", function (event, d) {
		const mx = hmGlobalMaxPerSport.get(d.sport) ?? 0;
		const pct = mx > 0 ? ((d.value / mx) * 100).toFixed(1) : "0.0";
		hmTooltip
			.html(`<strong>${d.team}</strong> – ${d.sport}<br/>
			       Medals: <strong>${d.value}</strong><br/>
			       Dominance: <strong>${pct}%</strong> of sport's best`)
			.style("opacity", 1)
			.style("left", `${event.pageX + 12}px`)
			.style("top",  `${event.pageY - 28}px`);
		d3.select(this).attr("stroke", "#333").attr("stroke-width", 2);
	})
	.on("mousemove", function (event) {
		hmTooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
	})
	.on("mouseleave", function () {
		hmTooltip.style("opacity", 0);
		d3.select(this).attr("stroke", "white").attr("stroke-width", 1);
	});

// ── HM-10. Axes ───────────────────────────────────────────────────────────────
const hmXAxis = hmSvg.append("g").attr("class", "hm-axis hm-axis-x")
	.attr("transform", `translate(0,${hmHeight})`)
	.call(d3.axisBottom(hmXScale));

hmXAxis.selectAll("text")
	.attr("transform", "rotate(-45)").style("text-anchor", "end")
	.attr("dx", "-.8em").attr("dy", ".15em")
	.style("cursor", "pointer")
	.on("click", function(_, sport) {
		if (selectedSport === sport) {
			selectedSport = null;
			plots.forEach(p => p.dots.attr("fill-opacity", 0.65));
			legendItems.select(".leg-swatch").attr("stroke", "none").attr("stroke-width", 0);
			hmXAxis.selectAll("text").style("font-weight", "normal").style("fill", null);
		} else {
			selectedSport = sport;
			plots.forEach(p => {
				p.dots.attr("fill-opacity", d => d.sport === sport ? 0.85 : 0.07);
			});
			legendItems.select(".leg-swatch")
				.attr("stroke", s => s === sport ? "#333" : "none")
				.attr("stroke-width", s => s === sport ? 2 : 0);
			hmXAxis.selectAll("text")
				.style("font-weight", s => s === sport ? "bold" : "normal")
				.style("fill", s => s === sport ? "#000" : null);
		}
	});

hmSvg.append("g").attr("class", "hm-axis").call(d3.axisLeft(hmYScale));

// ── HM-11. Colour legend ──────────────────────────────────────────────────────
const hmDefs = hmSvg.append("defs");
const hmGradient = hmDefs.append("linearGradient")
	.attr("id", "hm-linear-gradient")
	.attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%");

hmGradient.append("stop").attr("offset", "0%").attr("stop-color", hmColorScale.interpolator()(0));
hmGradient.append("stop").attr("offset", "100%").attr("stop-color", hmColorScale.interpolator()(1));

const hmLegendG = hmSvg.append("g").attr("transform", `translate(${hmWidth + 20}, 0)`);
hmLegendG.append("rect").attr("width", 20).attr("height", hmHeight).style("fill", "url(#hm-linear-gradient)");

const hmLegendScale = d3.scaleLinear().domain(hmColorScale.domain()).range([hmHeight, 0]);
hmLegendG.append("g").attr("transform", "translate(20, 0)")
	.call(d3.axisRight(hmLegendScale).ticks(5).tickFormat(d3.format(".0%")));

hmLegendG.append("text").attr("class", "hm-axis-label")
	.attr("transform", "rotate(90)").attr("x", hmHeight / 2).attr("y", -55)
	.attr("text-anchor", "middle").text("Dominance (% of sport's all-time best)");
