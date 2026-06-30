import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Card, Muted, ScreenTitle, SectionLabel } from '../components/ui';
import { formatMinutes } from '../lib/useScreenTime';
import { todayISO } from '../lib/types';

function parseInput(s: string): number | null {
  const trimmed = s.trim();
  // "2h 30m" or "2h30m"
  const hm = trimmed.match(/^(\d+)h\s*(\d+)?\s*m?$/i);
  if (hm) {
    return parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);
  }
  // "2:30"
  const colon = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
  // plain minutes
  const plain = parseInt(trimmed, 10);
  if (!isNaN(plain) && plain >= 0) return plain;
  return null;
}

export default function SettingsScreen({ userId }: { userId: string }) {
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    supabase
      .from('screen_time')
      .select('minutes')
      .eq('date', todayISO())
      .maybeSingle()
      .then(({ data }) => {
        if (data?.minutes != null) setCurrentMinutes(data.minutes);
      });
  }, []);

  async function save() {
    const minutes = parseInput(input);
    if (minutes === null) {
      setError(true);
      return;
    }
    setError(false);
    setSaving(true);
    await supabase.from('screen_time').upsert(
      { date: todayISO(), minutes, updated_at: new Date().toISOString() },
      { onConflict: 'date' },
    );
    setCurrentMinutes(minutes);
    setInput('');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle>Einstellungen</ScreenTitle>

        <SectionLabel>Bildschirmzeit heute</SectionLabel>
        <Card style={{ marginBottom: theme.spacing(3) }}>
          {currentMinutes !== null && (
            <View style={styles.currentRow}>
              <Muted>Aktuell eingetragen</Muted>
              <Text style={styles.currentVal}>{formatMinutes(currentMinutes)}</Text>
            </View>
          )}
          <View style={[styles.inputRow, currentMinutes !== null && styles.inputRowBorder]}>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="z.B. 2h 30m · 2:30 · 150"
              placeholderTextColor={theme.colors.faint}
              value={input}
              onChangeText={(t) => { setInput(t); setError(false); setSaved(false); }}
              onSubmitEditing={save}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={save}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saved ? 'Gespeichert ✓' : 'Speichern'}</Text>
            </Pressable>
          </View>
          {error && (
            <Muted style={styles.errorText}>Format: 2h 30m · 2:30 · 150 (Minuten)</Muted>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.spacing(3), paddingTop: theme.spacing(2) },

  currentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  currentVal: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: theme.family.semibold,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  inputRowBorder: {
    paddingTop: 12,
  },
  input: {
    flex: 1,
    fontSize: theme.font.body,
    color: theme.colors.text,
    fontFamily: theme.family.regular,
    paddingVertical: 4,
  },
  inputError: {
    color: '#F43F5E',
  },
  errorText: {
    fontSize: theme.font.small,
    marginTop: 6,
    color: '#F43F5E',
  },

  saveBtn: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontSize: theme.font.small,
    color: '#fff',
    fontFamily: theme.family.semibold,
  },
});
