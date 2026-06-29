// Tobi OS — seriös, professionell, hell. Glasmorphismus auf weissem Verlauf,
// zurückhaltende farbige Akzente.
export const theme = {
  colors: {
    // Heller, kühler Verlauf statt Beige
    bgGradient: ['#EEF1FF', '#FBFCFF', '#EAF8FF'] as const,

    text: '#16181D',
    muted: '#6B7280',
    faint: '#A6ABB6',

    // Glasflächen
    glass: 'rgba(255,255,255,0.55)',
    glassStrong: 'rgba(255,255,255,0.78)',
    glassBorder: 'rgba(255,255,255,0.75)',
    hairline: 'rgba(22,24,29,0.07)',

    // Akzent
    accent: '#6366F1',
    accentGradient: ['#6366F1', '#8B5CF6'] as const,
    accentSoft: 'rgba(99,102,241,0.12)',

    onAccent: '#FFFFFF',

    // Aliase (für bestehende Screen-Styles)
    border: 'rgba(22,24,29,0.07)',
    surface: 'rgba(255,255,255,0.78)',
    surfaceAlt: 'rgba(22,24,29,0.06)',
  },
  spacing: (n: number) => n * 8,
  radius: 20,
  font: {
    title: 30,
    heading: 20,
    body: 16,
    small: 13,
  },
  shadow: {
    shadowColor: '#1B1F2E',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};

// Lebendige, aber edle Farbpalette für Gewohnheiten
export const ACCENTS = [
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Violet
];
