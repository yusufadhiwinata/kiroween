import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GText, RoundAction } from './ui';

export function SubHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const navigation = useNavigation();
  return (
    <View style={styles.row}>
      <RoundAction glyph="‹" label="Go back" onPress={() => navigation.goBack()} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <GText variant="title" accessibilityRole="header" numberOfLines={1}>
          {title}
        </GText>
        {subtitle ? (
          <GText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </GText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, minHeight: 48 },
});
