// ═══════════════════════════════════════════════════════════════
//  RENDER  –  Sunburst-Zeichnung und Interaktion (D3, global über CDN)
//
//  Farben kommen ausschliesslich aus der Palette des Themes und aus
//  CSS-Variablen (siehe css/app.css), nie fest aus dem Code.
// ═══════════════════════════════════════════════════════════════

const d3 = window.d3;

// ═══════════════════════════════════════════════════════════════
//  BESCHRIFTUNG  –  Label-Parameter pro Ring-Tiefe (1 = innen)
//
//  fontSize:  Schriftgrösse in px (im viewBox, siehe LAYOUT_CONFIG.diagramSize)
//  weight:    Schriftstärke (600 = halbfett, 700 = fett); fett bleibt auch
//             klein gut lesbar
//  minArcPx:  minimale Bogenlänge in px, damit ein Label gezeichnet wird
//             → sollte mindestens fontSize sein, sonst berühren sich Labels
//  padding:   Abstand des Textes zu den Ringkanten (radial), in px
//
//  Die Schrift kommt aus der CSS-Variable --font-label des Themes. Gekürzt
//  wird nach der gemessenen Textbreite, nicht nach Zeichenzahl.
// ═══════════════════════════════════════════════════════════════
export const LABEL_CONFIG = {
  1: { fontSize: 16, weight: 700, minArcPx: 20, padding: 8 },
  2: { fontSize: 15, weight: 600, minArcPx: 17, padding: 8 },
  3: { fontSize: 14, weight: 600, minArcPx: 15, padding: 8 },
};

// ═══════════════════════════════════════════════════════════════
//  LAYOUT  –  Diagrammgrösse und Ringbreiten (px im viewBox)
//
//  diagramSize:   Gesamtgrösse des SVG
//  centerRadius:  Radius des leeren Kreises in der Mitte
//  gap:           Abstand zwischen den Ringen
//  area.ring1end / ring2end: äussere Kanten der Ringe in der Bereichs-Ansicht
//  type.ring1end: äussere Kante von Ring 1 in der Typ-Ansicht
//  Der äusserste Ring füllt jeweils den Rest.
// ═══════════════════════════════════════════════════════════════
export const LAYOUT_CONFIG = {
  diagramSize:  1000,
  centerRadius: 75,
  gap:          6,
  area: { ring1end: 195, ring2end: 330 },
  type: { ring1end: 230 },
};

const RADIUS = LAYOUT_CONFIG.diagramSize / 2;

const KIND_LABELS = {
  area: 'Bereich',
  list: 'Aktivität',
  task: 'Aufgabe',
  type: 'Aufgabentyp',
  more: 'Weitere Aufgaben',
};

// ── Ring-Geometrie ───────────────────────────────────────────
function getRings(mode, depth) {
  const c = LAYOUT_CONFIG;
  const end = RADIUS - 10;
  const bands = mode === 'area'
    ? [
        { inner: c.centerRadius,            outer: c.area.ring1end },
        { inner: c.area.ring1end + c.gap,   outer: c.area.ring2end },
        { inner: c.area.ring2end + c.gap,   outer: end },
      ]
    : [
        { inner: c.centerRadius,            outer: c.type.ring1end },
        { inner: c.type.ring1end + c.gap,   outer: end },
      ];
  return bands[depth - 1] ?? bands[0];
}

// ── Farben ───────────────────────────────────────────────────
export function baseColor(colorIndex, theme) {
  if (colorIndex === null || colorIndex === undefined) return theme.neutralColor;
  return theme.palette[colorIndex % theme.palette.length];
}

function nodeColor(d, theme) {
  let top = d;
  while (top.depth > 1) top = top.parent;
  const base = d3.color(baseColor(top.data.colorIndex, theme));
  const steps = [0, 0.65, 1.2];
  const k = steps[d.depth - 1] ?? 1.2;
  return (theme.ringShade === 'darker' ? base.darker(k * 0.8) : base.brighter(k)).toString();
}

// ── Beschriftung ─────────────────────────────────────────────
const labelCfg = depth => LABEL_CONFIG[depth] ?? LABEL_CONFIG[3];
const measureCtx = document.createElement('canvas').getContext('2d');

function labelFontFamily() {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-label').trim() || 'sans-serif';
}

// Längster Anfang von `text` (mit „…“), der in maxPx passt
function fitText(text, maxPx, font) {
  measureCtx.font = font;
  if (measureCtx.measureText(text).width <= maxPx) return text;
  let lo = 0;
  let hi = text.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measureCtx.measureText(text.slice(0, mid).trimEnd() + '…').width <= maxPx) lo = mid;
    else hi = mid - 1;
  }
  return lo >= 2 ? text.slice(0, lo).trimEnd() + '…' : '';
}

// Text läuft radial (vom Zentrum nach aussen) — die verfügbare Textlänge ist
// daher die Ringbreite. Die Bogenlänge entscheidet nur, ob das Segment breit
// genug für ein Label ist.
function fitLabel(d, mode, family) {
  const ring = getRings(mode, d.depth);
  const cfg = labelCfg(d.depth);
  const arcPx = (d.x1 - d.x0) * (ring.inner + ring.outer) / 2;
  if (arcPx < cfg.minArcPx) return '';
  const radialPx = (ring.outer - ring.inner) - 2 * cfg.padding;
  return fitText(d.data.name, radialPx, `${cfg.weight} ${cfg.fontSize}px ${family}`);
}

