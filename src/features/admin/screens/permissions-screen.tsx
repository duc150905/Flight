import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { ActionButton, Notice } from '@/features/auth/ui';
import { supabase } from '@/lib/supabase';
import { loadAllAuditLogs, loadAllRows } from '../complete-data';
import { useAdminI18n } from '../i18n';
import { filterAndPaginate, type ProfileRow } from '../model';
import { permissionsStore, type LocalPermissionEvent } from '../permissions-store';
import {
  AdminLoadingState,
  AdminPaginationBar,
  AdminShell,
  adminStyles,
} from '../ui';

type PermissionTab = 'accounts' | 'roles';
type RoleFilter = 'all' | 'admin' | 'customer';

type SystemRoleKey = 'admin' | 'customer';

type BookingContactRow = {
  id: string;
  user_id: string;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
};

type RealAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: SystemRoleKey;
  status: 'active' | 'suspended';
  createdAt: string;
  lastActive: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
};


const SYSTEM_ROLES: Record<
  SystemRoleKey,
  {
    key: SystemRoleKey;
    nameVi: string;
    nameEn: string;
    descriptionVi: string;
    descriptionEn: string;
    color: string;
    badgeBg: string;
    icon: string;
    permissionsVi: string[];
    permissionsEn: string[];
    restrictionsVi?: string[];
    restrictionsEn?: string[];
  }
> = {
  admin: {
    key: 'admin',
    nameVi: 'Quản trị viên (Admin)',
    nameEn: 'System Administrator',
    descriptionVi:
      'Toàn quyền truy cập và vận hành hệ thống Flyora Back-office: Quản lý chuyến bay, Đơn hàng, Tàu bay, Danh mục và Phân quyền tài khoản.',
    descriptionEn:
      'Full administrative access to operate Flyora Back-office: Flight schedules, Bookings, Fleet, Catalogues, and Access Control.',
    color: '#0891B2',
    badgeBg: '#ECFEFF',
    icon: '🛡️',
    permissionsVi: [
      'Quản lý toàn bộ chuyến bay (Thêm, sửa, mở/đóng bán vé, cấu hình ghế)',
      'Quản lý đội tàu bay và sơ đồ ghế 4 hạng cabin (First, Business, Premium, Economy)',
      'Quản lý danh mục sân bay, hãng bay, điểm đến, gói dịch vụ phụ trợ',
      'Tra cứu toàn bộ đơn đặt vé hành khách và phê duyệt xử lý hoàn tiền trực tuyến',
      'Xem báo cáo tài chính, biểu đồ doanh thu và nhật ký kiểm toán bất biến (Audit logs)',
      'Cấp quyền và quản lý tài khoản Quản trị viên trong hệ thống',
    ],
    permissionsEn: [
      'Full control over flight schedules, sales status, and seat availability',
      'Fleet management and 4-cabin aircraft seat configuration',
      'Master catalogues management: airports, airlines, destinations, add-on products',
      'Inspect bookings, traveler manifests, and process refund requests',
      'Access financial analytics, revenue charts, and immutable audit logs',
      'Grant and manage admin privileges across user accounts',
    ],
  },
  customer: {
    key: 'customer',
    nameVi: 'Khách hàng (Customer)',
    nameEn: 'Customer / Traveler',
    descriptionVi:
      'Tài khoản người dùng đăng ký trên Flyora. Được phép tìm kiếm chuyến bay, đặt vé và quản lý đơn hàng cá nhân.',
    descriptionEn:
      'Registered traveler account on Flyora. Allowed to search flights, make bookings, and manage personal profile.',
    color: '#475569',
    badgeBg: '#F1F5F9',
    icon: '👤',
    permissionsVi: [
      'Tìm kiếm chuyến bay một chiều, khứ hồi và nhiều chặng',
      'Đặt vé máy bay, chọn ghế ngồi và mua kèm dịch vụ bổ sung (hành lý, suất ăn)',
      'Thanh toán đơn hàng trực tuyến và nhận mã vé điện tử tức thì',
      'Xem lịch sử đơn đặt vé trong Vé của tôi và cập nhật thông tin cá nhân',
    ],
    permissionsEn: [
      'Search one-way, round-trip, and multi-city flights',
      'Book flight tickets, pick seats, and add extra baggage or meals',
      'Online payment and electronic booking confirmation in My Bookings',
      'Manage personal profile and travel history',
    ],
    restrictionsVi: [
      'Không được phép truy cập Flyora Admin Console',
      'Không thể xem dữ liệu tài chính hoặc thông tin của người dùng khác',
    ],
    restrictionsEn: [
      'No access to Flyora Admin Console',
      'Cannot view financial data or other users records',
    ],
  },
};

const AVATAR_PALETTES = [
  { bg: '#E0F2FE', color: '#0369A1' },
  { bg: '#EDE9FE', color: '#6D28D9' },
  { bg: '#FEF3C7', color: '#B45309' },
  { bg: '#DCFCE7', color: '#15803D' },
  { bg: '#FCE7F3', color: '#BE185D' },
  { bg: '#F1F5F9', color: '#334155' },
];

function getAvatarColors(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelativeTime(
  dateStr: string,
  airportTime: (d: string, tz: string) => string,
  bi: (vi: string, en: string) => string,
): string {
  try {
    const timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) return dateStr;
    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return bi('Vừa xong', 'Just now');
    if (diffMinutes < 60) return bi(`${diffMinutes} phút trước`, `${diffMinutes}m ago`);
    if (diffHours < 24) return bi(`${diffHours} giờ trước`, `${diffHours}h ago`);
    if (diffDays === 1) return bi('Hôm qua', 'Yesterday');
    if (diffDays < 7) return bi(`${diffDays} ngày trước`, `${diffDays}d ago`);
    return airportTime(dateStr, 'Asia/Ho_Chi_Minh');
  } catch {
    return dateStr;
  }
}

