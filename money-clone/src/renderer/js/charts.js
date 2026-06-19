// Minimal, dependency-free SVG chart rendering for donut and bar charts.

function renderDonut(container, data, total) {
  const size = 200;
  const radius = 80;
  const innerRadius = 50;
  const cx = size / 2;
  const cy = size / 2;

  if (!total || total <= 0) {
    container.innerHTML = '';
    return;
  }

  let cumulativeAngle = -Math.PI / 2; // start at top
  const paths = data.map((row, i) => {
    const fraction = row.total / total;
    const angle = fraction * Math.PI * 2;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const ix1 = cx + innerRadius * Math.cos(endAngle);
    const iy1 = cy + innerRadius * Math.sin(endAngle);
    const ix2 = cx + innerRadius * Math.cos(startAngle);
    const iy2 = cy + innerRadius * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const color = window.fmt.CHART_COLORS[i % window.fmt.CHART_COLORS.length];

    // Full-circle edge case (single category = 100%): draw two half-arcs to avoid a degenerate path.
    if (fraction >= 0.9999) {
      return `<circle cx="${cx}" cy="${cy}" r="${(radius + innerRadius) / 2}" fill="none" stroke="${color}" stroke-width="${radius - innerRadius}" />`;
    }

    return `<path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z" fill="${color}" />`;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" width="100%" height="220" style="max-width: 220px; display:block; margin: 0 auto;">
      ${paths.join('')}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" fill="var(--color-text-muted)" font-family="var(--font-body)">Total</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--color-text-primary)" font-family="var(--font-mono)">${window.fmt.currency(total).replace('.00', '')}</text>
    </svg>
  `;
}

function renderBarChart(container, data, { keys, colors, height = 240 } = {}) {
  if (!data.length) { container.innerHTML = ''; return; }

  const padding = { top: 10, right: 10, bottom: 28, left: 56 };
  const width = Math.max(container.clientWidth || 600, 300);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(1, ...data.flatMap(d => keys.map(k => d[k] || 0)));
  const barGroupWidth = chartW / data.length;
  const barWidth = (barGroupWidth * 0.6) / keys.length;

  const yTicks = 4;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = (maxVal / yTicks) * i;
    const y = padding.top + chartH - (val / maxVal) * chartH;
    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--color-border)" stroke-width="1" />
      <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--color-text-muted)" font-family="var(--font-mono)">${Math.round(val)}</text>
    `;
  }).join('');

  const bars = data.map((d, di) => {
    const groupX = padding.left + di * barGroupWidth + barGroupWidth * 0.2;
    const barsHtml = keys.map((key, ki) => {
      const val = d[key] || 0;
      const barH = (val / maxVal) * chartH;
      const x = groupX + ki * barWidth;
      const y = padding.top + chartH - barH;
      return `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${Math.max(barH, 0)}" fill="${colors[ki]}" rx="2" />`;
    }).join('');
    const labelX = groupX + (barWidth * keys.length) / 2;
    return `${barsHtml}<text x="${labelX}" y="${height - 8}" text-anchor="middle" font-size="10" fill="var(--color-text-muted)" font-family="var(--font-body)">${window.fmt.escapeHtml(d.label || '')}</text>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
      ${gridLines}
      ${bars}
    </svg>
  `;
}

function renderLineChart(container, data, { key, color = 'var(--color-accent)', height = 220 } = {}) {
  if (!data.length) { container.innerHTML = ''; return; }

  const padding = { top: 14, right: 16, bottom: 28, left: 64 };
  const width = Math.max(container.clientWidth || 600, 300);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map(d => d[key] || 0);
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const range = (maxVal - minVal) || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padding.top + chartH - ((d[key] - minVal) / range) * chartH;
    return { x, y, label: d.label, value: d[key] };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const zeroY = padding.top + chartH - ((0 - minVal) / range) * chartH;

  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const labels = points
    .filter((_, i) => i % labelStep === 0 || i === points.length - 1)
    .map(p => `<text x="${p.x}" y="${height - 8}" text-anchor="middle" font-size="10" fill="var(--color-text-muted)" font-family="var(--font-body)">${window.fmt.escapeHtml(p.label || '')}</text>`)
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
      <line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="var(--color-border-strong)" stroke-width="1" />
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" />
      ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}"><title>${window.fmt.escapeHtml(p.label)}: ${window.fmt.signedCurrency(p.value)}</title></circle>`).join('')}
      ${labels}
    </svg>
  `;
}

window.charts = { renderDonut, renderBarChart, renderLineChart };
