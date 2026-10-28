import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from './auth-provider';
import { authErrorMessage } from './model';
import { ActionButton, AuthShell, Notice, styles, colors } from './ui';

export function AccountScreen() {
  const { session, actions } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = typeof session?.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : 'Traveler';
  const logout = async () => {
    setBusy(true); setError('');
    try { await actions!.logout(); } catch (error) { setError(authErrorMessage(error)); }
    finally { setBusy(false); }
  };
  return <AuthShell>
    <Text style={[styles.label, { color: colors.success }]}>SIGNED IN</Text>
    <Text accessibilityRole="header" style={styles.title}>Welcome, {name}</Text>
    <Text style={styles.description}>Your account is ready for your next journey.</Text>
    <Text style={styles.label}>Email address</Text>
    <Text selectable style={styles.description}>{session?.user.email}</Text>
    <Notice text="Flight search and booking will arrive in the next milestone." success />
    <Notice text={error} />
    <ActionButton title="Sign out" busy={busy} secondary onPress={() => void logout()} />
  </AuthShell>;
}
