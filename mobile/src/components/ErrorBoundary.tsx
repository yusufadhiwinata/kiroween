import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { images } from '../assets/images';
import { recordError } from '../services/crashLog';
import { colors } from '../theme';

interface State {
  error: Error | null;
}

/** Catches render errors so one broken screen never takes down the whole app. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; label?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    recordError(error, false);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root} accessibilityRole="alert">
        <Image source={images.ghost} style={styles.ghost} resizeMode="contain" />
        <Text style={styles.title}>The fog swallowed this {this.props.label ?? 'screen'}</Text>
        <Text style={styles.body}>Something went wrong. Your progress is safe in the local ledger.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => this.setState({ error: null })}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.night, padding: 24 },
  ghost: { width: 110, height: 120, marginBottom: 16 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 8 },
  button: { marginTop: 20, backgroundColor: colors.gold, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14, minHeight: 48 },
  buttonText: { color: '#1F1300', fontWeight: '900', fontSize: 16 },
});
