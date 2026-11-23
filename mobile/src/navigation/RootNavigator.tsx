import React from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useMotion } from '../hooks/useMotion';
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { ForgotPasswordScreen, SignInScreen, SignUpScreen } from '../screens/AuthScreens';
import { DarkKeeperScreen } from '../screens/DarkKeeperScreen';
import { FocusScreen } from '../screens/FocusScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LedgerScreen } from '../screens/LedgerScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { QuestEditorScreen } from '../screens/QuestEditorScreen';
import { QuestsScreen } from '../screens/QuestsScreen';
import { RitualEditorScreen } from '../screens/RitualEditorScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RegionScreen, WorldScreen } from '../screens/WorldScreens';
import { useSession } from '../store/sessionStore';
import { useSettings } from '../store/settingsStore';
import { colors } from '../theme';
import { GraveyardTabBar } from './TabBar';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

/** Wraps each screen in its own error boundary so one failure stays contained. */
function guarded<P extends object>(Component: React.ComponentType<P>, label: string) {
  const Wrapped = (props: P) => (
    <ErrorBoundary label={label}>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `Guarded(${label})`;
  return Wrapped;
}

const S = {
  Home: guarded(HomeScreen, 'home'),
  Quests: guarded(QuestsScreen, 'quests'),
  World: guarded(WorldScreen, 'world'),
  Ledger: guarded(LedgerScreen, 'ledger'),
  Profile: guarded(ProfileScreen, 'profile'),
  QuestEditor: guarded(QuestEditorScreen, 'quest editor'),
  RitualEditor: guarded(RitualEditorScreen, 'ritual editor'),
  Focus: guarded(FocusScreen, 'focus chamber'),
  DarkKeeper: guarded(DarkKeeperScreen, 'Dark Keeper'),
  Achievements: guarded(AchievementsScreen, 'achievements'),
  Settings: guarded(SettingsScreen, 'settings'),
  Region: guarded(RegionScreen, 'region'),
};

const renderTabBar = (props: BottomTabBarProps) => <GraveyardTabBar {...props} />;

function MainTabs() {
  return (
    <Tabs.Navigator
      tabBar={renderTabBar}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.night }, animation: 'fade' }}
    >
      <Tabs.Screen name="Home" component={S.Home} />
      <Tabs.Screen name="Quests" component={S.Quests} />
      <Tabs.Screen name="World" component={S.World} />
      <Tabs.Screen name="Ledger" component={S.Ledger} />
      <Tabs.Screen name="Profile" component={S.Profile} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const status = useSession(s => s.status);
  const onboardingDone = useSettings(s => s.onboardingDone);
  const { reduceMotion } = useMotion();
  const authed = status === 'signedIn' || status === 'guest';
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.night },
        animation: reduceMotion ? 'none' : 'fade',
      }}
    >
      {!onboardingDone ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : !authed ? (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Group screenOptions={{ animation: reduceMotion ? 'none' : 'slide_from_bottom' }}>
            <Stack.Screen name="QuestEditor" component={S.QuestEditor} />
            <Stack.Screen name="RitualEditor" component={S.RitualEditor} />
          </Stack.Group>
          <Stack.Screen name="Focus" component={S.Focus} />
          <Stack.Screen name="DarkKeeper" component={S.DarkKeeper} />
          <Stack.Screen name="Achievements" component={S.Achievements} />
          <Stack.Screen name="Settings" component={S.Settings} />
          <Stack.Screen name="Region" component={S.Region} />
        </>
      )}
    </Stack.Navigator>
  );
}
