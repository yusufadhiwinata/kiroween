import { useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSettings } from '../store/settingsStore';

/** Reduce Motion = OS accessibility setting OR the in-app toggle. */
export function useMotion() {
  const system = useReducedMotion();
  const app = useSettings(s => s.reduceMotion);
  return { reduceMotion: system || app, systemReduceMotion: system };
}

export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** Works inside and outside navigators (outside = always focused). */
export function useScreenFocused(): boolean {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  useEffect(() => {
    if (!navigation) return;
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  return focused;
}

/** Decorative loops run only when visible, foregrounded and motion is allowed. */
export function useAnimationsActive(): boolean {
  const { reduceMotion } = useMotion();
  const focused = useScreenFocused();
  const appActive = useAppActive();
  return !reduceMotion && focused && appActive;
}
