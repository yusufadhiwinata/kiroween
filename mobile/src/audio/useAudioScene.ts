import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { audio } from './AudioEngine';
import type { SceneId, SfxId } from './catalog';
import { useSettings } from '../store/settingsStore';

/** Switches the soundscape whenever the calling screen gains focus. */
export function useAudioScene(scene: SceneId) {
  useFocusEffect(
    useCallback(() => {
      audio.setScene(scene);
    }, [scene]),
  );
}

export const sfx = (id: SfxId, opts?: { restart?: boolean }) => audio.playSfx(id, opts);

/** Keeps the engine in sync with persisted preferences. */
export function useAudioPreferences() {
  const enabled = useSettings(s => s.soundEnabled && s.soundIntroDone);
  const music = useSettings(s => s.musicVolume);
  const ambience = useSettings(s => s.ambienceVolume);
  const effects = useSettings(s => s.sfxVolume);
  useEffect(() => {
    audio.configure({ enabled, music, ambience, sfx: effects });
  }, [enabled, music, ambience, effects]);
}
