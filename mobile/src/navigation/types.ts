import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AiMode } from '../services/ai';

export type TabParamList = {
  Home: undefined;
  Quests: { segment?: 'quests' | 'rituals' } | undefined;
  World: undefined;
  Ledger: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  QuestEditor: { questId?: string } | undefined;
  RitualEditor: { ritualId?: string } | undefined;
  Focus: { questId?: string } | undefined;
  DarkKeeper: { mode?: AiMode } | undefined;
  Achievements: undefined;
  Settings: undefined;
  Region: { areaId: string };
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
