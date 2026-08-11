/* Minimal SVG chart helpers for the HNRP wireframes.
   Marks: 2px lines, >=8px markers, solid hairline axes, selective direct labels,
   hatched fill for the partial 2026 (YTD) period. */
const INK = '#333333', INK2 = '#6E7178', INK3 = '#8E9096', RULE = '#D5D8DA',
  TRACK = '#E6E8E9', ACC = '#009999';

const fmtM = v => v == null ? '–' : (v / 1e6).toFixed(v / 1e6 >= 100 ? 0 : 1) + 'M';
const fmtBn = v => v == null ? '–' : (v / 1e9).toFixed(2) + 'bn';
const fmtPct = v => v == null ? '–' : v.toFixed(v >= 10 ? 0 : 1) + '%';

function hatchDef(id, color) {
  return `<defs><pattern id="${id}" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
    <rect width="5" height="5" fill="#fff"/><line x1="0" y1="0" x2="0" y2="5" stroke="${color}" stroke-width="3"/>
  </pattern></defs>`;
}

/* Column chart. Last column hatched when ytd=true (partial period). */
function cols({ w, h, values, years, fmt = fmtM, color = ACC, ytd = true, label = true }) {
  const P = { t: 16, r: 8, b: 20, l: 8 };
  const iw = w - P.l - P.r, ih = h - P.t - P.b;
  const max = Math.max(...values.filter(v => v != null)) * 1.18;
  const bw = Math.min(46, iw / values.length - 14);
  const id = 'h' + Math.random().toString(36).slice(2, 8);
  let s = `<svg width="${w}" height="${h}">${hatchDef(id, color)}`;
  values.forEach((v, i) => {
    if (v == null) return;
    const cx = P.l + iw * (i + .5) / values.length;
    const bh = Math.max(1, ih * v / max);
    const y = P.t + ih - bh;
    const last = ytd && i === values.length - 1;
    s += `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${bh}" rx="3"
      fill="${last ? `url(#${id})` : color}" ${last ? `stroke="${color}" stroke-width="1"` : ''}/>`;
    if (label) s += `<text x="${cx}" y="${y - 5}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK}">${fmt(v)}</text>`;
    s += `<text x="${cx}" y="${h - 6}" text-anchor="middle" font-size="10" fill="${INK3}">${years[i]}${last ? ' YTD' : ''}</text>`;
  });
  s += `<line x1="${P.l}" y1="${P.t + ih}" x2="${w - P.r}" y2="${P.t + ih}" stroke="${RULE}" stroke-width="1"/>`;
  return s + '</svg>';
}

/* Multi-series line. series: [{name, values, emph}] — emph gets the accent, rest gray. */
function lines({ w, h, series, years, fmt = fmtPct, yMax, suffix = '' }) {
  const P = { t: 16, r: 44, b: 20, l: 30 };
  const iw = w - P.l - P.r, ih = h - P.t - P.b;
  const all = series.flatMap(s => s.values).filter(v => v != null);
  const max = yMax != null ? yMax : Math.max(...all) * 1.2;
  const X = i => P.l + iw * i / (years.length - 1);
  const Y = v => P.t + ih - ih * v / max;
  let s = `<svg width="${w}" height="${h}">`;
  [0, max / 2, max].forEach(g => {
    s += `<line x1="${P.l}" y1="${Y(g)}" x2="${P.l + iw}" y2="${Y(g)}" stroke="${g === 0 ? RULE : '#EFF1F2'}" stroke-width="1"/>`;
    s += `<text x="${P.l - 5}" y="${Y(g) + 3}" text-anchor="end" font-size="9" fill="${INK3}">${Math.round(g)}${suffix}</text>`;
  });
  years.forEach((y, i) => {
    s += `<text x="${X(i)}" y="${h - 6}" text-anchor="middle" font-size="10" fill="${INK3}">${y}${i === years.length - 1 ? ' YTD' : ''}</text>`;
  });
  series.forEach(se => {
    const c = se.emph ? (se.color || ACC) : INK3;
    const pts = se.values.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
    s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${c}"
      stroke-width="${se.emph ? 2.5 : 1.5}" stroke-linejoin="round" ${se.emph ? '' : 'stroke-dasharray="0"'}/>`;
    pts.forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="${se.emph ? 4.5 : 3.5}" fill="${c}" stroke="#fff" stroke-width="2"/>`; });
    const lv = se.values[se.values.length - 1];
    if (lv != null) s += `<text x="${X(years.length - 1) + 8}" y="${Y(lv) + 3.5}" font-size="11" font-weight="${se.emph ? 700 : 400}" fill="${se.emph ? INK : INK3}">${fmt(lv)}</text>`;
  });
  return s + '</svg>';
}

