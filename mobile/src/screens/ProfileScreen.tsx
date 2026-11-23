import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { images } from '../assets/images';
import { sfx, useAudioScene } from '../audio/useAudioScene';
import { KeeperPortrait } from '../components/characters';
import { LevelPill } from '../components/game';
import { Screen } from '../components/Screen';
import { Chip, GText, GhostButton, IconButton, Panel, PrimaryButton, ProgressBar, TextField } from '../components/ui';
import { ACHIEVEMENTS, COSMETICS } from '../domain/constants';
import { formatShortDate } from '../domain/dates';
import { useProgress } from '../hooks/useKeeperData';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { signOut } from '../services/auth';
import { queueProfileUpdate, runSync } from '../services/sync';
import { useKeeper } from '../store/keeperStore';
import { useSession } from '../store/sessionStore';
import { useSettings } from '../store/settingsStore';
import { toast } from '../store/uiStore';
import { colors } from '../theme';

type Props = CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Profile'>, NativeStackScreenProps<RootStackParamList>>;

export function ProfileScreen({ navigation }: Props) {
  useAudioScene('profile');
  const status = useSession(s => s.status);
  const email = useSession(s => s.email);
  const name = useKeeper(s => s.displayName);
  const setDisplayName = useKeeper(s => s.setDisplayName);
  const pendingOps = useKeeper(s => s.pendingOps);
  const sync = useKeeper(s => s.sync);
  const cosmetic = useSettings(s => s.equippedCosmetic);
  const update = useSettings(s => s.update);
  const { display, level } = useProgress();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [syncing, setSyncing] = useState(false);

  const unlockedCosmetics = new Set(['default', ...display.achievements.map(a => ACHIEVEMENTS.find(x => x.id === a.id)?.cosmetic).filter((c): c is string => !!c)]);

  const saveName = async () => {
    const v = draft.trim().slice(0, 40);
    if (v.length < 2) return;
    await setDisplayName(v);
    if (status === 'signedIn') await queueProfileUpdate({ display_name: v });
    setEditing(false);
    sfx('spell');
  };

  const confirmSignOut = () => {
    Alert.alert(
      'Leave the Graveyard?',
      pendingOps > 0 ? `${pendingOps} change(s) have not synced yet and will be lost on this device.` : 'Your progress is safe on the server. Local data on this device will be cleared.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  };

  const syncNow = async () => {
    setSyncing(true);
    await runSync();
    setSyncing(false);
    const s = useKeeper.getState().sync;
    toast(s.error ? { tone: 'error', title: 'Sync incomplete', message: s.error } : { tone: 'keeper', title: 'Ledger verified', message: 'Your progress is in sync with the Graveyard.' });
  };

  return (
    <Screen art="haunted" dim={0.7} title="Keeper" right={<IconButton image={images.iconSettings} label="Settings" onPress={() => navigation.navigate('Settings')} />}>
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <KeeperPortrait size={88} cosmetic={cosmetic} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            {editing ? (
              <TextField label="Keeper name" value={draft} onChangeText={setDraft} maxLength={40} autoFocus onSubmitEditing={saveName} />
            ) : (
              <GText variant="title" numberOfLines={1}>
                {name}
              </GText>
            )}
            <GText variant="caption" muted numberOfLines={1}>
              {status === 'guest' ? 'Wandering Keeper · offline only' : email}
            </GText>
            <View style={{ flexDirection: 'row', marginTop: 6 }}>
              <LevelPill level={level.level} />
            </View>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <ProgressBar ratio={level.ratio} color={colors.purpleSoft} />
          <GText variant="caption" muted style={{ marginTop: 4 }}>
            {display.stats.xp} XP total · {level.current}/{level.needed} to level {level.level + 1}
          </GText>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {editing ? (
            <>
              <PrimaryButton label="Save" onPress={saveName} style={{ flex: 1, paddingVertical: 8 }} />
              <GhostButton label="Cancel" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            </>
          ) : (
            <GhostButton label="Rename Keeper" onPress={() => { setDraft(name); setEditing(true); }} style={{ flex: 1 }} />
          )}
        </View>
      </Panel>

      <Panel title="Cosmetics" icon={images.chestBig}>
        <GText variant="caption" muted style={{ marginBottom: 8 }}>
          Unlock auras by earning achievements.
        </GText>
        <View style={styles.wrap}>
          {COSMETICS.map(c => {
            const has = unlockedCosmetics.has(c.id);
            return <Chip key={c.id} label={has ? c.name : `🔒 ${c.name}`} active={cosmetic === c.id} color={c.ring} onPress={() => (has ? update({ equippedCosmetic: c.id }) : toast({ tone: 'info', title: 'Locked cosmetic', message: 'Earn the matching achievement to unlock it.' }))} />;
          })}
        </View>
      </Panel>

      <Panel title="Sync" icon={images.potion}>
        {status === 'guest' ? (
          <>
            <GText variant="body" muted>
              Offline Keeper progress lives only on this device. Create an account to verify rewards on the server and use the Dark Keeper AI. Your local progress will be submitted for verification.
            </GText>
            <PrimaryButton label="Create account / Sign in" style={{ marginTop: 12 }} onPress={() => useSession.getState().setSignedOut()} />
          </>
        ) : (
          <>
            <GText variant="body">
              {sync.online ? 'Connected' : 'Offline'} · {pendingOps} pending change{pendingOps === 1 ? '' : 's'}
            </GText>
            <GText variant="caption" muted>
              {sync.lastAt ? `Last verified ${formatShortDate(sync.lastAt)}` : 'Not synced yet'}
              {sync.error ? ` · ${sync.error}` : ''}
            </GText>
            <PrimaryButton label={syncing ? 'Syncing…' : 'Sync now'} disabled={syncing} style={{ marginTop: 12 }} onPress={syncNow} />
          </>
        )}
      </Panel>

      <View style={{ gap: 10 }}>
        <GhostButton label="Achievements" onPress={() => navigation.navigate('Achievements')} />
        <GhostButton label="Focus Chamber" onPress={() => navigation.navigate('Focus')} />
        <GhostButton label="Settings" onPress={() => navigation.navigate('Settings')} />
        {status === 'signedIn' ? <GhostButton label="Sign out" color={colors.red} onPress={confirmSignOut} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
