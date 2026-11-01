import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text } from 'react-native';

import { useAuth } from './auth-provider';
import { useAdmin } from './use-admin';
import {
  authErrorMessage, changePasswordSchema, profileSchema,
  type ChangePasswordInput, type ProfileInput,
} from './model';
import { ActionButton, AuthShell, FormField, Notice, styles, colors } from './ui';

type Mode = 'overview' | 'profile' | 'password';

export function AccountScreen() {
  const { session, actions } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [mode, setMode] = useState<Mode>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const metadata = session?.user.user_metadata;
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name : '';
  const contactPhone = typeof metadata?.contact_phone === 'string' ? metadata.contact_phone : '';
  const logout = async () => {
    setBusy(true); setError('');
    try { await actions!.logout(); } catch (error) { setError(authErrorMessage(error)); }
    finally { setBusy(false); }
  };
  const saved = (text: string) => { setMessage(text); setMode('overview'); };

  return <AuthShell>
    {mode === 'profile' && <ProfileForm fullName={fullName} contactPhone={contactPhone}
      onSaved={() => saved('Đã cập nhật hồ sơ.')} onBack={() => setMode('overview')} />}
    {mode === 'password' && <ChangePasswordForm onSaved={() => saved('Đã đổi mật khẩu.')}
      onBack={() => setMode('overview')} />}
    {mode === 'overview' && <>
      <Text style={[styles.label, { color: colors.success }]}>
        ĐÃ ĐĂNG NHẬP{isAdmin ? ' • QUẢN TRỊ VIÊN' : ''}
      </Text>
      <Text accessibilityRole="header" style={styles.title}>Xin chào, {fullName || 'bạn'}</Text>
      <Text style={styles.description}>Cập nhật thông tin liên hệ để nhận tin về các đơn vé sau này.</Text>
      <Text style={styles.label}>Vai trò</Text>
      <Text style={styles.description}>{adminLoading ? 'Đang kiểm tra…' : (isAdmin ? 'Quản trị viên (Admin)' : 'Khách hàng')}</Text>
      <Text style={styles.label}>Email</Text>
      <Text selectable style={styles.description}>{session?.user.email}</Text>
      <Text style={styles.label}>Họ và tên</Text>
      <Text style={styles.description}>{fullName || 'Chưa cập nhật'}</Text>
      <Text style={styles.label}>Số điện thoại liên hệ</Text>
      <Text style={styles.description}>{contactPhone || 'Chưa cập nhật'}</Text>
      <Notice text={message} success />
      <Notice text={error} />
      <ActionButton title="Sửa hồ sơ" disabled={busy} onPress={() => { setMessage(''); setMode('profile'); }} />
      <ActionButton title="Đổi mật khẩu" secondary disabled={busy} onPress={() => { setMessage(''); setMode('password'); }} />
      <ActionButton title="Đăng xuất" busy={busy} secondary onPress={() => void logout()} />
    </>}
  </AuthShell>;
}

function ProfileForm({ fullName, contactPhone, onSaved, onBack }: {
  fullName: string; contactPhone: string; onSaved: () => void; onBack: () => void;
}) {
  const { actions } = useAuth();
  const [error, setError] = useState('');
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema), defaultValues: { fullName, contactPhone },
  });
  const submit = handleSubmit(async values => {
    setError('');
    try { await actions!.updateProfile(values); onSaved(); }
    catch (error) { setError(authErrorMessage(error)); }
  });
  return <>
    <Text accessibilityRole="header" style={styles.title}>Hồ sơ của bạn</Text>
    <Text style={styles.description}>Số điện thoại này dùng để liên hệ về đơn vé, không thay đổi cách đăng nhập.</Text>
    <FormField control={control} name="fullName" label="Họ và tên" autoComplete="name" autoCapitalize="words"
      editable={!isSubmitting} />
    <FormField control={control} name="contactPhone" label="Số điện thoại liên hệ" keyboardType="phone-pad"
      autoComplete="tel" editable={!isSubmitting} placeholder="+84 912 345 678" />
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