async function loadStaffAndPermissionsBundle() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const [profilesRes, bookingsRes, auditLogs] = await Promise.all([
    loadAllRows<ProfileRow>((from, to) =>
      supabase!.from('profiles').select('*').order('created_at', { ascending: false }).order('id').range(from, to),
    ),
    loadAllRows<BookingContactRow>((from, to) =>
      supabase!.from('bookings').select('id, user_id, contact_email, contact_phone, created_at').order('id').range(from, to),
    ),
    loadAllAuditLogs(supabase),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const adminActorIds = new Set<string>();
  for (const log of auditLogs) {
    if (log.actor_user_id) adminActorIds.add(log.actor_user_id);
  }

  return {
    profiles: profilesRes.data ?? [],
    bookings: bookingsRes.data ?? [],
    auditLogs: auditLogs ?? [],
    adminActorIds: Array.from(adminActorIds),
    fetchedAtMs: Date.now(),
  };
}

export function AdminPermissionsScreen() {
  const { bi, airportTime } = useAdminI18n();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [tab, setTab] = useState<PermissionTab>('accounts');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [page, setPage] = useState(1);

  // Modals & local state
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState<RealAccount | null>(null);

  // Local admin promotion & suspension sets (persisted in module cache + AsyncStorage)
  const [promotedAdminIds, setPromotedAdminIds] = useState<Set<string>>(() => new Set(permissionsStore.promotedIds));
  const [revokedAdminIds, setRevokedAdminIds] = useState<Set<string>>(() => new Set(permissionsStore.revokedIds));
  const [suspendedIds, setSuspendedIds] = useState<Set<string>>(() => new Set(permissionsStore.suspendedIds));
  const [localAuditEvents, setLocalAuditEvents] = useState<LocalPermissionEvent[]>(() => [...permissionsStore.auditEvents]);

  useEffect(() => {
    permissionsStore.load().then((stored) => {
      setPromotedAdminIds(new Set(stored.promoted));
      setRevokedAdminIds(new Set(stored.revoked));
      setSuspendedIds(new Set(stored.suspended));
      setLocalAuditEvents([...stored.events]);
    });
  }, []);

  const [formSuccess, setFormSuccess] = useState('');

  const queryBundle = useQuery({
    queryKey: ['admin-permissions-bundle'],
    queryFn: loadStaffAndPermissionsBundle,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const rawProfiles = useMemo(() => queryBundle.data?.profiles ?? [], [queryBundle.data?.profiles]);
  const rawBookings = queryBundle.data?.bookings ?? [];
  const rawAuditLogs = queryBundle.data?.auditLogs ?? [];
  const dbAdminActorIds = queryBundle.data?.adminActorIds ?? [];

  // Map bookings and emails by user
  const bookingsByUser = new Map<string, BookingContactRow[]>();
  for (const b of rawBookings) {
    const list = bookingsByUser.get(b.user_id) ?? [];
    list.push(b);
    bookingsByUser.set(b.user_id, list);
  }

  // Profile lookup
  const profileById = new Map<string, ProfileRow>();
  for (const p of rawProfiles) {
    profileById.set(p.id, p);
  }

  // Effective Admin ID Set: (db admins + current user + promoted) - revoked
  const effectiveAdminIdSet = new Set<string>(dbAdminActorIds);
  if (session?.user?.id) {
    effectiveAdminIdSet.add(session.user.id);
  }
  for (const id of promotedAdminIds) {
    effectiveAdminIdSet.add(id);
  }
  for (const id of revokedAdminIds) {
    effectiveAdminIdSet.delete(id);
  }

  const [selfName, setSelfName] = useState<string>('');

  useEffect(() => {
    if (!session?.user?.id || !supabase) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data: prof }) => {
        if (prof?.full_name?.trim()) {
          setSelfName(prof.full_name.trim());
        }
      });
  }, [session?.user?.id]);

  // Resolve current user display name (prefer database profile full_name over email prefix)
  const currentProfile = session?.user?.id ? profileById.get(session.user.id) : undefined;
  const adminActorProfile = dbAdminActorIds
    .map((id) => profileById.get(id))
    .find((p) => Boolean(p?.full_name?.trim()));

  const candidateName =
    selfName ||
    currentProfile?.full_name?.trim() ||
    (session?.user?.user_metadata?.full_name as string | undefined)?.trim() ||
    adminActorProfile?.full_name?.trim();

  const isGenericOrHash = !candidateName || /^bnvawg/i.test(candidateName) || candidateName === 'Admin';
  const currentUserName = isGenericOrHash ? (session?.user?.email?.split('@')[0] ?? 'Admin') : candidateName;

  useEffect(() => {
    permissionsStore.syncActorName(session?.user?.id ?? null, currentUserName);
    const caGiaProfile = rawProfiles.find(
      (p) => p.full_name?.trim() === 'Ca Gia' || p.id.toLowerCase().startsWith('1c2fbe'),
    );
    if (caGiaProfile?.full_name?.trim()) {
      permissionsStore.syncTargetName('1c2fbe', caGiaProfile.full_name.trim());
    }
  }, [session?.user?.id, currentUserName, rawProfiles]);

  // Build Real Account objects
  const accounts: RealAccount[] = rawProfiles.map((p) => {
    const userBks = bookingsByUser.get(p.id) ?? [];
    const isCurrent = session?.user?.id === p.id;
    const bEmail = userBks.find((b) => b.contact_email?.trim())?.contact_email;
    const email = isCurrent
      ? session?.user?.email ?? 'admin@flyora.vn'
      : bEmail || (p.contact_phone ? `${p.contact_phone.replace(/\D/g, '')}@flyora.vn` : `user_${p.id.slice(0, 6)}@flyora.vn`);

    const phone = p.contact_phone || userBks.find((b) => b.contact_phone?.trim())?.contact_phone || '';
    const isAdmin = effectiveAdminIdSet.has(p.id);
    const isSuspended = suspendedIds.has(p.id);

    // Latest activity
    let latestTime = p.created_at;
    if (userBks.length > 0 && userBks[0].created_at > latestTime) {
      latestTime = userBks[0].created_at;
    }

    const colors = getAvatarColors(p.id + p.full_name);

    return {
      id: p.id,
      name: p.full_name?.trim() || bi('Người dùng Flyora', 'Flyora User'),
      email,
      phone,
      role: isAdmin ? 'admin' : 'customer',
      status: isSuspended ? 'suspended' : 'active',
      createdAt: p.created_at,
      lastActive: latestTime,
      initials: getInitials(p.full_name || 'Flyora'),
      avatarBg: colors.bg,
      avatarColor: colors.color,
    };
  });

  // Merge any accounts from local permission store that are hidden by database RLS
  const existingIds = new Set(accounts.map((a) => a.id));
  for (const evt of localAuditEvents) {
    const rawTargetId = evt.targetUserId || '';
    const matchId = evt.subtitle.match(/ID:\s*#([a-f0-9]+)/i)?.[1];
    const targetId = rawTargetId || (matchId ? `user_${matchId}` : '');
    if (!targetId) continue;
    if (existingIds.has(targetId)) {
      const existing = accounts.find((a) => a.id === targetId);
      if (existing) {
        existing.role = effectiveAdminIdSet.has(targetId) ? 'admin' : 'customer';
        existing.status = suspendedIds.has(targetId) ? 'suspended' : 'active';
      }
      continue;
    }
    existingIds.add(targetId);
    const isAdm = effectiveAdminIdSet.has(targetId);
    const isSusp = suspendedIds.has(targetId);
    const name = evt.targetName || 'Flyora User';
    const colors = getAvatarColors(targetId + name);
    accounts.push({
      id: targetId,
      name,
      email: evt.targetEmail || 'user@flyora.vn',
      phone: '',
      role: isAdm ? 'admin' : 'customer',
      status: isSusp ? 'suspended' : 'active',
      createdAt: evt.createdAt,
      lastActive: evt.createdAt,
      initials: getInitials(name),
      avatarBg: colors.bg,
      avatarColor: colors.color,
    });
  }

  // Metrics
  const totalAccounts = accounts.length;
  const adminAccountsCount = accounts.filter((a) => a.role === 'admin').length;
  const customerAccountsCount = accounts.filter((a) => a.role === 'customer').length;
  const totalAuditEvents = rawAuditLogs.length + localAuditEvents.length;

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    if (roleFilter !== 'all' && acc.role !== roleFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      acc.name.toLowerCase().includes(q) ||
      acc.email.toLowerCase().includes(q) ||
      acc.phone.toLowerCase().includes(q) ||
      acc.id.toLowerCase().includes(q)
    );
  });

  const pagedAccounts = filterAndPaginate(filteredAccounts, {
    query: '',
    page,
    pageSize: 8,
    getSearchText: (a: RealAccount) => `${a.name} ${a.email} ${a.phone} ${a.id}`,
  });

  // Grant Admin privilege to a user
  const handleGrantAdmin = (account: RealAccount) => {
    permissionsStore.grantAdmin({
      actorId: session?.user?.id ?? null,
      actorName: currentUserName,
      targetUserId: account.id,
      targetName: account.name,
      targetEmail: account.email,
      title: bi(
        `${currentUserName} đã cấp quyền Quản trị viên cho ${account.name}`,
        `${currentUserName} granted Administrator role to ${account.name}`,
      ),
      subtitle: `${account.email} · ID: #${account.id.slice(0, 8)}`,
      timeLabel: bi('Vừa xong', 'Just now'),
    });

    setPromotedAdminIds(new Set(permissionsStore.promotedIds));
    setRevokedAdminIds(new Set(permissionsStore.revokedIds));
    setLocalAuditEvents([...permissionsStore.auditEvents]);

    setFormSuccess(
      bi(
        `Đã cấp quyền Quản trị viên cho tài khoản "${account.name}" thành công!`,
        `Successfully granted Administrator role to "${account.name}"!`,
      ),
    );
    setInviteModalVisible(false);
    setEditingAccount(null);
  };

  // Revoke Admin privilege
  const handleRevokeAdmin = (account: RealAccount) => {
    if (account.id === session?.user?.id) {
      alert(bi('Bạn không thể tự thu hồi quyền quản trị của chính mình.', 'You cannot revoke your own admin rights.'));
      return;
    }

    permissionsStore.revokeAdmin({
      actorId: session?.user?.id ?? null,
      actorName: currentUserName,
      targetUserId: account.id,
      targetName: account.name,
      targetEmail: account.email,
      title: bi(
        `${currentUserName} đã thu hồi quyền Quản trị viên của ${account.name}`,
        `${currentUserName} revoked Administrator role from ${account.name}`,
      ),
      subtitle: `${account.email} · ${bi('Chuyển thành tài khoản Khách hàng', 'Reverted to Customer')}`,
      timeLabel: bi('Vừa xong', 'Just now'),
    });

    setRevokedAdminIds(new Set(permissionsStore.revokedIds));
    setPromotedAdminIds(new Set(permissionsStore.promotedIds));
    setLocalAuditEvents([...permissionsStore.auditEvents]);

    setFormSuccess(
      bi(
        `Đã chuyển tài khoản "${account.name}" về vai trò Khách hàng.`,
        `Reverted "${account.name}" to Customer role.`,
      ),
    );
    setEditingAccount(null);
  };

  // Toggle account active / suspended
  const handleToggleSuspend = (account: RealAccount) => {
    if (account.id === session?.user?.id) {
      alert(bi('Bạn không thể tự tạm dừng tài khoản của chính mình.', 'You cannot suspend your own account.'));
      return;
    }

    const isNowSuspended = !permissionsStore.suspendedIds.has(account.id);
    permissionsStore.toggleSuspend({
      actorId: session?.user?.id ?? null,
      actorName: currentUserName,
      targetUserId: account.id,
      targetName: account.name,
      targetEmail: account.email,
      title: isNowSuspended
        ? bi(
            `${currentUserName} đã tạm dừng tài khoản ${account.name}`,
            `${currentUserName} suspended account ${account.name}`,
          )
        : bi(
            `${currentUserName} đã kích hoạt lại tài khoản ${account.name}`,
            `${currentUserName} re-activated account ${account.name}`,
          ),
      subtitle: `${account.email} · ID: #${account.id.slice(0, 8)}`,
      timeLabel: bi('Vừa xong', 'Just now'),
      isSuspended: isNowSuspended,
    });

    setSuspendedIds(new Set(permissionsStore.suspendedIds));
    setLocalAuditEvents([...permissionsStore.auditEvents]);

    if (isNowSuspended) {
      setFormSuccess(bi(`Đã tạm dừng tài khoản "${account.name}".`, `Suspended "${account.name}".`));
    } else {
      setFormSuccess(bi(`Đã kích hoạt lại tài khoản "${account.name}".`, `Re-activated "${account.name}".`));
    }
    setEditingAccount(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = 'ID,Name,Email,Phone,Role,Status,RegisteredAt,LastActive\n';
    const rows = accounts
      .map(
        (a) =>
          `"${a.id}","${a.name}","${a.email}","${a.phone}","${a.role}","${a.status}","${a.createdAt}","${a.lastActive}"`,
      )
      .join('\n');
    const content = headers + rows;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `flyora-accounts-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Filter candidates for Invite Modal (default to customers, with search)
  const candidateAccounts = accounts.filter((acc) => {
    if (!inviteSearchQuery.trim()) return true;
    const q = inviteSearchQuery.trim().toLowerCase();
    return (
      acc.name.toLowerCase().includes(q) ||
      acc.email.toLowerCase().includes(q) ||
      acc.phone.toLowerCase().includes(q) ||
      acc.id.toLowerCase().includes(q)
    );
  });

  // Unified activities list (local actions first, then database audit logs)
  const allActivities = [
    ...localAuditEvents.map((evt) => {
      const actor = evt.actorId ? profileById.get(evt.actorId) : undefined;
      const realActorName =
        actor?.full_name?.trim() ||
        (session?.user?.id === evt.actorId ? currentUserName : undefined) ||
        (evt.actorName && !/^bnvawg/i.test(evt.actorName) && evt.actorName !== 'Admin'
          ? evt.actorName
          : currentUserName);

      // Dynamically resolve target name from the latest profile data
      let targetId = evt.targetUserId;
      if (!targetId && evt.subtitle) {
        const match = evt.subtitle.match(/ID:\s*#([a-f0-9]+)/i);
        if (match) {
          const shortId = match[1].toLowerCase();
          const found = rawProfiles.find((p) => p.id.toLowerCase().startsWith(shortId));
          if (found) targetId = found.id;
        }
      }
      const targetProfile = targetId ? profileById.get(targetId) : undefined;
      const realTargetName = targetProfile?.full_name?.trim() || evt.targetName;

      let displayTitle = evt.title;
      if (realActorName) {
        displayTitle = displayTitle
          .replace(/^bnvawg87z\b/i, realActorName)
          .replace(/^Admin\b/i, realActorName);
        if (evt.actorName && evt.actorName !== realActorName) {
          displayTitle = displayTitle.replace(new RegExp(`^${evt.actorName}\\b`, 'i'), realActorName);
        }
      }
      if (displayTitle.includes('Ca Gia Bảo')) {
        const caGiaUser = rawProfiles.find(
          (p) => p.full_name?.trim() === 'Ca Gia' || p.id.toLowerCase().startsWith('1c2fbe'),
        );
        if (caGiaUser?.full_name?.trim()) {
          displayTitle = displayTitle.replace(/Ca Gia Bảo/g, caGiaUser.full_name.trim());
        }
      }
      if (realTargetName && evt.targetName && evt.targetName !== realTargetName) {
        displayTitle = displayTitle.split(evt.targetName).join(realTargetName);
      }

      return {
        id: evt.id,
        title: displayTitle,
        subtitle: evt.subtitle,
        time: evt.time || evt.timeLabel || '',
        dotColor: evt.dotColor,
      };
    }),
    ...rawAuditLogs.map((log) => {
      const actor = log.actor_user_id ? profileById.get(log.actor_user_id) : undefined;
      const actorName =
        actor?.full_name?.trim() ||
        (log.actor_user_id ? `Admin #${log.actor_user_id.slice(0, 6)}` : bi('Hệ thống Flyora', 'Flyora System'));

      const entityMap: Record<string, string> = {
        flight_instances: bi('chuyến bay', 'flight'),
        flight_fares: bi('bảng giá vé', 'flight fare'),
        flight_seats: bi('kho ghế chuyến bay', 'flight seats'),
        aircraft: bi('đội tàu bay', 'aircraft'),
        seats: bi('sơ đồ ghế', 'seat map'),
        airports: bi('danh mục sân bay', 'airport'),
        airlines: bi('hãng hàng không', 'airline'),
        destinations: bi('điểm đến', 'destination'),
        addon_products: bi('dịch vụ phụ trợ', 'add-on product'),
        flight_addon_offers: bi('gói dịch vụ', 'add-on offer'),
        bookings: bi('đơn đặt vé', 'booking'),
        user_roles: bi('phân quyền admin', 'admin privileges'),
      };
      const entityName = entityMap[log.entity_type] ?? log.entity_type;

      return {
        id: log.id,
        title: `${actorName} ${bi(`đã thực hiện thao tác trên ${entityName}`, `performed operation on ${entityName}`)}`,
        subtitle: `${log.action} · ID: #${log.entity_id ? log.entity_id.slice(0, 8) : log.id.slice(0, 8)}`,
        time: formatRelativeTime(log.created_at, airportTime, bi),
        dotColor: '#0891B2',
      };
    }),
  ];

  return (
    <AdminShell
      activeSection="permissions"
      title={bi('Tài khoản & phân quyền', 'Access Control & Accounts')}
      subtitle={bi(
        'Quản lý danh sách tài khoản thực tế trên hệ thống Flyora và phân quyền Quản trị viên.',
        'Manage real user accounts across Flyora and configure Administrator access.',
      )}
      rightAction={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/admin/reports' as Href)}
            style={permStyles.secondaryActionBtn}
          >
            <Text style={permStyles.secondaryActionText}>⚡ {bi('Nhật ký kiểm toán', 'Audit Logs')}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setInviteSearchQuery('');
              setInviteModalVisible(true);
            }}
            style={permStyles.primaryActionBtn}
          >
            <Text style={permStyles.primaryActionText}>👤+ {bi('Mời admin', 'Invite Admin')}</Text>
          </Pressable>
        </View>
      }
      onQuickSearch={(txt) => {
        setQuery(txt);
        setPage(1);
      }}
    >
      {/* Category Sub-Tag */}
      <View style={{ marginTop: -8, marginBottom: 4 }}>
        <Text style={permStyles.subTagText}>SYSTEM / ACCESS CONTROL</Text>
      </View>

      {!!formSuccess && <Notice text={formSuccess} success />}

      {/* Top System Security Notice Card (Without MFA) */}
      <View style={permStyles.securityBanner}>
        <View style={permStyles.securityBannerIconBox}>
          <Text style={{ fontSize: 18 }}>🛡️</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={permStyles.securityBannerTitle}>
            {bi('Hệ thống phân quyền Flyora Back-office', 'Flyora Back-Office Access Control')}
          </Text>
          <Text style={permStyles.securityBannerText}>
            {bi(
              'Chỉ cấp quyền Quản trị viên cho nhân sự trực tiếp phụ trách vận hành hệ thống. Mọi thao tác quản lý đều được ghi nhận bất biến trong Nhật ký kiểm toán.',
              'Only grant Administrator privileges to authorized operating staff. All system updates are immutably tracked in Audit Logs.',
            )}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/admin/reports' as Href)}
          style={permStyles.securityLinkBtn}
        >
          <Text style={permStyles.securityLinkText}>
            {bi('Xem nhật ký ›', 'View Logs ›')}
          </Text>
        </Pressable>
      </View>

      {/* 4 KPI Cards (Real Data, Zero MFA) */}
      <View style={permStyles.kpiGrid}>
        <View style={permStyles.kpiCard}>
          <View style={permStyles.kpiHeaderRow}>
            <View style={[permStyles.kpiIconBox, { backgroundColor: '#ECFEFF' }]}>
              <Text style={{ fontSize: 16 }}>👥</Text>
            </View>
            <Text style={permStyles.kpiBadge}>
              {bi('Dữ liệu thật', 'Real Data')}
            </Text>
          </View>
          <Text style={permStyles.kpiValue}>
            {totalAccounts < 10 ? `0${totalAccounts}` : totalAccounts}
          </Text>
          <Text style={permStyles.kpiLabel}>
            {bi('Tổng tài khoản người dùng', 'Total User Accounts')}
          </Text>
        </View>

        <View style={permStyles.kpiCard}>
          <View style={permStyles.kpiHeaderRow}>
            <View style={[permStyles.kpiIconBox, { backgroundColor: '#EDE9FE' }]}>
              <Text style={{ fontSize: 16 }}>🛡️</Text>
            </View>
            <Text style={[permStyles.kpiBadge, { color: '#7C3AED', backgroundColor: '#F5F3FF' }]}>
              {bi('Có quyền quản trị', 'Back-office access')}
            </Text>
          </View>
          <Text style={permStyles.kpiValue}>
            {adminAccountsCount < 10 ? `0${adminAccountsCount}` : adminAccountsCount}
          </Text>
          <Text style={permStyles.kpiLabel}>
            {bi('Tài khoản Quản trị viên', 'Admin Accounts')}
          </Text>
        </View>

        <View style={permStyles.kpiCard}>
          <View style={permStyles.kpiHeaderRow}>
            <View style={[permStyles.kpiIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Text style={{ fontSize: 16 }}>👤</Text>
            </View>
            <Text style={[permStyles.kpiBadge, { color: '#B45309', backgroundColor: '#FFFBEB' }]}>
              {bi('Hành khách đặt vé', 'Traveler Members')}
            </Text>
          </View>
          <Text style={permStyles.kpiValue}>
            {customerAccountsCount < 10 ? `0${customerAccountsCount}` : customerAccountsCount}
          </Text>
          <Text style={permStyles.kpiLabel}>
            {bi('Tài khoản Khách hàng', 'Customer Accounts')}
          </Text>
        </View>

        <View style={permStyles.kpiCard}>
          <View style={permStyles.kpiHeaderRow}>
            <View style={[permStyles.kpiIconBox, { backgroundColor: '#DCFCE7' }]}>
              <Text style={{ fontSize: 16 }}>⚡</Text>
            </View>
            <Text style={[permStyles.kpiBadge, { color: '#15803D', backgroundColor: '#F0FDF4' }]}>
              {bi('Ghi nhận bất biến', 'Immutable records')}
            </Text>
          </View>
          <Text style={permStyles.kpiValue}>
            {totalAuditEvents < 10 ? `0${totalAuditEvents}` : totalAuditEvents}
          </Text>
          <Text style={permStyles.kpiLabel}>
            {bi('Nhật ký thao tác', 'Audit Log Entries')}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={permStyles.tabRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'accounts' }}
          onPress={() => setTab('accounts')}
          style={[permStyles.tabItem, tab === 'accounts' && permStyles.tabItemActive]}
        >
          <Text style={{ fontSize: 15 }}>👥</Text>
          <Text style={[permStyles.tabText, tab === 'accounts' && permStyles.tabTextActive]}>
            {bi(`Danh sách tài khoản (${totalAccounts})`, `User Accounts (${totalAccounts})`)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'roles' }}
          onPress={() => setTab('roles')}
          style={[permStyles.tabItem, tab === 'roles' && permStyles.tabItemActive]}
        >
          <Text style={{ fontSize: 15 }}>🛡️</Text>
          <Text style={[permStyles.tabText, tab === 'roles' && permStyles.tabTextActive]}>
            {bi('Role & quyền hệ thống (02)', 'System Roles & Permissions (02)')}
          </Text>
        </Pressable>
      </View>

      {queryBundle.isLoading ? (
        <AdminLoadingState text={bi('Đang tải danh sách tài khoản thật…', 'Loading real accounts…')} />
      ) : tab === 'accounts' ? (
        /* TAB 1: DANH SÁCH TÀI KHOẢN THẬT */
        <View style={permStyles.card}>
          <View style={permStyles.cardHeaderRow}>
            <View style={{ gap: 2 }}>
              <Text style={permStyles.cardTitle}>
                {bi('Danh sách tài khoản hệ thống', 'System User Accounts')}
              </Text>
              <Text style={permStyles.cardSubtitle}>
                {bi(
                  'Tất cả tài khoản người dùng đăng ký trên Flyora. Bạn có thể cấp quyền Admin trực tiếp cho bất kỳ tài khoản nào.',
                  'All registered Flyora users. You can promote any account to Administrator directly from this list.',
                )}
              </Text>
            </View>

            {/* Filter chips / status */}
            <View style={permStyles.filterChipsRow}>
              {(['all', 'admin', 'customer'] as const).map((r) => {
                const selected = roleFilter === r;
                const label =
                  r === 'all'
                    ? bi(`Tất cả (${totalAccounts})`, `All (${totalAccounts})`)
                    : r === 'admin'
                      ? bi(`Quản trị viên (${adminAccountsCount})`, `Admins (${adminAccountsCount})`)
                      : bi(`Khách hàng (${customerAccountsCount})`, `Customers (${customerAccountsCount})`);
                return (
                  <Pressable
                    key={r}
                    accessibilityRole="button"
                    onPress={() => {
                      setRoleFilter(r);
                      setPage(1);
                    }}
                    style={[permStyles.statusChip, selected && permStyles.statusChipActive]}
                  >
                    <Text
                      style={[
                        permStyles.statusChipText,
                        selected && permStyles.statusChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Quick Search inside Table */}
          <View style={permStyles.searchBox}>
            <Text style={{ fontSize: 13 }}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={(txt) => {
                setQuery(txt);
                setPage(1);
              }}
              placeholder={bi(
                'Tìm tài khoản theo họ tên, email, SĐT hoặc ID…',
                'Search by name, email, phone, or ID…',
              )}
              placeholderTextColor="#94A3B8"
              style={permStyles.searchInput}
            />
            {query.length > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setQuery('');
                  setPage(1);
                }}
              >
                <Text style={{ color: '#94A3B8', fontWeight: '700' }}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* Desktop Table Header */}
          {isDesktop && (
            <View style={permStyles.tableHeaderRow}>
              <Text style={[permStyles.tableHeadText, { flex: 2.2 }]}>
                {bi('TÀI KHOẢN', 'ACCOUNT')}
              </Text>
              <Text style={[permStyles.tableHeadText, { flex: 1.8 }]}>
                {bi('VAI TRÒ', 'ROLE')}
              </Text>
              <Text style={[permStyles.tableHeadText, { flex: 1.5 }]}>
                {bi('HOẠT ĐỘNG GẦN NHẤT', 'LAST ACTIVE')}
              </Text>
              <Text style={[permStyles.tableHeadText, { flex: 1.2 }]}>
                {bi('TRẠNG THÁI', 'STATUS')}
              </Text>
              <Text style={[permStyles.tableHeadText, { flex: 1.4, textAlign: 'right' }]}>
                {bi('THAO TÁC', 'ACTIONS')}
              </Text>
            </View>
          )}

          {/* Account Rows */}
          {pagedAccounts.items.length === 0 ? (
            <View style={{ paddingVertical: 36, alignItems: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                {bi('Không tìm thấy tài khoản phù hợp', 'No matching accounts found')}
              </Text>
              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                {bi('Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn bộ lọc.', 'Try adjusting your search query or reset filter.')}
              </Text>
            </View>
          ) : (
            pagedAccounts.items.map((acc, idx) => {
              const isCurrentUser = session?.user?.id === acc.id;
              const roleDef = SYSTEM_ROLES[acc.role];

              return (
                <View
                  key={acc.id}
                  style={[
                    permStyles.tableRow,
                    idx % 2 === 1 && permStyles.tableRowAlt,
                    !isDesktop && permStyles.mobileCard,
                  ]}
                >
                  {/* ACCOUNT INFO COLUMN */}
                  <View style={[permStyles.colStaff, { flex: isDesktop ? 2.2 : undefined }]}>
                    <View
                      style={[
                        permStyles.staffAvatar,
                        { backgroundColor: acc.avatarBg },
                      ]}
                    >
                      <Text style={[permStyles.staffAvatarText, { color: acc.avatarColor }]}>
                        {acc.initials}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={permStyles.staffName}>{acc.name}</Text>
                        {isCurrentUser && (
                          <View style={permStyles.youBadge}>
                            <Text style={permStyles.youBadgeText}>
                              {bi('Bạn', 'You')}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={permStyles.staffEmail}>{acc.email}</Text>
                      {!!acc.phone && (
                        <Text style={permStyles.staffPhone}>📞 {acc.phone}</Text>
                      )}
                    </View>
                  </View>

                  {/* ROLE COLUMN */}
                  <View style={[permStyles.colRole, { flex: isDesktop ? 1.8 : undefined }]}>
                    <View
                      style={[
                        permStyles.rolePill,
                        { backgroundColor: roleDef.badgeBg, borderColor: roleDef.color + '40' },
                      ]}
                    >
                      <Text style={{ fontSize: 12 }}>{roleDef.icon}</Text>
                      <Text style={[permStyles.rolePillText, { color: roleDef.color }]}>
                        {bi(roleDef.nameVi, roleDef.nameEn)}
                      </Text>
                    </View>
                  </View>

                  {/* LAST ACTIVE COLUMN */}
                  <View style={[permStyles.colLastActive, { flex: isDesktop ? 1.5 : undefined }]}>
                    <Text style={permStyles.lastActiveText}>
                      {formatRelativeTime(acc.lastActive, airportTime, bi)}
                    </Text>
                  </View>

                  {/* STATUS COLUMN */}
                  <View style={[permStyles.colStatus, { flex: isDesktop ? 1.2 : undefined }]}>
                    <View
                      style={[
                        permStyles.statusPill,
                        acc.status === 'active'
                          ? permStyles.statusPillActive
                          : permStyles.statusPillSuspended,
                      ]}
                    >
                      <View
                        style={[
                          permStyles.statusDot,
                          {
                            backgroundColor:
                              acc.status === 'active' ? '#10B981' : '#EF4444',
                          },
                        ]}
                      />
                      <Text
                        style={[
                          permStyles.statusText,
                          {
                            color:
                              acc.status === 'active' ? '#047857' : '#B91C1C',
                          },
                        ]}
                      >
                        {acc.status === 'active'
                          ? bi('Đang hoạt động', 'Active')
                          : bi('Đã tạm dừng', 'Suspended')}
                      </Text>
                    </View>
                  </View>

                  {/* ACTIONS COLUMN */}
                  <View
                    style={[
                      permStyles.colActions,
                      { flex: isDesktop ? 1.4 : undefined, justifyContent: 'flex-end' },
                    ]}
                  >
                    {acc.role === 'customer' ? (
                      /* Grant Admin right in the list! */
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleGrantAdmin(acc)}
                        style={permStyles.rowGrantBtn}
                      >
                        <Text style={permStyles.rowGrantBtnText}>
                          + {bi('Cấp quyền Admin', 'Grant Admin')}
                        </Text>
                      </Pressable>
                    ) : isCurrentUser ? (
                      <View style={permStyles.currentLoggedBox}>
                        <Text style={permStyles.currentLoggedText}>
                          {bi('Đang đăng nhập', 'Logged In')}
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setEditingAccount(acc)}
                        style={permStyles.actionDotsBtn}
                      >
                        <Text style={permStyles.actionDotsText}>•••</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {/* Footer Pagination & CSV Export */}
          <View style={permStyles.cardFooterRow}>
            <Text style={permStyles.cardFooterMeta}>
              {bi(
                `Hiển thị ${pagedAccounts.items.length} trong tổng số ${pagedAccounts.total} tài khoản`,
                `Showing ${pagedAccounts.items.length} of ${pagedAccounts.total} accounts`,
              )}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={handleExportCSV}
              style={permStyles.csvBtn}
            >
              <Text style={permStyles.csvBtnText}>
                {bi('Tải CSV ⤓', 'Export CSV ⤓')}
              </Text>
            </Pressable>
          </View>

          <AdminPaginationBar
            page={pagedAccounts.page}
            totalPages={pagedAccounts.totalPages}
            total={pagedAccounts.total}
            onPageChange={setPage}
          />
        </View>
      ) : (
        /* TAB 2: ROLES & QUYỀN HẠN THỰC TẾ */
        <View style={{ gap: 14 }}>
          {(Object.keys(SYSTEM_ROLES) as SystemRoleKey[]).map((rKey) => {
            const roleDef = SYSTEM_ROLES[rKey];
            const assignedCount = accounts.filter((s) => s.role === rKey).length;

            return (
              <View key={rKey} style={permStyles.roleCard}>
                <View style={permStyles.roleCardHeader}>
                  <View style={[permStyles.roleIconLarge, { backgroundColor: roleDef.badgeBg }]}>
                    <Text style={{ fontSize: 22 }}>{roleDef.icon}</Text>
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={permStyles.roleNameText}>
                        {bi(roleDef.nameVi, roleDef.nameEn)}
                      </Text>
                      <View style={permStyles.roleCountBadge}>
                        <Text style={permStyles.roleCountBadgeText}>
                          {bi(
                            `${assignedCount} tài khoản thực tế`,
                            `${assignedCount} real accounts`,
                          )}
                        </Text>
                      </View>
                    </View>
                    <Text style={permStyles.roleDescText}>
                      {bi(roleDef.descriptionVi, roleDef.descriptionEn)}
                    </Text>
                  </View>
                </View>

                {/* Permissions Breakdown */}
                <View style={{ marginTop: 14 }}>
                  <Text style={permStyles.permSectionTitle}>
                    {bi('QUYỀN HẠN ĐƯỢC CẤP TRÊN FLYORA', 'GRANTED PERMISSIONS')}
                  </Text>
                  <View style={permStyles.permGrid}>
                    {(bi(
                      roleDef.permissionsVi.join('|||'),
                      roleDef.permissionsEn.join('|||'),
                    )
                      .split('|||')
                      .filter(Boolean)).map((pText, pIdx) => (
                      <View key={pIdx} style={permStyles.permCheckRow}>
                        <Text style={{ fontSize: 13, color: '#059669' }}>✓</Text>
                        <Text style={permStyles.permCheckText}>{pText}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Restrictions if any */}
                  {!!roleDef.restrictionsVi && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[permStyles.permSectionTitle, { color: '#B91C1C' }]}>
                        {bi('GIỚI HẠN PHẠM VI TRUY CẬP', 'ACCESS RESTRICTIONS')}
                      </Text>
                      <View style={permStyles.permGrid}>
                        {(bi(
                          roleDef.restrictionsVi.join('|||'),
                          (roleDef.restrictionsEn ?? []).join('|||'),
                        )
                          .split('|||')
                          .filter(Boolean)).map((rText, rIdx) => (
                          <View key={rIdx} style={permStyles.permCheckRow}>
                            <Text style={{ fontSize: 13, color: '#DC2626' }}>✕</Text>
                            <Text style={[permStyles.permCheckText, { color: '#64748B' }]}>
                              {rText}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* BOTTOM SECTION: HOẠT ĐỘNG GẦN ĐÂY THỰC TẾ & KHUYẾN NGHỊ BẢO MẬT */}
      <View style={[permStyles.bottomSplitRow, !isDesktop && { flexDirection: 'column' }]}>
        {/* Card 1: Hoạt động gần đây THỰC TẾ của dự án */}
        <View style={permStyles.splitCard}>
          <View style={permStyles.splitCardHeader}>
            <View style={[permStyles.kpiIconBox, { backgroundColor: '#F5F3FF' }]}>
              <Text style={{ fontSize: 16 }}>⚡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={permStyles.splitCardTitle}>
                {bi('Hoạt động gần đây', 'Recent Activities')}
              </Text>
              <Text style={permStyles.splitCardSub}>
                {bi(
                  'Nhật ký thao tác thực tế từ hệ thống Flyora.',
                  'Real audit events recorded by Flyora backend.',
                )}
              </Text>
            </View>
            {allActivities.length > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setActivityModalVisible(true)}
                style={permStyles.viewDetailsBtn}
              >
                <Text style={permStyles.viewDetailsBtnText}>
                  {bi('Xem chi tiết ›', 'Details ›')}
                </Text>
              </Pressable>
            )}
          </View>

          <View style={{ gap: 10, marginTop: 4 }}>
            {/* Show top 3 activities only to keep it compact */}
            {allActivities.slice(0, 3).map((item) => (
              <View key={item.id} style={permStyles.activityItem}>
                <View style={[permStyles.activityDot, { backgroundColor: item.dotColor }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={permStyles.activityText} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={permStyles.activitySubText}>{item.subtitle}</Text>
                  <Text style={permStyles.activityTime}>{item.time}</Text>
                </View>
              </View>
            ))}

            {allActivities.length === 0 && (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#64748B' }}>
                  {bi('Chưa có hoạt động quản trị nào được ghi nhận.', 'No audit activities recorded yet.')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Card 2: Khuyến nghị bảo mật hệ thống (Không có MFA) */}
        <View style={permStyles.splitCard}>
          <View style={permStyles.splitCardHeader}>
            <View style={[permStyles.kpiIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Text style={{ fontSize: 16 }}>🛡️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={permStyles.splitCardTitle}>
                {bi('Khuyến nghị bảo mật', 'Security Recommendations')}
              </Text>
              <Text style={permStyles.splitCardSub}>
                {bi(
                  'Kiểm tra tuân thủ và bảo vệ quyền quản trị.',
                  'Best practices and compliance checklist.',
                )}
              </Text>
            </View>
          </View>

          <View style={{ gap: 12, marginTop: 4 }}>
            <View style={permStyles.recItem}>
              <Text style={{ fontSize: 16 }}>✓</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={permStyles.recTitle}>
                  {bi('Nguyên tắc quyền tối thiểu', 'Least Privilege Principle')}
                </Text>
                <Text style={permStyles.recSub}>
                  {bi(
                    'Chỉ cấp quyền Quản trị viên cho những nhân sự trực tiếp phụ trách điều hành bay hoặc tài chính.',
                    'Only grant Administrator roles to personnel actively managing flights or finances.',
                  )}
                </Text>
              </View>
            </View>

            <View style={permStyles.recItem}>
              <Text style={{ fontSize: 16 }}>⏱</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[permStyles.recTitle, { color: '#B45309' }]}>
                  {bi('Rà soát định kỳ danh sách Admin', 'Periodic Admin Audit')}
                </Text>
                <Text style={permStyles.recSub}>
                  {bi(
                    'Khuyến nghị kiểm tra danh sách tài khoản quản trị viên và thu hồi các quyền không còn sử dụng.',
                    'Recommended to review active admin credentials monthly and revoke unused privileges.',
                  )}
                </Text>
              </View>
            </View>

            <View style={permStyles.recItem}>
              <Text style={{ fontSize: 16 }}>⚡</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={permStyles.recTitle}>
                  {bi('Kiểm toán bất biến toàn bộ thao tác', 'Immutable Audit Logging')}
                </Text>
                <Text style={permStyles.recSub}>
                  {bi(
                    'Mọi thay đổi về giá vé, giờ bay, kho ghế và trạng thái bán đều được lưu vết vĩnh viễn.',
                    'All updates to schedules, fares, and seat maps are permanently logged in the audit trail.',
                  )}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* MODAL 1: CHỌN TÀI KHOẢN THẬT ĐỂ MỜI ADMIN */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={permStyles.modalBackdrop}>
          <View style={[permStyles.modalCard, { maxHeight: '85%' }]}>
            <View style={permStyles.modalHeaderRow}>
              <View style={{ gap: 2, flex: 1 }}>
                <Text style={permStyles.modalTitle}>
                  👤+ {bi('Mời Quản trị viên mới', 'Invite New Administrator')}
                </Text>
                <Text style={permStyles.modalSub}>
                  {bi(
                    'Chọn một tài khoản người dùng thật từ hệ thống để cấp quyền Quản trị viên.',
                    'Pick a real user account from the system to grant Administrator privileges.',
                  )}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setInviteModalVisible(false)}
                style={permStyles.modalCloseBtn}
              >
                <Text style={permStyles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* Candidate Search Box */}
            <View style={[permStyles.searchBox, { marginVertical: 10 }]}>
              <Text style={{ fontSize: 13 }}>🔍</Text>
              <TextInput
                value={inviteSearchQuery}
                onChangeText={setInviteSearchQuery}
                placeholder={bi(
                  'Tìm tài khoản theo tên, email, SĐT hoặc ID…',
                  'Search user by name, email, phone, or ID…',
                )}
                placeholderTextColor="#94A3B8"
                style={permStyles.searchInput}
              />
              {inviteSearchQuery.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setInviteSearchQuery('')}
                >
                  <Text style={{ color: '#94A3B8', fontWeight: '700' }}>✕</Text>
                </Pressable>
              )}
            </View>

            {/* Candidate List */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
              {candidateAccounts.length === 0 ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: '#64748B' }}>
                    {bi('Không tìm thấy tài khoản người dùng nào.', 'No user accounts found.')}
                  </Text>
                </View>
              ) : (
                candidateAccounts.map((acc) => {
                  const isAlreadyAdmin = acc.role === 'admin';
                  const isCurrent = session?.user?.id === acc.id;

                  return (
                    <View
                      key={acc.id}
                      style={[
                        permStyles.candidateCard,
                        isAlreadyAdmin && { backgroundColor: '#F8FAFC' },
                      ]}
                    >
                      <View style={[permStyles.staffAvatar, { backgroundColor: acc.avatarBg }]}>
                        <Text style={[permStyles.staffAvatarText, { color: acc.avatarColor }]}>
                          {acc.initials}
                        </Text>
                      </View>

                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={permStyles.candidateName}>{acc.name}</Text>
                          {isCurrent && (
                            <View style={permStyles.youBadge}>
                              <Text style={permStyles.youBadgeText}>{bi('Bạn', 'You')}</Text>
                            </View>
                          )}
                          <View
                            style={[
                              permStyles.rolePill,
                              {
                                paddingVertical: 1,
                                paddingHorizontal: 6,
                                backgroundColor: isAlreadyAdmin ? '#ECFEFF' : '#F1F5F9',
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: isAlreadyAdmin ? '#0891B2' : '#64748B',
                              }}
                            >
                              {isAlreadyAdmin
                                ? bi('Quản trị viên', 'Admin')
                                : bi('Khách hàng', 'Customer')}
                            </Text>
                          </View>
                        </View>
                        <Text style={permStyles.candidateEmail}>{acc.email}</Text>
                        {!!acc.phone && (
                          <Text style={permStyles.candidatePhone}>📞 {acc.phone}</Text>
                        )}
                      </View>

                      {isAlreadyAdmin ? (
                        <View style={permStyles.alreadyAdminBadge}>
                          <Text style={permStyles.alreadyAdminText}>
                            ✓ {bi('Đã là Admin', 'Already Admin')}
                          </Text>
                        </View>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleGrantAdmin(acc)}
                          style={permStyles.selectGrantBtn}
                        >
                          <Text style={permStyles.selectGrantBtnText}>
                            + {bi('Cấp quyền Admin', 'Grant Admin')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={permStyles.modalActionRow}>
              <ActionButton
                title={bi('Đóng', 'Close')}
                secondary
                onPress={() => setInviteModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: THU HỒI / TẠM DỪNG TÀI KHOẢN ADMIN */}
      <Modal
        visible={!!editingAccount}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingAccount(null)}
      >
        <View style={permStyles.modalBackdrop}>
          <View style={permStyles.modalCard}>
            <View style={permStyles.modalHeaderRow}>
              <Text style={permStyles.modalTitle}>
                {bi('Quản lý quyền quản trị:', 'Manage Admin Access:')} {editingAccount?.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditingAccount(null)}
                style={permStyles.modalCloseBtn}
              >
                <Text style={permStyles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={permStyles.modalSub}>
              {editingAccount?.email} · {bi('Trạng thái hiện tại:', 'Current status:')}{' '}
              {editingAccount?.status === 'active'
                ? bi('Đang hoạt động', 'Active')
                : bi('Đã tạm dừng', 'Suspended')}
            </Text>

            <View style={{ gap: 12, marginVertical: 14 }}>
              {editingAccount?.role === 'admin' ? (
                <View style={{ gap: 10 }}>
                  <Text style={adminStyles.label}>
                    {bi('Thao tác quyền hạn', 'Access Actions')}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => editingAccount && handleRevokeAdmin(editingAccount)}
                    style={permStyles.revokeRoleBtn}
                  >
                    <Text style={{ fontSize: 16 }}>👤</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={permStyles.revokeRoleTitle}>
                        {bi('Thu hồi quyền Quản trị viên', 'Revoke Administrator Role')}
                      </Text>
                      <Text style={permStyles.revokeRoleSub}>
                        {bi(
                          'Chuyển tài khoản về vai trò Khách hàng thông thường, vô hiệu hóa quyền truy cập Back-office.',
                          'Revert account to Customer, revoking Back-office access.',
                        )}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => editingAccount && handleGrantAdmin(editingAccount)}
                  style={permStyles.grantRoleBtn}
                >
                  <Text style={{ fontSize: 16 }}>🛡️</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={permStyles.grantRoleTitle}>
                      {bi('Cấp lại quyền Quản trị viên', 'Re-grant Administrator Role')}
                    </Text>
                    <Text style={permStyles.grantRoleSub}>
                      {bi('Cho phép tài khoản này truy cập lại Flyora Admin Console.', 'Allow this account to access Admin Console.')}
                    </Text>
                  </View>
                </Pressable>
              )}

              <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 4 }} />

              <ActionButton
                title={
                  editingAccount?.status === 'active'
                    ? bi('Tạm dừng tài khoản này', 'Suspend this account')
                    : bi('Kích hoạt lại tài khoản này', 'Re-activate this account')
                }
                secondary
                onPress={() => editingAccount && handleToggleSuspend(editingAccount)}
              />
            </View>

            <View style={permStyles.modalActionRow}>
              <ActionButton
                title={bi('Đóng', 'Close')}
                secondary
                onPress={() => setEditingAccount(null)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: DIALOG CHI TIẾT HOẠT ĐỘNG GẦN ĐÂY CÓ CUỘN */}
      <Modal
        visible={activityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActivityModalVisible(false)}
      >
        <View style={permStyles.modalBackdrop}>
          <View style={[permStyles.modalCard, { maxHeight: '85%' }]}>
            <View style={permStyles.modalHeaderRow}>
              <View style={{ gap: 2, flex: 1 }}>
                <Text style={permStyles.modalTitle}>
                  ⚡ {bi('Nhật ký hoạt động chi tiết', 'Detailed Activity Log')}
                </Text>
                <Text style={permStyles.modalSub}>
                  {bi(
                    `Toàn bộ ${allActivities.length} sự kiện thao tác và phân quyền gần đây trên hệ thống.`,
                    `All ${allActivities.length} recent system and access control events.`,
                  )}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setActivityModalVisible(false)}
                style={permStyles.modalCloseBtn}
              >
                <Text style={permStyles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1, marginVertical: 10 }}
              contentContainerStyle={{ gap: 10, paddingBottom: 10, paddingRight: 4 }}
            >
              {allActivities.map((item, idx) => (
                <View
                  key={item.id + idx}
                  style={[
                    permStyles.activityItemDialog,
                    idx % 2 === 1 && { backgroundColor: '#F8FAFC' },
                  ]}
                >
                  <View style={[permStyles.activityDot, { backgroundColor: item.dotColor, marginTop: 4 }]} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={permStyles.activityText}>{item.title}</Text>
                    <Text style={permStyles.activitySubText}>{item.subtitle}</Text>
                    <Text style={permStyles.activityTime}>{item.time}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={permStyles.modalActionRow}>
              <ActionButton
                title={bi('Mở Báo cáo & Nhật ký kiểm toán ↗', 'Open Full Audit Reports ↗')}
                secondary
                onPress={() => {
                  setActivityModalVisible(false);
                  router.push('/admin/reports' as Href);
                }}
              />
              <ActionButton
                title={bi('Đóng', 'Close')}
                onPress={() => setActivityModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </AdminShell>
  );
}

const permStyles = StyleSheet.create({
  subTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0891B2',
    letterSpacing: 0.8,
  },
  primaryActionBtn: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryActionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryActionText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 13,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFEFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CFFAFE',
  },
  securityBannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0E7490',
  },
  securityBannerText: {
    fontSize: 12,
    color: '#155E75',
    lineHeight: 17,
  },
  securityLinkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  securityLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  kpiCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0891B2',
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 2,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#ECFEFF',
    borderBottomWidth: 2,
    borderBottomColor: '#0891B2',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0891B2',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  statusChipActive: {
    borderColor: '#0891B2',
    backgroundColor: '#ECFEFF',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  statusChipTextActive: {
    color: '#0891B2',
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
  },
  tableHeadText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  mobileCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    marginBottom: 8,
  },
  colStaff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  staffAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  staffName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffEmail: {
    fontSize: 11,
    color: '#64748B',
  },
  staffPhone: {
    fontSize: 10,
    color: '#94A3B8',
  },
  youBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  colRole: {
    justifyContent: 'center',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  colLastActive: {
    justifyContent: 'center',
  },
  lastActiveText: {
    fontSize: 12,
    color: '#475569',
  },
  colStatus: {
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusPillActive: {
    backgroundColor: '#ECFDF5',
  },
  statusPillSuspended: {
    backgroundColor: '#FEF2F2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  colActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowGrantBtn: {
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#0891B2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rowGrantBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  currentLoggedBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  currentLoggedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  actionDotsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  actionDotsText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardFooterMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  csvBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  csvBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleIconLarge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  roleDescText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  permSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  permGrid: {
    gap: 6,
  },
  permCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  permCheckText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    lineHeight: 17,
  },
  bottomSplitRow: {
    flexDirection: 'row',
    gap: 14,
  },
  splitCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  splitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  splitCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  splitCardSub: {
    fontSize: 11,
    color: '#64748B',
  },
  viewDetailsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewDetailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0891B2',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  activityItemDialog: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  activityText: {
    fontSize: 12,
    color: '#0F172A',
    lineHeight: 17,
  },
  activitySubText: {
    fontSize: 11,
    color: '#64748B',
  },
  activityTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  recTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  recSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94A3B8',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  candidateName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  candidateEmail: {
    fontSize: 11,
    color: '#64748B',
  },
  candidatePhone: {
    fontSize: 10,
    color: '#94A3B8',
  },
  selectGrantBtn: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectGrantBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  alreadyAdminBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alreadyAdminText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  revokeRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  revokeRoleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  revokeRoleSub: {
    fontSize: 11,
    color: '#7F1D1D',
  },
  grantRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0891B2',
    backgroundColor: '#ECFEFF',
  },
  grantRoleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0891B2',
  },
  grantRoleSub: {
    fontSize: 11,
    color: '#155E75',
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 8,
  },
});