/* Push labels apart so none overlap, keeping their original order. */
function declash(ys, minGap) {
  const idx = ys.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(ys.length);
  let prev = -Infinity;
  for (const [y, i] of idx) {
    const v = Math.max(y, prev + minGap);
    out[i] = v; prev = v;
  }
  return out;
}

/* Slope chart — one line per country between two periods. */
function slope({ w, h, items, left = '2023', right = '2026', topN = 8 }) {
  const P = { t: 20, r: 74, b: 26, l: 128 };
  const iw = w - P.l - P.r, ih = h - P.t - P.b;
  const max = Math.max(...items.flatMap(d => [d.y2023, d.y2026])) * 1.05;
  const Y = v => P.t + ih - ih * v / max;
  const shown = items.slice(0, topN);
  const la = declash(shown.map(d => Y(d.y2023)), 13);
  const ra = declash(shown.map(d => Y(d.y2026)), 13);
  let s = `<svg width="${w}" height="${h}">`;
  s += `<text x="${P.l}" y="11" text-anchor="middle" font-size="10" font-weight="700" fill="${INK2}">${left}</text>`;
  s += `<text x="${P.l + iw}" y="11" text-anchor="middle" font-size="10" font-weight="700" fill="${INK2}">${right}</text>`;
  s += `<line x1="${P.l}" y1="${P.t}" x2="${P.l}" y2="${P.t + ih}" stroke="${RULE}"/>`;
  s += `<line x1="${P.l + iw}" y1="${P.t}" x2="${P.l + iw}" y2="${P.t + ih}" stroke="${RULE}"/>`;
  items.forEach(d => {
    if (shown.includes(d)) return;
    s += `<line x1="${P.l}" y1="${Y(d.y2023)}" x2="${P.l + iw}" y2="${Y(d.y2026)}" stroke="#DCDEE0" stroke-width="1"/>`;
    s += `<circle cx="${P.l}" cy="${Y(d.y2023)}" r="2.5" fill="#DCDEE0"/>`;
    s += `<circle cx="${P.l + iw}" cy="${Y(d.y2026)}" r="2.5" fill="#DCDEE0"/>`;
  });
  shown.forEach((d, k) => {
    s += `<line x1="${P.l}" y1="${Y(d.y2023)}" x2="${P.l + iw}" y2="${Y(d.y2026)}" stroke="${ACC}" stroke-width="2"/>`;
    s += `<circle cx="${P.l}" cy="${Y(d.y2023)}" r="4" fill="${ACC}" stroke="#fff" stroke-width="1.5"/>`;
    s += `<circle cx="${P.l + iw}" cy="${Y(d.y2026)}" r="4" fill="${ACC}" stroke="#fff" stroke-width="1.5"/>`;
    // leader line from the mark to its de-clashed label
    s += `<line x1="${P.l - 6}" y1="${Y(d.y2023)}" x2="${P.l - 11}" y2="${la[k]}" stroke="#C9CCCE" stroke-width="1"/>`;
    s += `<text x="${P.l - 14}" y="${la[k] + 3.5}" text-anchor="end" font-size="10" fill="${INK}">${d.name} <tspan font-weight="700">${d.y2023}%</tspan></text>`;
    s += `<line x1="${P.l + iw + 6}" y1="${Y(d.y2026)}" x2="${P.l + iw + 11}" y2="${ra[k]}" stroke="#C9CCCE" stroke-width="1"/>`;
    s += `<text x="${P.l + iw + 14}" y="${ra[k] + 3.5}" font-size="10" font-weight="700" fill="${INK}">${d.y2026}%</text>`;
  });
  return s + '</svg>';
}

