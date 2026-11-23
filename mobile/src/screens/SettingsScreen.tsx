import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { images } from '../assets/images';
import { sfx, useAudioScene } from '../audio/useAudioScene';
import { Screen } from '../components/Screen';
import { SubHeader } from '../components/SubHeader';
import { GText, GhostButton, Panel, Slider, Stepper, ToggleRow } from '../components/ui';
import { useMotion } from '../hooks/useMotion';
import { clearCrashLog, readCrashLog } from '../services/crashLog';
import { ensureNotificationPermission, remindersAvailable, syncReminders } from '../services/reminders';
import { queueSettingsUpdate } from '../services/sync';
import { useKeeper } from '../store/keeperStore';
import { useSession } from '../store/sessionStore';
import { DEFAULT_SETTINGS, useSettings } from '../store/settingsStore';
import { colors } from '../theme';

export function SettingsScreen() {
  useAudioScene('profile');
  const s = useSettings();
  const status = useSession(x => x.status);
  const { systemReduceMotion } = useMotion();
  const [crashes, setCrashes] = useState(readCrashLog());

  const pushToServer = () => {
    if (status !== 'signedIn') return;
    const v = useSettings.getState();
    void queueSettingsUpdate({
      sound_enabled: v.soundEnabled,
      music_volume: v.musicVolume,
      ambience_volume: v.ambienceVolume,
      sfx_volume: v.sfxVolume,
      reduce_motion: v.reduceMotion,
      high_contrast: v.highContrast,
      focus_minutes: v.focusMinutes,
      short_break_minutes: v.shortBreakMinutes,
      long_break_minutes: v.longBreakMinutes,
    });
  };

  const set = (patch: Partial<typeof DEFAULT_SETTINGS>, commit = true) => {
    s.update(patch);
    if (commit) pushToServer();
  };

  return (
    <Screen art="haunted" dim={0.8} tabs={false}>
      <SubHeader title="Settings" />
      <Panel title="Sound" icon={images.iconSound}>
        <ToggleRow label="Sound" hint="Turns all music, ambience and effects on or off" value={s.soundEnabled} onChange={v => set({ soundEnabled: v, soundIntroDone: true })} />
        <Slider label="Music" value={s.musicVolume} disabled={!s.soundEnabled} onChange={v => set({ musicVolume: v }, false)} onCommit={pushToServer} />
        <Slider label="Ambience" value={s.ambienceVolume} disabled={!s.soundEnabled} onChange={v => set({ ambienceVolume: v }, false)} onCommit={pushToServer} />
        <Slider
          label="Sound effects"
          value={s.sfxVolume}
          disabled={!s.soundEnabled}
          onChange={v => set({ sfxVolume: v }, false)}
          onCommit={() => {
            sfx('reward', { restart: true });
            pushToServer();
          }}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          <GhostButton label="Test effect" sound="questComplete" onPress={() => undefined} style={{ flex: 1 }} />
          <GhostButton label="Reset audio" onPress={() => set({ musicVolume: DEFAULT_SETTINGS.musicVolume, ambienceVolume: DEFAULT_SETTINGS.ambienceVolume, sfxVolume: DEFAULT_SETTINGS.sfxVolume })} style={{ flex: 1 }} />
        </View>
      </Panel>

      <Panel title="Accessibility" icon={images.iconHelp}>
        <ToggleRow label="Reduce Motion" hint={systemReduceMotion ? 'Your device setting already reduces motion.' : 'Stops fog, bats, floating and cinematic movement.'} value={s.reduceMotion || systemReduceMotion} onChange={v => set({ reduceMotion: v })} />
        <ToggleRow label="High contrast" hint="Brighter text and solid panels" value={s.highContrast} onChange={v => set({ highContrast: v })} />
        <GText variant="caption" muted>
          Sound is never required: every audio cue has a visual equivalent.
        </GText>
      </Panel>

      <Panel title="Focus Chamber" icon={images.candles[0]}>
        <Stepper label="Pomodoro" value={s.focusMinutes} min={5} max={120} step={5} suffix="m" onChange={v => set({ focusMinutes: v })} />
        <Stepper label="Short break" value={s.shortBreakMinutes} min={1} max={30} suffix="m" onChange={v => set({ shortBreakMinutes: v })} />
        <Stepper label="Long break" value={s.longBreakMinutes} min={5} max={60} step={5} suffix="m" onChange={v => set({ longBreakMinutes: v })} />
      </Panel>

      <Panel title="Notifications" icon={images.iconMusic}>
        <ToggleRow
          label="Ritual reminders"
          hint={remindersAvailable() ? 'Reminders for rituals that have a reminder time' : 'Reminders are unavailable on this build'}
          value={s.ritualReminders}
          onChange={async v => {
            if (v) await ensureNotificationPermission();
            set({ ritualReminders: v }, false);
            syncReminders(useKeeper.getState().rituals);
          }}
        />
      </Panel>

      <Panel title="About GRAVEYARD" icon={images.logo}>
        <GText variant="body" muted>
          Every task awakens a forgotten soul. Quests, rituals and focus sessions earn XP and Soul Energy; the server verifies every reward. Works offline and syncs when the connection returns.
        </GText>
        <GhostButton label="Replay the story" style={{ marginTop: 10 }} onPress={() => s.update({ onboardingDone: false })} />
      </Panel>

      <Panel title="Diagnostics" icon={images.cat}>
        {crashes.length === 0 ? (
          <GText variant="caption" muted>
            No errors recorded. The spirits are calm.
          </GText>
        ) : (
          crashes.slice(0, 5).map(c => (
            <GText key={c.at} variant="caption" color={c.fatal ? colors.red : colors.textMuted} style={{ marginBottom: 4 }}>
              {new Date(c.at).toLocaleString()} · {c.message}
            </GText>
          ))
        )}
        {crashes.length > 0 ? (
          <GhostButton
            label="Clear log"
            style={{ marginTop: 8 }}
            onPress={() => {
              clearCrashLog();
              setCrashes([]);
            }}
          />
        ) : null}
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Image source={images.decoCauldron} style={{ width: 60, height: 70 }} resizeMode="contain" />
        </View>
      </Panel>
    </Screen>
  );
}
