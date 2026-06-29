import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/theme';
import { Muted, SoftButton } from '../components/ui';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function submit() {
    setNote(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          // E-Mail-Bestätigung ist aus — wir sind direkt drin.
          return;
        }
        setNote('Konto erstellt. Bitte bestätige die E-Mail, dann melde dich an.');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setNote(e.message ?? 'Etwas ist schiefgelaufen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.wrap}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Tobi OS</Text>
        <Muted style={{ textAlign: 'center', marginBottom: theme.spacing(5) }}>
          Dein ruhiger Ort. Er wartet, bis du kommst.
        </Muted>

        <TextInput
          placeholder="E-Mail"
          placeholderTextColor={theme.colors.faint}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Passwort"
          placeholderTextColor={theme.colors.faint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        <View style={{ height: theme.spacing(2) }} />
        <SoftButton
          label={mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
          onPress={submit}
          loading={loading}
        />
        <View style={{ height: theme.spacing(1.5) }} />
        <SoftButton
          variant="ghost"
          label={mode === 'signin' ? 'Neu hier? Konto erstellen' : 'Schon ein Konto? Anmelden'}
          onPress={() => {
            setNote(null);
            setMode(mode === 'signin' ? 'signup' : 'signin');
          }}
        />

        {note ? <Muted style={styles.note}>{note}</Muted> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: theme.spacing(4) },
  logo: {
    fontSize: 40,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing(1),
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: 14,
    fontSize: theme.font.body,
    color: theme.colors.text,
    marginBottom: theme.spacing(1.5),
  },
  note: { textAlign: 'center', marginTop: theme.spacing(3) },
});