function spark({ w = 92, h = 22, values, ytd = true }) {
  const vs = values.filter(v => v != null);
  const min = Math.min(...vs), max = Math.max(...vs);
  const X = i => 1 + (w - 2) * i / (values.length - 1);
  const Y = v => h - 2 - (h - 6) * (max === min ? .5 : (v - min) / (max - min));
  const pts = values.map((v, i) => [X(i), Y(v)]);
  let s = `<svg width="${w}" height="${h}">`;
  s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${INK3}" stroke-width="1.5"/>`;
  const last = pts[pts.length - 1];
  s += `<circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${ACC}" stroke="#fff" stroke-width="1.5"/>`;
  return s + '</svg>';
}

/* Grouped target-vs-reached columns for one sub-sector (small-multiple facet). */
function facet({ w, h, title, target, reached, years, color }) {
  const P = { t: 22, r: 6, b: 18, l: 6 };
  const iw = w - P.l - P.r, ih = h - P.t - P.b;
  const max = Math.max(...target.filter(Boolean)) * 1.1;
  const gw = iw / years.length, bw = Math.min(15, gw / 2 - 4);
  const id = 'f' + Math.random().toString(36).slice(2, 8);
  let s = `<svg width="${w}" height="${h}">${hatchDef(id, color)}`;
  s += `<text x="${P.l}" y="11" font-size="10.5" font-weight="700" fill="${INK}">${title}</text>`;
  years.forEach((y, i) => {
    const cx = P.l + gw * (i + .5);
    const last = i === years.length - 1;
    [[target[i], TRACK, -1], [reached[i], color, 1]].forEach(([v, c, side]) => {
      if (!v) return;
      const bh = Math.max(1, ih * v / max);
      s += `<rect x="${cx + side * 1 + (side < 0 ? -bw : 0)}" y="${P.t + ih - bh}" width="${bw}" height="${bh}" rx="2"
        fill="${c === color && last ? `url(#${id})` : c}" ${c === color && last ? `stroke="${color}" stroke-width="1"` : ''}/>`;
    });
    s += `<text x="${cx}" y="${h - 5}" text-anchor="middle" font-size="9" fill="${INK3}">'${String(y).slice(2)}</text>`;
  });
  s += `<line x1="${P.l}" y1="${P.t + ih}" x2="${w - P.r}" y2="${P.t + ih}" stroke="${RULE}"/>`;
  return s + '</svg>';
}

/* Index-to-100 comparison ("scissors"): every series starts at 100 in the base year,
   so two different-scaled measures share ONE axis. Never a dual axis. */
function scissors({ w, h, series, years }) {
  const P = { t: 18, r: 128, b: 20, l: 34 };
  const iw = w - P.l - P.r, ih = h - P.t - P.b;
  const all = series.flatMap(s => s.values);
  const max = Math.max(...all, 110) * 1.05, min = Math.min(...all, 0);
  const X = i => P.l + iw * i / (years.length - 1);
  const Y = v => P.t + ih - ih * (v - min) / (max - min);
  let s = `<svg width="${w}" height="${h}">`;
  [0, 50, 100].forEach(g => {
    s += `<line x1="${P.l}" y1="${Y(g)}" x2="${P.l + iw}" y2="${Y(g)}" stroke="${g === 100 ? RULE : '#EFF1F2'}" stroke-width="1"/>`;
    s += `<text x="${P.l - 5}" y="${Y(g) + 3}" text-anchor="end" font-size="9" fill="${INK3}">${g}</text>`;
  });
  years.forEach((y, i) => s += `<text x="${X(i)}" y="${h - 6}" text-anchor="middle" font-size="10" fill="${INK3}">${y}${i === years.length - 1 ? ' YTD' : ''}</text>`);
  series.forEach(se => {
    const pts = se.values.map((v, i) => [X(i), Y(v)]);
    s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${se.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    pts.forEach(p => s += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="${se.color}" stroke="#fff" stroke-width="2"/>`);
    const l = pts[pts.length - 1];
    s += `<text x="${l[0] + 8}" y="${l[1] + 3.5}" font-size="11" font-weight="700" fill="${se.color}">${Math.round(se.values[se.values.length - 1])}</text>`;
    s += `<text x="${l[0] + 8}" y="${l[1] + 15}" font-size="9" fill="${INK3}">${se.name}</text>`;
  });
  return s + '</svg>';
}
