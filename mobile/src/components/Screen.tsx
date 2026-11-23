import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HauntedBackground, type SceneArt } from './HauntedBackground';
import { colors } from '../theme';
import { GText } from './ui';

export const TAB_BAR_SPACE = 110;

/** Standard screen: haunted backdrop + safe-area aware scroll content. */
export function Screen({
  art = 'night',
  dim = 0.6,
  title,
  subtitle,
  right,
  children,
  scroll = true,
  tabs = true,
  onRefresh,
  refreshing = false,
  background,
  bats = false,
  keyboardShouldPersistTaps = 'handled',
}: {
  art?: SceneArt;
  dim?: number;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  tabs?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  background?: React.ReactNode;
  bats?: boolean;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
}) {
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <GText variant="display" accessibilityRole="header">
          {title}
        </GText>
        {subtitle ? (
          <GText variant="body" muted>
            {subtitle}
          </GText>
        ) : null}
      </View>
      {right}
    </View>
  ) : null;
  const padding = { paddingTop: insets.top + 12, paddingBottom: (tabs ? TAB_BAR_SPACE : 24) + insets.bottom, paddingHorizontal: 16 };
  return (
    <View style={styles.root}>
      {background ?? <HauntedBackground art={art} dim={dim} bats={bats} />}
      {scroll ? (
        <ScrollView
          contentContainerStyle={padding}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} progressBackgroundColor={colors.navy} /> : undefined}
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding]}>
          {header}
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, minHeight: 48 },
});
