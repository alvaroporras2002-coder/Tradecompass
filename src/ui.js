import { icons } from './icons.js';
export const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${icons[name] || icons.compass}</svg>`;

// Axis labels remain HTML so their text size stays readable on a phone.
export function curve(points, { height = 235, id = 'equity', money, date } = {}) {
  const values = points.map(point => Number(point.value ?? point));
  if (values.length < 2 || values.some(value => !Number.isFinite(value))) return '<div class="empty-chart">—</div>';
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const padding = (maximum - minimum || Math.max(Math.abs(maximum) * .01, 1)) * .12;
  const low = minimum - padding, high = maximum + padding, range = high - low;
  const width = 800, inset = 10;
  const coordinates = values.map((value, index) => [index / (values.length - 1) * width, inset + (1 - (value - low) / range) * (height - inset * 2)]);
  const line = coordinates.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(' ');
  const format = value => money ? money(value) : new Intl.NumberFormat(undefined, {maximumFractionDigits:0}).format(value);
  const ticks = [high, high - range / 3, high - range * 2 / 3, low];
  const labels = [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)].map(point => date ? date(point.date) : String(point.date || '').slice(0, 10));
  const endpoint = coordinates.at(-1);
  const description = `${format(values[0])} → ${format(values.at(-1))}`;
  return `<div class="performance-chart"><div class="chart-y-axis">${ticks.map(value => `<span>${esc(new Intl.NumberFormat(undefined, {notation:'compact',maximumFractionDigits:1}).format(value))}</span>`).join('')}</div><svg class="equity-chart" style="--chart-height:${height}px" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${esc(description)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#65D99A" stop-opacity=".3"/><stop offset="1" stop-color="#65D99A" stop-opacity=".015"/></linearGradient></defs>${[0, 1, 2, 3].map(index => `<path d="M0 ${inset + index * (height - inset * 2) / 3}H${width}" stroke="#35413e" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}${[0, 1, 2, 3, 4].map(index => `<path d="M${index * width / 4} 0V${height}" stroke="#2b3432" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}<path d="${line} L${width},${height} L0,${height}Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="#65D99A" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="${endpoint[0]}" cy="${endpoint[1]}" rx="5" ry="4" fill="#C1FF5E"/></svg></div><div class="chart-labels">${labels.map(label => `<span>${esc(label)}</span>`).join('')}</div>`;
}
