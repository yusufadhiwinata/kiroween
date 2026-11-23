import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  PanResponder,
  Pressable,
  type PressableProps,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors, font, radii, usePalette } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { sfx } from '../audio/useAudioScene';
import type { SfxId } from '../audio/catalog';

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
type Variant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';

const variantStyle: Record<Variant, object> = {
  display: { fontSize: 30, ...font.display },
  title: { fontSize: 22, ...font.title },
  heading: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 15, ...font.body },
  caption: { fontSize: 12.5, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
};

export function GText({
  variant = 'body',
  color,
  muted,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; muted?: boolean }) {
  const p = usePalette();
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[variantStyle[variant], { color: color ?? (muted ? p.textMuted : p.text) }, style]}
    />
  );
}

// ---------------------------------------------------------------------------
// Pressables
// ---------------------------------------------------------------------------
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  style,
  sound = 'menu',
  onPress,
  disabled,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; sound?: SfxId | null; children?: React.ReactNode }) {
  const scale = useSharedValue(1);
  const { reduceMotion } = useMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      onPressIn={e => {
        if (!reduceMotion) scale.value = withTiming(0.95, { duration: 90 });
        rest.onPressIn?.(e);
      }}
      onPressOut={e => {
        if (!reduceMotion) scale.value = withSpring(1, { damping: 12, stiffness: 260 });
        rest.onPressOut?.(e);
      }}
      onPress={e => {
        if (sound) sfx(sound);
        onPress?.(e);
      }}
      style={[{ minHeight: 44, opacity: disabled ? 0.5 : 1 }, style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  style,
  sound = 'menu',
  accessibilityHint,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  sound?: SfxId | null;
  accessibilityHint?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      sound={sound}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[styles.primary, style]}
    >
      {icon ? <Text style={styles.primaryIcon}>{icon}</Text> : null}
      <Text style={styles.primaryText} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function SecondaryButton({
  label,
  image,
  onPress,
  disabled,
  style,
  sound = 'menu',
}: {
  label: string;
  image?: ImageSourcePropType;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  sound?: SfxId | null;
}) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} sound={sound} accessibilityLabel={label} style={[styles.secondary, style]}>
      {image ? <Image source={image} style={styles.secondaryImage} resizeMode="contain" /> : null}
      <Text style={styles.secondaryText} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function GhostButton({ label, onPress, color, style, sound = 'menu' }: { label: string; onPress: () => void; color?: string; style?: StyleProp<ViewStyle>; sound?: SfxId | null }) {
  return (
    <PressableScale onPress={onPress} sound={sound} accessibilityLabel={label} style={[styles.ghost, color ? { borderColor: color } : null, style]}>
      <Text style={[styles.ghostText, color ? { color } : null]} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function IconButton({ image, label, onPress, size = 48 }: { image: ImageSourcePropType; label: string; onPress: () => void; size?: number }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={image} style={{ width: size, height: size }} resizeMode="contain" />
    </PressableScale>
  );
}

export function RoundAction({ glyph, label, onPress, tone = 'navy' }: { glyph: string; label: string; onPress: () => void; tone?: 'navy' | 'gold' }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={[styles.round, tone === 'gold' && styles.roundGold]}>
      <Text style={[styles.roundGlyph, tone === 'gold' && { color: colors.parchmentInk }]}>{glyph}</Text>
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------
export function Panel({
  children,
  title,
  icon,
  right,
  style,
}: {
  children?: React.ReactNode;
  title?: string;
  icon?: ImageSourcePropType;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <View style={[styles.panel, { backgroundColor: p.panel, borderColor: p.panelBorder }, style]}>
      {title ? (
        <View style={styles.panelHeader}>
          {icon ? <Image source={icon} style={styles.panelIcon} resizeMode="contain" /> : null}
          <GText variant="heading" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </GText>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  return (
    <PressableScale
      sound="pageTurn"
      onPress={onPress}
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      style={[styles.chip, active && { backgroundColor: color ?? colors.gold, borderColor: color ?? colors.gold }]}
    >
      <Text style={[styles.chipText, active && { color: colors.parchmentInk }]} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map(o => (
        <PressableScale
          key={o.value}
          sound="pageTurn"
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          accessibilityLabel={o.label}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, o.value === value && { color: colors.parchmentInk }]} maxFontSizeMultiplier={1.3}>
            {o.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

export function ProgressBar({ ratio, color = colors.gold, height = 10, track = 'rgba(255,255,255,0.08)' }: { ratio: number; color?: string; height?: number; track?: string }) {
  const { reduceMotion } = useMotion();
  const w = useSharedValue(0);
  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, ratio || 0));
    w.value = reduceMotion ? clamped : withTiming(clamped, { duration: 700 });
  }, [ratio, reduceMotion, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round((ratio || 0) * 100) }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color }, style]} />
    </View>
  );
}

export function TextField({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 14 }}>
      <GText variant="caption" muted style={{ marginBottom: 6 }}>
        {label}
      </GText>
      <TextInput
        placeholderTextColor={p.textFaint}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, { borderColor: error ? colors.red : p.panelBorder, color: p.text }, props.multiline && { minHeight: 88, textAlignVertical: 'top' }, props.style]}
      />
      {error ? (
        <GText variant="caption" color={colors.red} style={{ marginTop: 4 }}>
          {error}
        </GText>
      ) : null}
    </View>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <GText variant="body" style={{ fontWeight: '700' }}>
          {label}
        </GText>
        {hint ? (
          <GText variant="caption" muted>
            {hint}
          </GText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: '#3a3560', true: colors.purple }}
        thumbColor={value ? colors.gold : '#d6d3f0'}
      />
    </View>
  );
}

