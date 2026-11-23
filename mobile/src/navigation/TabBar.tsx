import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { images, navIcons } from '../assets/images';
import { sfx } from '../audio/useAudioScene';
import { Glow, useFloat } from '../components/effects';
import { colors } from '../theme';

function KeeperFab() {
  const navigation = useNavigation();
  const float = useFloat(4, 2000);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Dark Keeper AI assistant"
      onPress={() => {
        sfx('magicTransition');
        navigation.navigate('DarkKeeper');
      }}
      style={styles.fab}
      hitSlop={6}
    >
      <Glow size={120} color="#A78BFA" style={{ left: -24, top: -24 }} min={0.35} max={0.8} />
      <Animated.Image source={images.keeperAvatar} style={[styles.fabImage, float]} resizeMode="contain" />
    </Pressable>
  );
}

export function GraveyardTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <KeeperFab />
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const icon = navIcons[route.name as keyof typeof navIcons];
          const label = (descriptors[route.key].options.title ?? route.name) as string;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  sfx('menu');
                  navigation.navigate(route.name, route.params);
                }
              }}
              style={[styles.item, focused && styles.itemActive]}
            >
              <Image source={focused ? icon.active : icon.idle} style={styles.icon} resizeMode="contain" />
              <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {label}
              </Text>
              {focused ? <View style={styles.underline} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10 },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#1A1840',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#34306A',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, minHeight: 64, borderRightWidth: 1, borderRightColor: '#2A2658' },
  itemActive: { backgroundColor: '#24215A' },
  icon: { width: 34, height: 30 },
  label: { color: '#C4BAEC', fontWeight: '800', fontSize: 12.5, marginTop: 2 },
  labelActive: { color: colors.gold },
  underline: { position: 'absolute', bottom: 4, width: '55%', height: 4, borderRadius: 2, backgroundColor: colors.gold },
  fab: { position: 'absolute', right: 16, bottom: 92, width: 72, height: 72, zIndex: 5 },
  fabImage: { width: 72, height: 72 },
});
