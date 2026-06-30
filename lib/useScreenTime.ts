import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { todayISO } from './types';

export type ScreenTimeData = {
  minutes: number | null;
  inAppSeconds: number;
};

async function loadFromSupabase(): Promise<number | null> {
  const { data } = await supabase
    .from('screen_time')
    .select('minutes')
    .eq('date', todayISO())
    .maybeSingle();
  return data?.minutes ?? null;
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function parseScreenTimeUrl(url: string): number | null {
  try {
    const parsed = Linking.parse(url);
    if (parsed.path === 'screentime' && parsed.queryParams?.minutes) {
      const m = parseInt(parsed.queryParams.minutes as string, 10);
      return isNaN(m) ? null : m;
    }
  } catch {}
  return null;
}

export function useImportedScreenTime() {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    // Always read from Supabase — works on web and native
    loadFromSupabase().then(setMinutes);

    if (Platform.OS === 'web') return;

    // Native only: also listen for flux:// deep links
    const sub = Linking.addEventListener('url', ({ url }) => {
      const m = parseScreenTimeUrl(url);
      if (m !== null) setMinutes(m);
    });
    Linking.getInitialURL().then((url) => {
      if (url) {
        const m = parseScreenTimeUrl(url);
        if (m !== null) setMinutes(m);
      }
    });
    return () => sub.remove();
  }, []);

  return minutes;
}
