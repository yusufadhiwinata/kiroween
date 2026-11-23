import { getSupabase } from './supabase';
import { useKeeper } from '../store/keeperStore';
import { useSession } from '../store/sessionStore';

function requireClient() {
  const sb = getSupabase();
  if (!sb) throw new Error('The Graveyard backend is not configured. Continue offline or add Supabase keys.');
  return sb;
}

const friendly = (message: string) => {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is incorrect.';
  if (m.includes('already registered')) return 'This email already has a Keeper. Try signing in.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('network')) return 'No connection to the Graveyard. Check your internet.';
  return message;
};

export async function signIn(email: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendly(error.message));
  return data;
}

export async function signUp(displayName: string, email: string, password: string) {
  const { data, error } = await requireClient().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim().slice(0, 40) } },
  });
  if (error) throw new Error(friendly(error.message));
  return { needsConfirmation: !data.session };
}

/** Sends a recovery email; the email template must include {{ .Token }} (6-digit code). */
export async function sendPasswordReset(email: string) {
  const { error } = await requireClient().auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(friendly(error.message));
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string) {
  const sb = requireClient();
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
  if (error) throw new Error(friendly(error.message));
  const { error: updateError } = await sb.auth.updateUser({ password: newPassword });
  if (updateError) throw new Error(friendly(updateError.message));
}

export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut().catch(() => undefined);
  await useKeeper.getState().signOutWipe();
  useSession.getState().setSignedOut();
}