export function Stepper({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <View style={styles.row}>
      <GText variant="body" style={{ flex: 1, fontWeight: '700' }}>
        {label}
      </GText>
      <RoundAction glyph="−" label={`Decrease ${label}`} onPress={() => onChange(Math.max(min, value - step))} />
      <GText variant="heading" style={{ minWidth: 64, textAlign: 'center' }} accessibilityLiveRegion="polite">
        {value}
        {suffix}
      </GText>
      <RoundAction glyph="+" label={`Increase ${label}`} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

/** Accessible slider built on PanResponder (0..1). */
export function Slider({ label, value, onChange, onCommit, disabled }: { label: string; value: number; onChange: (v: number) => void; onCommit?: (v: number) => void; disabled?: boolean }) {
  const [width, setWidth] = useState(1);
  const valueRef = useRef(value);
  valueRef.current = value;
  const widthRef = useRef(width);
  widthRef.current = width;
  const callbacks = useRef({ onChange, onCommit });
  callbacks.current = { onChange, onCommit };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: e => {
          const v = Math.max(0, Math.min(1, e.nativeEvent.locationX / widthRef.current));
          callbacks.current.onChange(Math.round(v * 100) / 100);
        },
        onPanResponderMove: e => {
          const v = Math.max(0, Math.min(1, e.nativeEvent.locationX / widthRef.current));
          callbacks.current.onChange(Math.round(v * 100) / 100);
        },
        onPanResponderRelease: () => callbacks.current.onCommit?.(valueRef.current),
        onPanResponderTerminationRequest: () => false,
      }),
    [disabled],
  );

  const pct = Math.round(value * 100);
  return (
    <View style={{ marginVertical: 10, opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <GText variant="body" style={{ fontWeight: '700' }}>
          {label}
        </GText>
        <GText variant="body" color={colors.gold}>
          {pct}%
        </GText>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: pct }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => {
          const delta = e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05;
          const v = Math.max(0, Math.min(1, Math.round((value + delta) * 100) / 100));
          onChange(v);
          onCommit?.(v);
        }}
        onLayout={e => setWidth(Math.max(1, e.nativeEvent.layout.width))}
        style={styles.sliderHit}
        {...responder.panHandlers}
      >
        <View pointerEvents="none" style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${pct}%` }]} />
        </View>
        <View pointerEvents="none" style={[styles.sliderThumb, { left: Math.max(0, Math.min(width - 26, value * width - 13)) }]} />
      </View>
    </View>
  );
}

export function EmptyState({ image, title, message, action }: { image: ImageSourcePropType; title: string; message: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 }}>
      <Image source={image} style={{ width: 96, height: 96, marginBottom: 12 }} resizeMode="contain" accessibilityIgnoresInvertColors />
      <GText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </GText>
      <GText variant="body" muted style={{ textAlign: 'center', marginTop: 6 }}>
        {message}
      </GText>
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: '#FDE68A',
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryIcon: { fontSize: 20, color: colors.parchmentInk, marginRight: 10, fontWeight: '900' },
  primaryText: { fontSize: 18, fontWeight: '900', color: '#1F1300' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B1F7A',
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: colors.purpleSoft,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryImage: { width: 44, height: 50, marginRight: 8 },
  secondaryText: { fontSize: 16, fontWeight: '900', color: '#F5EFFF', textAlign: 'center', flexShrink: 1 },
  ghost: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ghostText: { fontSize: 15, fontWeight: '800', color: colors.textMuted },
  round: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.navy,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundGold: { backgroundColor: colors.gold, borderColor: '#FDE68A' },
  roundGlyph: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: -2 },
  panel: {
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: 14,
    marginBottom: 14,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, minHeight: 44 },
  panelIcon: { width: 34, height: 34, marginRight: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.navy,
    borderWidth: 2,
    borderColor: colors.panelBorder,
    marginRight: 8,
    marginBottom: 8,
    justifyContent: 'center',
  },
  chipText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.navy,
    borderRadius: radii.md,
    padding: 4,
    borderWidth: 2,
    borderColor: colors.panelBorder,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  segmentActive: { backgroundColor: colors.gold },
  segmentText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  input: {
    borderWidth: 2,
    borderRadius: radii.md,
    backgroundColor: 'rgba(10, 8, 28, 0.8)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 8 },
  sliderHit: { height: 44, justifyContent: 'center' },
  sliderTrack: { height: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  sliderFill: { height: 10, backgroundColor: colors.purpleSoft },
  sliderThumb: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: '#FDE68A',
  },
});
