"use strict";

const DATA_URL = "data/blinkit_sales.csv";
const PAGE_SIZE = 8;

const state = {
  rows: [],
  filtered: [],
  metric: "sales",
  page: 1,
  search: "",
};

const colors = {
  green: "#218b43",
  greenLight: "#79c86c",
  yellow: "#f8cb0f",
  yellowDark: "#dcae00",
  ink: "#252822",
  grid: "#e8eae3",
  muted: "#777b72",
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("en-IN");
const compactNumber = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const monthFormat = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift().map((header) => header.trim());
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
  );
}

function normalize(row) {
  return {
    ...row,
    order_date: new Date(`${row.order_date}T00:00:00`),
    outlet_establishment_year: Number(row.outlet_establishment_year),
    item_weight_kg: Number(row.item_weight_kg),
    item_visibility: Number(row.item_visibility),
    item_mrp: Number(row.item_mrp),
    units_sold: Number(row.units_sold),
    sales: Number(row.sales),
    rating: Number(row.rating),
  };
}

function groupBy(
  rows,
  key,
  valueAccessor = (row) => (state.metric === "sales" ? row.sales : row.units_sold),
) {
  return rows.reduce((accumulator, row) => {
    const label = typeof key === "function" ? key(row) : row[key];
    accumulator.set(label, (accumulator.get(label) || 0) + valueAccessor(row));
    return accumulator;
  }, new Map());
}

function sum(rows, accessor) {
  return rows.reduce((total, row) => total + accessor(row), 0);
}

function populateFilter(selector, values) {
  const select = $(selector);
  values.sort((a, b) => a.localeCompare(b)).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function setupFilters() {
  populateFilter("#location-filter", [...new Set(state.rows.map((row) => row.outlet_location_type))]);
  populateFilter("#outlet-type-filter", [...new Set(state.rows.map((row) => row.outlet_type))]);
  populateFilter("#size-filter", [...new Set(state.rows.map((row) => row.outlet_size))]);
  populateFilter("#category-filter", [...new Set(state.rows.map((row) => row.item_type))]);
  populateFilter("#customer-filter", [...new Set(state.rows.map((row) => row.customer_type))]);
}

function applyFilters() {
  const selections = {
    date: $("#date-filter").value,
    location: $("#location-filter").value,
    outletType: $("#outlet-type-filter").value,
    size: $("#size-filter").value,
    category: $("#category-filter").value,
    customer: $("#customer-filter").value,
  };
  const latestDate = state.rows.reduce(
    (latest, row) => (row.order_date > latest ? row.order_date : latest),
    state.rows[0]?.order_date,
  );
  const ninetyDaysAgo = new Date(latestDate);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);

  state.filtered = state.rows.filter((row) => {
    const year = row.order_date.getFullYear();
    const dateMatch =
      selections.date === "all" ||
      (selections.date === "2025" && year === 2025) ||
      (selections.date === "2024" && year === 2024) ||
      (selections.date === "q4-2025" && year === 2025 && row.order_date.getMonth() >= 9) ||
      (selections.date === "latest-90" && row.order_date >= ninetyDaysAgo);
    return (
      dateMatch &&
      (selections.location === "all" || row.outlet_location_type === selections.location) &&
      (selections.outletType === "all" || row.outlet_type === selections.outletType) &&
      (selections.size === "all" || row.outlet_size === selections.size) &&
      (selections.category === "all" || row.item_type === selections.category) &&
      (selections.customer === "all" || row.customer_type === selections.customer)
    );
  });
  state.page = 1;
  render();
}

function formatMetric(value, metric = state.metric) {
  return metric === "sales" ? currency.format(value) : number.format(Math.round(value));
}

function formatMetricCompact(value, metric = state.metric) {
  return metric === "sales" ? `₹${compactNumber.format(value)}` : compactNumber.format(value);
}

