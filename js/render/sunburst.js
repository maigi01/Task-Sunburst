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
//  fontSize:  Schriftgrösse in px
//  bold:      true = fett
//  charWidth: geschätzte Zeichenbreite relativ zu fontSize
//             → kleiner = mehr Zeichen erlaubt (bei Überlappung erhöhen)
//             Richtwert: 0.50 (schmal) bis 0.65 (breit/fett)
//  minArcPx:  minimale Bogenlänge in px, damit ein Label gezeichnet wird
// ═══════════════════════════════════════════════════════════════
export const LABEL_CONFIG = {
  1: { fontSize: 15, bold: true,  charWidth: 0.55, minArcPx: 20 },
  2: { fontSize: 13, bold: false, charWidth: 0.53, minArcPx: 16 },
  3: { fontSize: 11, bold: false, charWidth: 0.52, minArcPx: 14 },
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
  centerRadius: 90,
  gap:          6,
  area: { ring1end: 230, ring2end: 380 },
  type: { ring1end: 270 },
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
// Text läuft radial (vom Zentrum nach aussen) — die verfügbare Textlänge ist
// daher die Ringbreite. Die Bogenlänge entscheidet nur, ob das Segment breit
// genug für ein Label ist.
function fitLabel(d, mode) {
  const ring = getRings(mode, d.depth);
  const cfg = LABEL_CONFIG[d.depth] ?? LABEL_CONFIG[3];
  const arcPx = (d.x1 - d.x0) * (ring.inner + ring.outer) / 2;
  if (arcPx < cfg.minArcPx) return '';

  const radialPx = (ring.outer - ring.inner) - 8;
  const chars = Math.floor(radialPx / (cfg.fontSize * cfg.charWidth));
  if (chars < 2) return '';
  const name = d.data.name;
  return name.length > chars ? name.slice(0, chars - 1) + '…' : name;
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
    .attr('font-weight', d => (LABEL_CONFIG[d.depth] ?? LABEL_CONFIG[3]).bold ? 600 : 400)
    .attr('font-size', d => (LABEL_CONFIG[d.depth] ?? LABEL_CONFIG[3]).fontSize)
    .text(d => fitLabel(d, mode));

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
