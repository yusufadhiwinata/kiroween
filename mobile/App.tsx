/**
 * GRAVEYARD — Every Task Awakens a Forgotten Soul.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAudioPreferences } from './src/audio/useAudioScene';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { CelebrationHost, ToastHost } from './src/components/overlays';
import { timezone } from './src/domain/dates';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/screens/SplashScreen';
import { installGlobalErrorHandler } from './src/services/crashLog';
import { syncReminders } from './src/services/reminders';
import { getSupabase } from './src/services/supabase';
import { queueProfileUpdate, scheduleSync, startSyncTriggers } from './src/services/sync';
import { useKeeper } from './src/store/keeperStore';
import { useSession, wasGuest } from './src/store/sessionStore';
import { colors } from './src/theme';

installGlobalErrorHandler();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.night, card: colors.navy, primary: colors.gold, text: colors.text, border: colors.panelBorder },
};

/** Restores the session (Supabase or offline guest) and loads the local ledger. */
function useBootstrap() {
  const status = useSession(s => s.status);
  const userId = useSession(s => s.userId);

  useEffect(() => {
    const sb = getSupabase();
    const session = useSession.getState();
    if (!sb) {
      if (wasGuest()) session.setGuest();
      else session.setSignedOut();
      return;
    }
    let cancelled = false;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (data.session) session.setSignedIn(data.session.user.id, data.session.user.email ?? null);
        else if (wasGuest()) session.setGuest();
        else session.setSignedOut();
      })
      .catch(() => (wasGuest() ? session.setGuest() : session.setSignedOut()));
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      const current = useSession.getState();
      if (event === 'SIGNED_IN' && s && current.userId !== s.user.id) current.setSignedIn(s.user.id, s.user.email ?? null);
      if (event === 'SIGNED_OUT' && current.status === 'signedIn') current.setSignedOut();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if ((status !== 'signedIn' && status !== 'guest') || !userId) return;
    let alive = true;
    void useKeeper
      .getState()
      .load(userId)
      .then(() => {
        if (!alive) return;
        startSyncTriggers();
        void syncReminders(useKeeper.getState().rituals);
        if (status === 'signedIn') {
          void queueProfileUpdate({ timezone: timezone() });
          scheduleSync(300);
        }
      });
    return () => {
      alive = false;
    };
  }, [status, userId]);

  const ready = useKeeper(s => s.ready);
  return status !== 'loading' && (status === 'signedOut' || ready);
}

function Root() {
  useAudioPreferences();
  const ready = useBootstrap();
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {splashDone ? (
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      ) : (
        <SplashScreen ready={ready} onDone={finishSplash} />
      )}
      <ToastHost />
      <CelebrationHost />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary label="Graveyard">
        <Root />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
});
