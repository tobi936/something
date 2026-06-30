import { BlurView } from 'expo-blur';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { theme } from './lib/theme';
import { GradientBackground } from './components/ui';
import AuthScreen from './screens/AuthScreen';
import TodayScreen from './screens/TodayScreen';
import HabitsScreen from './screens/HabitsScreen';
import ReflectionScreen from './screens/ReflectionScreen';
import SettingsScreen from './screens/SettingsScreen';

type Tab = 'today' | 'habits' | 'reflection';

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Heute' },
  { key: 'habits', label: 'Gewohnheiten' },
  { key: 'reflection', label: 'Rückblick' },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('today');
  const [showSettings, setShowSettings] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading || !fontsLoaded) {
    return (
      <GradientBackground>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </GradientBackground>
    );
  }

  if (!session) {
    return (
      <GradientBackground>
        <StatusBar style="dark" />
        <AuthScreen />
      </GradientBackground>
    );
  }

  const userId = session.user.id;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.app}>
        <StatusBar style="dark" />
        <View style={styles.body}>
          {tab === 'today' && <TodayScreen userId={userId} />}
          {tab === 'habits' && <HabitsScreen userId={userId} />}
          {tab === 'reflection' && <ReflectionScreen onSettingsPress={() => setShowSettings(true)} />}
        </View>

        <BlurView intensity={40} tint="light" style={styles.tabbar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                {active ? <View style={styles.dot} /> : <View style={styles.dotEmpty} />}
              </Pressable>
            );
          })}
        </BlurView>
      </SafeAreaView>

      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <GradientBackground>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Einstellungen</Text>
              <Pressable onPress={() => setShowSettings(false)} hitSlop={12}>
                <Text style={styles.modalClose}>Fertig</Text>
              </Pressable>
            </View>
            <SettingsScreen userId={userId} />
          </SafeAreaView>
        </GradientBackground>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: 'transparent' },
  body: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: theme.font.small, color: theme.colors.faint, fontFamily: theme.family.medium },
  tabTextActive: { color: theme.colors.accent, fontFamily: theme.family.bold },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.accent,
    marginTop: 5,
  },
  dotEmpty: { width: 5, height: 5, marginTop: 5 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.glassBorder,
  },
  modalTitle: { fontSize: theme.font.body, color: theme.colors.text, fontFamily: theme.family.bold },
  modalClose: { fontSize: theme.font.body, color: theme.colors.accent, fontFamily: theme.family.medium },
});
