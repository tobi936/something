import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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

export function GradientBackground({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={theme.colors.bgGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    >
      {children}
    </LinearGradient>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.cardWrap, theme.shadow, style]}>
      <BlurView intensity={28} tint="light" style={styles.cardBlur}>
        <View style={styles.cardInner}>{children}</View>
      </BlurView>
    </View>
  );
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

export function Muted({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  return (
    <Text style={[styles.muted, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Check({ on, color }: { on: boolean; color?: string }) {
  if (on) {
    return (
      <LinearGradient
        colors={color ? [color, color] : theme.colors.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.check}
      >
        <Text style={styles.checkMark}>✓</Text>
      </LinearGradient>
    );
  }
  return <View style={[styles.check, styles.checkOff]} />;
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
  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={loading}
        style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.6 }]}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Text style={styles.ghostText}>{label}</Text>
        )}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [theme.shadow, { borderRadius: 14 }, pressed && { opacity: 0.85 }]}
    >
      <LinearGradient
        colors={theme.colors.accentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.button}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrap: { borderRadius: theme.radius },
  cardBlur: {
    borderRadius: theme.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
  },
  cardInner: {
    backgroundColor: theme.colors.glass,
    padding: theme.spacing(2),
  },
  title: {
    fontSize: theme.font.title,
    color: theme.colors.text,
    fontFamily: theme.family.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: theme.font.body,
    color: theme.colors.muted,
    fontFamily: theme.family.regular,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: theme.font.small,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontFamily: theme.family.semibold,
    marginBottom: theme.spacing(1),
  },
  muted: { color: theme.colors.muted, fontSize: theme.font.body, fontFamily: theme.family.regular },
  check: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOff: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.faint,
  },
  checkMark: { color: '#fff', fontSize: 15, fontFamily: theme.family.bold },
  button: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: theme.font.body,
    fontFamily: theme.family.bold,
    letterSpacing: 0.2,
  },
  ghost: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    backgroundColor: theme.colors.glassStrong,
  },
  ghostText: { color: theme.colors.text, fontSize: theme.font.body, fontFamily: theme.family.semibold },
});