// Löst auf, sobald die Label-Schrift geladen ist (danach neu zeichnen,
// damit die Kürzung mit der echten Schrift gemessen wird)
export function labelFontReady() {
  if (!document.fonts?.load) return Promise.resolve();
  const family = labelFontFamily();
  const weights = [...new Set(Object.values(LABEL_CONFIG).map(c => c.weight))];
  return Promise.all(weights.map(w => document.fonts.load(`${w} 16px ${family}`))).catch(() => {});
}

function labelRotation(d) {
  const mid = (d.x0 + d.x1) / 2;
  let deg = mid * 180 / Math.PI - 90;
  if (mid > Math.PI) deg += 180;   // linke Seite drehen, damit lesbar
  return deg;
}

function isToggleable(d) {
  return d.data.kind === 'more' || (d.data.kind === 'list' && d.data.hiddenCount > 0);
}

// ── Tooltip ──────────────────────────────────────────────────
const dateFormat = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'numeric' });

function tooltipLines(data, mode) {
  const lines = [];
  if (data.kind === 'task') {
    if (mode === 'type') {
      lines.push(`Bereich: ${data.areaName}`, `Aktivität: ${data.listName}`);
    } else {
      lines.push(`Typ: ${data.typeName}`);
    }
    if (data.due) lines.push(`Fällig: ${dateFormat.format(data.due)}`);
    if (data.important) lines.push('Wichtig');
  }
  if (data.kind === 'list' && data.hiddenCount > 0) {
    lines.push(data.expanded
      ? 'Klick: wieder einklappen'
      : `Klick: alle ${data.taskCount} Aufgaben anzeigen`);
  }
  if (data.kind === 'more') lines.push('Klick: alle anzeigen');
  return lines;
}

function showTooltip(tooltipEl, event, d, mode) {
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    n.className = cls;
    n.textContent = text;
    return n;
  };
  const children = [
    el('div', 'tt-name', d.data.name),
    el('div', 'tt-kind', KIND_LABELS[d.data.kind] ?? ''),
    ...tooltipLines(d.data, mode).map(line => el('div', 'tt-meta', line)),
  ];
  if (d.data.motivation) children.push(el('div', 'tt-motivation', d.data.motivation));
  tooltipEl.replaceChildren(...children);

  tooltipEl.classList.add('visible');
  const x = Math.min(event.clientX + 16, window.innerWidth - tooltipEl.offsetWidth - 8);
  const y = Math.min(event.clientY - 12, window.innerHeight - tooltipEl.offsetHeight - 8);
  tooltipEl.style.left = `${Math.max(8, x)}px`;
  tooltipEl.style.top = `${Math.max(8, y)}px`;
}

// ── Render ───────────────────────────────────────────────────
//  options: { mode: 'area' | 'type', theme, tooltipEl, onToggleList(listId) }
export function renderSunburst(svgEl, tree, { mode, theme, tooltipEl, onToggleList }) {
  const size = LAYOUT_CONFIG.diagramSize;
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  svg.attr('viewBox', `${-RADIUS} ${-RADIUS} ${size} ${size}`);

  const root = d3.hierarchy(tree).sum(d => d.value ?? 0);
  d3.partition().size([2 * Math.PI, RADIUS])(root);
  const nodes = root.descendants().filter(d => d.depth > 0);

  const arc = d3.arc()
    .startAngle(d => d.x0).endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.007))
    .padRadius(RADIUS / 2)
    .innerRadius(d => getRings(mode, d.depth).inner)
    .outerRadius(d => getRings(mode, d.depth).outer);

  const g = svg.append('g');

  const paths = g.append('g').selectAll('path')
    .data(nodes)
    .join('path')
    .attr('class', d => `seg seg-${d.data.kind}${isToggleable(d) ? ' clickable' : ''}`)
    .attr('d', arc)
    .attr('fill', d => nodeColor(d, theme))
    .on('mousemove', (event, d) => {
      showTooltip(tooltipEl, event, d, mode);
      paths.classed('dimmed', n => !(n === d || n.ancestors().includes(d) || d.ancestors().includes(n)));
    })
    .on('mouseleave', () => {
      tooltipEl.classList.remove('visible');
      paths.classed('dimmed', false);
    })
    .on('click', (event, d) => {
      if (isToggleable(d)) onToggleList?.(d.data.listId);
    });

  const family = labelFontFamily();
  g.append('g').attr('pointer-events', 'none').selectAll('g')
    .data(nodes.filter(d => (d.x1 - d.x0) * getRings(mode, d.depth).inner >= 10))
    .join('g')
    .attr('transform', d => {
      const [x, y] = arc.centroid(d);
      return `translate(${x},${y}) rotate(${labelRotation(d)})`;
    })
    .append('text')
    .attr('class', d => `label label-${d.depth} label-${d.data.kind}`)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-weight', d => labelCfg(d.depth).weight)
    .attr('font-size', d => labelCfg(d.depth).fontSize)
    .text(d => fitLabel(d, mode, family));

  // Zentrum: Anzahl der angezeigten Aufgaben (im SVG, damit es mitskaliert)
  const total = nodes.filter(d => d.data.kind === 'task').length;
  const center = g.append('g').attr('class', 'center').attr('pointer-events', 'none');
  center.append('text').attr('class', 'center-num').attr('y', -6).attr('text-anchor', 'middle').text(total);
  center.append('text').attr('class', 'center-label').attr('y', 26).attr('text-anchor', 'middle')
    .text(total === 1 ? 'Aufgabe' : 'Aufgaben');

  return { total };
}

// ── Legende ──────────────────────────────────────────────────
export function renderLegend(legendEl, tree, theme) {
  const items = tree.children.map(node => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = baseColor(node.colorIndex, theme);
    item.append(swatch, document.createTextNode(node.name));
    return item;
  });
  legendEl.replaceChildren(...items);
}