function renderKPIs() {
  const rows = state.filtered;
  const totalSales = sum(rows, (row) => row.sales);
  const totalUnits = sum(rows, (row) => row.units_sold);
  const averageRating = rows.length ? sum(rows, (row) => row.rating) / rows.length : 0;
  $("#kpi-sales").textContent = currency.format(totalSales);
  $("#kpi-orders").textContent = number.format(rows.length);
  $("#kpi-units").textContent = number.format(totalUnits);
  $("#kpi-aov").textContent = rows.length ? currency.format(totalSales / rows.length) : "₹0";
  $("#kpi-rating").textContent = averageRating.toFixed(2);
  $("#kpi-units-context").textContent = rows.length
    ? `${(totalUnits / rows.length).toFixed(2)} per order`
    : "Items in basket";

  const activeFilters = [
    $("#date-filter"),
    $("#location-filter"),
    $("#outlet-type-filter"),
    $("#size-filter"),
    $("#category-filter"),
    $("#customer-filter"),
  ].filter((select) => select.value !== "all");
  $("#filter-summary").textContent = activeFilters.length
    ? `${number.format(rows.length)} transactions match ${activeFilters.length} active filter${activeFilters.length === 1 ? "" : "s"}.`
    : `${number.format(rows.length)} synthetic transactions across ${new Set(rows.map((row) => row.outlet_id)).size} outlets provide the complete portfolio view.`;
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, width: rect.width, height: rect.height };
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function renderTrend() {
  const canvas = $("#trend-chart");
  const { ctx, width, height } = prepareCanvas(canvas);
  const grouped = groupBy(
    state.filtered,
    (row) => `${row.order_date.getFullYear()}-${String(row.order_date.getMonth() + 1).padStart(2, "0")}`,
  );
  const entries = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return drawEmpty(ctx, width, height);

  const padding = { top: 16, right: 16, bottom: 34, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...entries.map(([, value]) => value)) * 1.12;

  ctx.font = '10px "DM Sans", sans-serif';
  ctx.fillStyle = colors.muted;
  ctx.textAlign = "right";
  for (let index = 0; index <= 4; index += 1) {
    const value = (maxValue * (4 - index)) / 4;
    const y = padding.top + (plotHeight * index) / 4;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(formatMetricCompact(value), padding.left - 8, y + 3);
  }

  const points = entries.map(([key, value], index) => ({
    key,
    value,
    x: padding.left + (index * plotWidth) / Math.max(1, entries.length - 1),
    y: padding.top + plotHeight - (value / maxValue) * plotHeight,
  }));
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, "rgba(33, 139, 67, 0.24)");
  gradient.addColorStop(1, "rgba(33, 139, 67, 0.00)");
  ctx.beginPath();
  points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
  ctx.lineTo(points.at(-1).x, height - padding.bottom);
  ctx.lineTo(points[0].x, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = colors.green;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = colors.muted;
  const labelEvery = Math.max(1, Math.ceil(entries.length / 8));
  points.forEach((point, index) => {
    if (index % labelEvery === 0 || index === entries.length - 1) {
      const [year, month] = point.key.split("-").map(Number);
      ctx.fillText(monthFormat.format(new Date(year, month - 1, 1)), point.x, height - 10);
    }
  });

  canvas._points = points;
  const first = entries[0][1];
  const last = entries.at(-1)[1];
  const change = first ? ((last - first) / first) * 100 : 0;
  $("#trend-insight").textContent = `${change >= 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(1)}% first to latest month`;
  $("#trend-insight").style.color = change >= 0 ? colors.green : "#a54135";
}

function renderFatChart() {
  const canvas = $("#fat-chart");
  const { ctx, width, height } = prepareCanvas(canvas);
  const grouped = [...groupBy(state.filtered, "item_fat_content").entries()].sort((a, b) => b[1] - a[1]);
  const total = sum(grouped, (entry) => entry[1]);
  if (!grouped.length || !total) return drawEmpty(ctx, width, height);
  const palette = [colors.green, colors.yellow, colors.ink, colors.greenLight];
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.39;
  let angle = -Math.PI / 2;
  grouped.forEach(([label, value], index) => {
    const slice = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle, angle + slice);
    ctx.lineWidth = Math.max(20, radius * 0.28);
    ctx.strokeStyle = palette[index % palette.length];
    ctx.stroke();
    angle += slice;
  });
  $("#donut-total-label").textContent = state.metric === "sales" ? "Sales" : "Units";
  $("#donut-total").textContent = formatMetricCompact(total);
  $("#fat-legend").innerHTML = grouped
    .map(
      ([label, value], index) => `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${palette[index % palette.length]}"></span>
          <strong>${escapeHTML(label)}</strong>
          <span>${((value / total) * 100).toFixed(1)}% · ${formatMetricCompact(value)}</span>
        </div>`,
    )
    .join("");
}

