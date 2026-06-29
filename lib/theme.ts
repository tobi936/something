// Tobi OS — seriös, professionell, hell. Glasmorphismus auf weissem Verlauf,
// zurückhaltende farbige Akzente.
export const theme = {
  colors: {
    // Heller, kühler Verlauf statt Beige
    bgGradient: ['#E8F0FF', '#FBFCFF', '#E6F6FF'] as const,

    text: '#0F172A',
    muted: '#64748B',
    faint: '#9AA4B2',

    // Glasflächen
    glass: 'rgba(255,255,255,0.55)',
    glassStrong: 'rgba(255,255,255,0.78)',
    glassBorder: 'rgba(255,255,255,0.75)',
    hairline: 'rgba(15,23,42,0.07)',

    // Akzent — professionelles Blau (kein Violett)
    accent: '#2563EB',
    accentGradient: ['#2563EB', '#3B82F6'] as const,
    accentSoft: 'rgba(37,99,235,0.12)',

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
  family: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  shadow: {
    shadowColor: '#1B1F2E',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};

// Lebendige, aber edle Farbpalette für Gewohnheiten (kein Violett)
export const ACCENTS = [
  '#2563EB', // Blau
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#F43F5E', // Rose
];
