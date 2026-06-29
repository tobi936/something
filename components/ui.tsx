import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { theme } from '../lib/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ScreenTitle({ children, subtitle }: { children: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: theme.spacing(3) }}>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Check({ on }: { on: boolean }) {
  return (
    <View style={[styles.check, on && styles.checkOn]}>
      {on ? <Text style={styles.checkMark}>✓</Text> : null}
    </View>
  );
}

export function SoftButton({
  label,
  onPress,
  loading,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'solid' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        pressed && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? theme.colors.text : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'ghost' && styles.buttonTextGhost]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(2),
  },
  title: { fontSize: theme.font.title, color: theme.colors.text, fontWeight: '600' },
  subtitle: { fontSize: theme.font.body, color: theme.colors.muted, marginTop: 4 },
  sectionLabel: {
    fontSize: theme.font.small,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: theme.spacing(1),
  },
  muted: { color: theme.colors.muted, fontSize: theme.font.body },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkMark: { color: '#fff', fontSize: 16, fontWeight: '700' },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  buttonText: { color: '#fff', fontSize: theme.font.body, fontWeight: '600' },
  buttonTextGhost: { color: theme.colors.text },
});