function renderCategories() {
  const canvas = $("#category-chart");
  const { ctx, width, height } = prepareCanvas(canvas);
  const entries = [...groupBy(state.filtered, "item_type").entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (!entries.length) return drawEmpty(ctx, width, height);
  const maxValue = entries[0][1];
  const labelWidth = Math.min(145, width * 0.34);
  const valueWidth = 50;
  const gap = 8;
  const rowHeight = height / entries.length;
  const barX = labelWidth;
  const barWidth = width - labelWidth - valueWidth - 8;
  ctx.font = '10px "DM Sans", sans-serif';
  entries.forEach(([label, value], index) => {
    const y = index * rowHeight + rowHeight * 0.25;
    const h = Math.max(9, rowHeight * 0.42);
    ctx.fillStyle = colors.ink;
    ctx.textAlign = "left";
    const truncated = label.length > 21 ? `${label.slice(0, 19)}…` : label;
    ctx.fillText(truncated, 0, y + h * 0.72);
    ctx.fillStyle = "#eef0e9";
    roundRect(ctx, barX, y, barWidth, h, h / 2);
    ctx.fill();
    ctx.fillStyle = index === 0 ? colors.yellowDark : colors.green;
    roundRect(ctx, barX, y, Math.max(gap, (value / maxValue) * barWidth), h, h / 2);
    ctx.fill();
    ctx.fillStyle = colors.muted;
    ctx.textAlign = "right";
    ctx.fillText(formatMetricCompact(value), width, y + h * 0.72);
  });
}

function renderTiers() {
  const grouped = [...groupBy(state.filtered, "outlet_location_type").entries()].sort((a, b) => b[1] - a[1]);
  const total = sum(grouped, (entry) => entry[1]);
  $("#tier-list").innerHTML = grouped.length
    ? grouped
        .map(([label, value]) => {
          const percent = total ? (value / total) * 100 : 0;
          return `
            <div class="tier-row">
              <div class="tier-label"><strong>${escapeHTML(label)}</strong><span>location</span></div>
              <div class="tier-track"><div class="tier-fill" style="width:${percent.toFixed(1)}%"></div></div>
              <div class="tier-value"><strong>${formatMetricCompact(value)}</strong><span>${percent.toFixed(1)}% share</span></div>
            </div>`;
        })
        .join("")
    : '<p class="panel-note">No records match the filters.</p>';
}

function renderOutlets() {
  const grouped = new Map();
  state.filtered.forEach((row) => {
    const current = grouped.get(row.outlet_type) || { sales: 0, units: 0, orders: 0, rating: 0 };
    current.sales += row.sales;
    current.units += row.units_sold;
    current.orders += 1;
    current.rating += row.rating;
    grouped.set(row.outlet_type, current);
  });
  const rows = [...grouped.entries()].sort((a, b) => b[1][state.metric] - a[1][state.metric]);
  $("#outlet-table-body").innerHTML = rows.length
    ? rows
        .map(
          ([label, metrics], index) => `
            <tr>
              <td><div class="outlet-type-cell"><span class="outlet-rank">${index + 1}</span>${escapeHTML(label)}</div></td>
              <td>${currency.format(metrics.sales)}</td>
              <td>${number.format(metrics.orders)}</td>
              <td>${(metrics.rating / metrics.orders).toFixed(2)} ★</td>
            </tr>`,
        )
        .join("")
    : '<tr><td colspan="4">No records match the filters.</td></tr>';
}

function filteredTableRows() {
  const query = state.search.trim().toLowerCase();
  if (!query) return state.filtered;
  return state.filtered.filter((row) =>
    [row.order_id, row.item_id, row.item_type, row.outlet_id, row.customer_type]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

function renderTable() {
  const matches = filteredTableRows();
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  $("#transactions-body").innerHTML = visible.length
    ? visible
        .map(
          (row) => `
            <tr>
              <td>${dateFormat.format(row.order_date)}</td>
              <td><span class="order-id">${escapeHTML(row.order_id)}</span></td>
              <td>${escapeHTML(row.item_type)}</td>
              <td>${escapeHTML(row.outlet_id)} · ${escapeHTML(row.outlet_location_type)}</td>
              <td><span class="badge">${escapeHTML(row.customer_type)}</span></td>
              <td class="align-right">${number.format(row.units_sold)}</td>
              <td class="align-right">${currency.format(row.sales)}</td>
              <td class="align-right">${row.rating.toFixed(1)} ★</td>
            </tr>`,
        )
        .join("")
    : '<tr><td colspan="8">No matching transactions.</td></tr>';
  $("#table-count").textContent = matches.length
    ? `Showing ${number.format(start + 1)}–${number.format(Math.min(start + PAGE_SIZE, matches.length))} of ${number.format(matches.length)}`
    : "0 matching transactions";
  $("#page-label").textContent = `Page ${state.page} of ${totalPages}`;
  $("#prev-page").disabled = state.page <= 1;
  $("#next-page").disabled = state.page >= totalPages;
}

function drawEmpty(ctx, width, height) {
  ctx.fillStyle = colors.muted;
  ctx.font = '12px "DM Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("No data for the selected filters", width / 2, height / 2);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  renderKPIs();
  renderTrend();
  renderFatChart();
  renderCategories();
  renderTiers();
  renderOutlets();
  renderTable();
}

function exportView() {
  if (!state.filtered.length) return;
  const headers = [
    "order_id",
    "order_date",
    "outlet_id",
    "outlet_location_type",
    "outlet_size",
    "outlet_type",
    "item_id",
    "item_type",
    "units_sold",
    "sales",
    "rating",
    "customer_type",
  ];
  const lines = [headers.join(",")].concat(
    state.filtered.map((row) =>
      headers
        .map((header) => {
          const value = header === "order_date" ? row.order_date.toISOString().slice(0, 10) : row[header];
          return `"${String(value).replaceAll('"', '""')}"`;
        })
        .join(","),
    ),
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "blinkit_filtered_view.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function attachInteractions() {
  $$("#filters-form select").forEach((select) => select.addEventListener("change", applyFilters));
  $("#reset-filters").addEventListener("click", () => {
    $("#filters-form").reset();
    applyFilters();
  });
  $$(".metric-option").forEach((button) => {
    button.addEventListener("click", () => {
      state.metric = button.dataset.metric;
      $$(".metric-option").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });
  $("#table-search").addEventListener("input", (event) => {
    state.search = event.target.value;
    state.page = 1;
    renderTable();
  });
  $("#prev-page").addEventListener("click", () => {
    state.page -= 1;
    renderTable();
  });
  $("#next-page").addEventListener("click", () => {
    state.page += 1;
    renderTable();
  });
  $("#export-data").addEventListener("click", exportView);

  const sidebar = $("#filter-panel");
  const overlay = $("#sidebar-overlay");
  const closeSidebar = () => {
    sidebar.classList.remove("open");
    overlay.hidden = true;
  };
  $("#open-filters").addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.hidden = false;
  });
  $("#close-filters").addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);

  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 120);
  });

  $("#trend-chart").addEventListener("mousemove", (event) => {
    const canvas = event.currentTarget;
    const points = canvas._points || [];
    if (!points.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const nearest = points.reduce((best, point) =>
      Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best,
    );
    const [year, month] = nearest.key.split("-").map(Number);
    const tooltip = $("#trend-tooltip");
    tooltip.innerHTML = `<strong>${monthFormat.format(new Date(year, month - 1, 1))}</strong><br>${formatMetric(nearest.value)}`;
    tooltip.hidden = false;
    tooltip.style.left = `${nearest.x}px`;
    tooltip.style.top = `${nearest.y}px`;
  });
  $("#trend-chart").addEventListener("mouseleave", () => {
    $("#trend-tooltip").hidden = true;
  });
}

async function initialize() {
  attachInteractions();
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Dataset request returned ${response.status}`);
    const parsed = parseCSV(await response.text());
    state.rows = parsed.map(normalize);
    state.filtered = [...state.rows];
    setupFilters();
    const latest = state.rows.reduce((current, row) => (row.order_date > current ? row.order_date : current), state.rows[0].order_date);
    $("#data-through").textContent = dateFormat.format(latest);
    $("#loading-banner").hidden = true;
    $("#export-data").disabled = false;
    render();
  } catch (error) {
    $("#loading-banner").hidden = true;
    const errorBanner = $("#error-banner");
    errorBanner.hidden = false;
    errorBanner.innerHTML =
      "The dashboard could not load the CSV. Start a local server in this folder (for example <code>python -m http.server 8000</code>) and open <code>http://localhost:8000</code>.";
    console.error(error);
  }
}

initialize();
