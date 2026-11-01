import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Text } from 'react-native';

import { supabase } from '@/lib/supabase';
import { createProfileService, profileErrorMessage, profileSchema, type Profile, type ProfileInput } from '@/features/profile/model';
import { useAuth } from './auth-provider';
import {
  authErrorMessage, changePasswordSchema, type ChangePasswordInput,
} from './model';
import { ActionButton, AuthShell, FormField, Notice, styles, colors } from './ui';

type Mode = 'overview' | 'profile' | 'password';
type ProfileState = { ownerId: string; status: 'loading' | 'ready' | 'error'; profile: Profile | null; error: string };
const profileService = supabase ? createProfileService(supabase) : null;

export function AccountScreen() {
  const { session, actions } = useAuth();
  const userId = session?.user.id ?? '';
  const [mode, setMode] = useState<Mode>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [profileState, setProfileState] = useState<ProfileState>({ ownerId: '', status: 'loading', profile: null, error: '' });
  useEffect(() => {
    let active = true;
    if (!profileService || !userId) return;
    profileService.load(userId).then(profile => {
      if (active) setProfileState({ ownerId: userId, status: 'ready', profile, error: '' });
    }).catch(error => {
      if (active) setProfileState({ ownerId: userId, status: 'error', profile: null, error: profileErrorMessage(error) });
    });
    return () => { active = false; };
  }, [userId, reload]);
  const current = !profileService || !userId
    ? { status: 'error' as const, profile: null, error: 'Không thể tải hồ sơ.' }
    : profileState.ownerId === userId ? profileState : { status: 'loading' as const, profile: null, error: '' };
  const profile = current.profile;
  const fullName = profile?.full_name ?? '';
  const contactPhone = profile?.contact_phone ?? '';
  const logout = async () => {
    setBusy(true); setError('');
    try { await actions!.logout(); } catch (error) { setError(authErrorMessage(error)); }
    finally { setBusy(false); }
  };
  const saved = (text: string) => { setMessage(text); setMode('overview'); };

  return <AuthShell>
    {mode === 'profile' && profile && <ProfileForm key={userId} userId={userId} profile={profile}
      onSaved={updated => {
        setProfileState({ ownerId: userId, status: 'ready', profile: updated, error: '' });
        saved('Đã cập nhật hồ sơ.');
      }} onBack={() => setMode('overview')} />}
    {mode === 'password' && <ChangePasswordForm onSaved={() => saved('Đã đổi mật khẩu.')}
      onBack={() => setMode('overview')} />}
    {(mode === 'overview' || (mode === 'profile' && !profile)) && <>
      <Text style={[styles.label, { color: colors.success }]}>ĐÃ ĐĂNG NHẬP</Text>
      <Text accessibilityRole="header" style={styles.title}>Xin chào, {fullName || 'bạn'}</Text>
      <Text style={styles.description}>Cập nhật thông tin liên hệ để nhận tin về các đơn vé sau này.</Text>
      <Text style={styles.label}>Email</Text>
      <Text selectable style={styles.description}>{session?.user.email}</Text>
      {current.status === 'loading' && <ActivityIndicator color={colors.primary} accessibilityLabel="Đang tải hồ sơ" />}
      {current.status === 'error' && <><Notice text={current.error} />
        <ActionButton title="Thử tải lại hồ sơ" secondary onPress={() => {
          setProfileState({ ownerId: userId, status: 'loading', profile: null, error: '' });
          setReload(value => value + 1);
        }} /></>}
      <Text style={styles.label}>Họ và tên</Text>
      <Text style={styles.description}>{fullName || (current.status === 'ready' ? 'Chưa cập nhật' : '—')}</Text>
      <Text style={styles.label}>Số điện thoại liên hệ</Text>
      <Text style={styles.description}>{contactPhone || (current.status === 'ready' ? 'Chưa cập nhật' : '—')}</Text>
      <Notice text={message} success />
      <Notice text={error} />
      <ActionButton title="Sửa hồ sơ" disabled={busy || current.status !== 'ready'} onPress={() => { setMessage(''); setMode('profile'); }} />
      <ActionButton title="Đổi mật khẩu" secondary disabled={busy} onPress={() => { setMessage(''); setMode('password'); }} />
      <ActionButton title="Đăng xuất" busy={busy} secondary onPress={() => void logout()} />
      <ActionButton title="Về trang chủ" secondary disabled={busy} onPress={() => router.push('/')} />
    </>}
  </AuthShell>;
}

function ProfileForm({ userId, profile, onSaved, onBack }: {
  userId: string; profile: Profile; onSaved: (profile: Profile) => void; onBack: () => void;
}) {
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: profile.full_name, contactPhone: profile.contact_phone ?? '' },
  });
  const submit = handleSubmit(async values => {
    setError('');
    try { onSaved(await profileService!.save(userId, values)); }
    catch (error) { setError(profileErrorMessage(error)); }
  });
  return <>
    <Text accessibilityRole="header" style={styles.title}>Hồ sơ của bạn</Text>
    <Text style={styles.description}>Số điện thoại liên hệ cần mã quốc gia, ví dụ +84912345678. Thông tin này không thay đổi cách đăng nhập.</Text>
    <FormField control={control} name="fullName" label="Họ và tên" autoComplete="name" autoCapitalize="words"
      editable={!isSubmitting} />
    <FormField control={control} name="contactPhone" label="Số điện thoại liên hệ" keyboardType="phone-pad"
      autoComplete="tel" editable={!isSubmitting} placeholder="+84912345678" />
    <Notice text={error} />
    <ActionButton title="Lưu hồ sơ" busy={isSubmitting} onPress={() => void submit()} />
    <ActionButton title="Về tài khoản" secondary disabled={isSubmitting} onPress={onBack} />
  </>;
}

function ChangePasswordForm({ onSaved, onBack }: { onSaved: () => void; onBack: () => void }) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });
  const submit = handleSubmit(async values => {
    setError('');
    try { await actions!.changePassword(values); onSaved(); }
    catch (error) { setError(authErrorMessage(error)); }
  });
  return <>
    <Text accessibilityRole="header" style={styles.title}>Đổi mật khẩu</Text>
    <Text style={styles.description}>Nhập mật khẩu hiện tại rồi chọn mật khẩu mới.</Text>
    <FormField control={control} name="currentPassword" label="Mật khẩu hiện tại" password
      autoComplete="current-password" autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} />
    <FormField control={control} name="password" label="Mật khẩu mới" password
      autoComplete="new-password" autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} />
    <FormField control={control} name="confirmPassword" label="Nhập lại mật khẩu mới" password
      autoComplete="new-password" autoCapitalize="none" autoCorrect={false} editable={!isSubmitting} />
    <Notice text={error} />
    <ActionButton title="Cập nhật mật khẩu" busy={isSubmitting} onPress={() => void submit()} />
    <ActionButton title="Về tài khoản" secondary disabled={isSubmitting} onPress={onBack} />
  </>;
}
