import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { images } from '../assets/images';
import { audio } from '../audio/AudioEngine';
import { sfx } from '../audio/useAudioScene';
import { HauntedBackground } from '../components/HauntedBackground';
import { GText, GhostButton, Panel, PrimaryButton, PressableScale, TextField } from '../components/ui';
import { isBackendConfigured } from '../config/env';
import type { RootScreenProps } from '../navigation/types';
import { confirmPasswordReset, sendPasswordReset, signIn, signUp } from '../services/auth';
import { useSession } from '../store/sessionStore';
import { colors } from '../theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    audio.setScene('splash');
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <HauntedBackground art="haunted" dim={0.55} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
          <Image source={images.logo} style={styles.logo} resizeMode="contain" accessibilityLabel="Graveyard" />
          <GText variant="title" style={styles.center} accessibilityRole="header">
            {title}
          </GText>
          <GText variant="body" muted style={[styles.center, { marginBottom: 18 }]}>
            {subtitle}
          </GText>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function BackendNotice() {
  if (isBackendConfigured()) return null;
  return (
    <Panel style={{ borderColor: colors.goldDeep }}>
      <GText variant="body" color={colors.gold} style={{ fontWeight: '800' }}>
        Backend not configured
      </GText>
      <GText variant="caption" muted>
        Add your Supabase URL and anon key in src/config/env.ts to enable accounts, cloud sync and the Dark Keeper AI. You can still play fully offline.
      </GText>
    </Panel>
  );
}

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <GText variant="body" color={colors.red} style={{ marginBottom: 12 }} accessibilityLiveRegion="assertive">
      {message}
    </GText>
  );
}

export function SignInScreen({ navigation }: RootScreenProps<'SignIn'>) {
  const setGuest = useSession(s => s.setGuest);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isBackendConfigured();

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      sfx('doorCreak');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back, Keeper" subtitle="Sign in to restore your Graveyard on any device.">
      <BackendNotice />
      <Panel>
        <ErrorText message={error} />
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="keeper@graveyard.app" editable={configured} />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" placeholder="••••••••" editable={configured} onSubmitEditing={submit} />
        <PrimaryButton label={busy ? 'Opening the gate…' : 'Sign in'} disabled={busy || !configured} onPress={submit} sound={null} />
        <PressableScale style={styles.link} onPress={() => navigation.navigate('ForgotPassword')} disabled={!configured} accessibilityLabel="Forgot password">
          <GText variant="body" color={colors.purpleSoft}>
            Forgot password?
          </GText>
        </PressableScale>
      </Panel>
      <GhostButton label="Create a new Keeper" onPress={() => navigation.navigate('SignUp')} style={{ marginBottom: 10, opacity: configured ? 1 : 0.5 }} />
      <GhostButton
        label="Continue offline as a Wandering Keeper"
        color={colors.gold}
        onPress={() => {
          sfx('ghost');
          setGuest();
        }}
      />
      <GText variant="caption" muted style={[styles.center, { marginTop: 10 }]}>
        Offline progress stays on this device. Create an account later to verify rewards and sync.
      </GText>
    </AuthShell>
  );
}

export function SignUpScreen({ navigation }: RootScreenProps<'SignUp'>) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim().length < 2) return setError('Choose a Keeper name (at least 2 characters).');
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp(name, email, password);
      sfx('spell');
      if (needsConfirmation) setNotice('Check your inbox to confirm your email, then sign in.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Become a Keeper" subtitle="Your quests will awaken the forgotten souls.">
      <BackendNotice />
      <Panel>
        <ErrorText message={error} />
        {notice ? (
          <GText variant="body" color={colors.green} style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">
            {notice}
          </GText>
        ) : null}
        <TextField label="Keeper name" value={name} onChangeText={setName} maxLength={40} placeholder="Raven" autoComplete="name" />
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextField label="Password (min. 8 characters)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <TextField label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} />
        <PrimaryButton label={busy ? 'Binding your soul…' : 'Create account'} disabled={busy || !isBackendConfigured()} onPress={submit} sound={null} />
      </Panel>
      <GhostButton label="I already have an account" onPress={() => (notice ? navigation.navigate('SignIn') : navigation.goBack())} />
    </AuthShell>
  );
}

export function ForgotPasswordScreen({ navigation }: RootScreenProps<'ForgotPassword'>) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6,10}$/.test(code.trim())) return setError('Enter the code from the email.');
    if (password.length < 8) return setError('New password must be at least 8 characters.');
    setBusy(true);
    setError(null);
    try {
      await confirmPasswordReset(email, code, password);
      setDone(true);
      sfx('spell');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Recover your lantern" subtitle={step === 'email' ? 'We will send a recovery code to your email.' : `Enter the code sent to ${email}.`}>
      <Panel>
        <ErrorText message={error} />
        {done ? (
          <GText variant="body" color={colors.green}>
            Password updated. You are signed in.
          </GText>
        ) : step === 'email' ? (
          <>
            <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <PrimaryButton label={busy ? 'Sending…' : 'Send recovery code'} disabled={busy} onPress={send} sound={null} />
          </>
        ) : (
          <>
            <TextField label="Recovery code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={10} autoComplete="one-time-code" />
            <TextField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <PrimaryButton label={busy ? 'Restoring…' : 'Set new password'} disabled={busy} onPress={confirm} sound={null} />
          </>
        )}
      </Panel>
      <GhostButton label="Back to sign in" onPress={() => navigation.goBack()} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  logo: { width: '80%', height: 150, alignSelf: 'center', marginBottom: 8 },
  center: { textAlign: 'center' },
  link: { alignItems: 'center', justifyContent: 'center', marginTop: 10 },
});
