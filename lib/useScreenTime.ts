import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { todayISO } from './types';

const KEY = () => `ios_screentime_${todayISO()}`;

export type ScreenTimeData = {
  minutes: number | null; // iOS screen time imported via Shortcut
  inAppSeconds: number;   // time spent in this app today
};

async function loadImported(): Promise<number | null> {
  const v = await AsyncStorage.getItem(KEY());
  return v !== null ? parseInt(v, 10) : null;
}

async function saveImported(minutes: number) {
  await AsyncStorage.setItem(KEY(), String(minutes));
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Parses tobios://screentime?minutes=X
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
    // Load persisted value
    loadImported().then(setMinutes);

    // Handle URL when app is already open
    const sub = Linking.addEventListener('url', ({ url }) => {
      const m = parseScreenTimeUrl(url);
      if (m !== null) {
        setMinutes(m);
        saveImported(m);
      }
    });

    // Handle URL that opened the app cold
    Linking.getInitialURL().then((url) => {
      if (url) {
        const m = parseScreenTimeUrl(url);
        if (m !== null) {
          setMinutes(m);
          saveImported(m);
        }
      }
    });

    return () => sub.remove();
  }, []);

  return minutes;
}
