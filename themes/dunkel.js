// Dunkles Theme – gleiche Schriften, warmes Anthrazit, leuchtendere Palette
export default {
  id: 'dunkel',
  name: 'Dunkel',
  fonts: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Syne+Mono&display=swap',
  vars: {
    '--bg':            '#17161a',
    '--surface':       '#201f24',
    '--border':        '#36343c',
    '--ink':           '#ece8df',
    '--muted':         '#8f897e',
    '--accent':        '#e0604f',
    '--accent-ink':    '#17161a',
    '--tooltip-bg':    '#ece8df',
    '--tooltip-ink':   '#17161a',
    '--tooltip-muted': '#6b665d',
    '--tooltip-rule':  '#cfcac0',
    '--label-1':       '#17161a',
    '--label-2':       '#ece8df',
    '--label-3':       '#ece8df',
    '--noise-opacity': '0.04',
    '--font-head':     "'Syne', sans-serif",
    '--font-body':     "'Syne Mono', monospace",
  },
  palette: ['#e0604f', '#4a9fd4', '#4fae74', '#b072cf', '#ec8a3c', '#3cbfa3', '#d4b43a', '#9aa5a6'],
  // Für „Sonstige“ in der Typ-Ansicht
  neutralColor: '#6f6a62',
  // Äussere Ringe werden abgedunkelt
  ringShade: 'darker',
};
