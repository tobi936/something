// Tobi OS — ruhiges, aufgeräumtes Design. Keine grellen Farben, keine Badges.
export const theme = {
  colors: {
    bg: '#F4F2EC',        // warmes Papier
    surface: '#FBFAF6',   // leicht erhöhte Fläche
    surfaceAlt: '#EDEAE2',
    border: '#E2DED4',
    text: '#2B2A28',      // ruhiges Dunkelbraun-Grau
    muted: '#9A968E',     // gedämpft
    faint: '#C4BFB4',
    accent: '#6B7B6E',    // gedämpftes Salbeigrün
    accentSoft: '#DCE3DB',
  },
  spacing: (n: number) => n * 8,
  radius: 16,
  font: {
    title: 28,
    heading: 20,
    body: 16,
    small: 13,
  },
};
