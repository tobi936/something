import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { theme } from './lib/theme';
import AuthScreen from './screens/AuthScreen';
import TodayScreen from './screens/TodayScreen';
import HabitsScreen from './screens/HabitsScreen';
import TodosScreen from './screens/TodosScreen';
import ReflectionScreen from './screens/ReflectionScreen';

type Tab = 'today' | 'habits' | 'todos' | 'reflection';

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Heute' },
  { key: 'habits', label: 'Gewohnheiten' },
  { key: 'todos', label: 'Todos' },
  { key: 'reflection', label: 'Rückblick' },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('today');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.muted} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen />
      </>
    );
  }

  const userId = session.user.id;

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        {tab === 'today' && <TodayScreen userId={userId} />}
        {tab === 'habits' && <HabitsScreen userId={userId} />}
        {tab === 'todos' && <TodosScreen userId={userId} />}
        {tab === 'reflection' && <ReflectionScreen />}
      </View>

      <View style={styles.tabbar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              {active ? <View style={styles.dot} /> : <View style={styles.dotEmpty} />}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: theme.colors.bg },
  body: { flex: 1 },
  loading: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingTop: 10,
    paddingBottom: 10,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: theme.font.small, color: theme.colors.faint },
  tabTextActive: { color: theme.colors.text, fontWeight: '600' },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
    marginTop: 5,
  },
  dotEmpty: { width: 4, height: 4, marginTop: 5 },
});
