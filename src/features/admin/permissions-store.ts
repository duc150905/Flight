import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdminAuditLogRow } from './rpc';

export type LocalPermissionEvent = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: 'role.grant' | 'role.revoke' | 'role.suspend' | 'role.reactivate';
  targetUserId: string;
  targetName: string;
  targetEmail: string;
  title: string;
  subtitle: string;
  time: string;
  timeLabel: string;
  dotColor: string;
  createdAt: string;
  safeChanges: Record<string, unknown>;
};

const PERMISSIONS_STORAGE_KEY = 'flyora_admin_permissions_store_v1';

export const permissionsStore = {
  promotedIds: new Set<string>(),
  revokedIds: new Set<string>(),
  suspendedIds: new Set<string>(),
  auditEvents: [] as LocalPermissionEvent[],
  isLoaded: false,

  async persist() {
    try {
      const payload = JSON.stringify({
        promoted: Array.from(this.promotedIds),
        revoked: Array.from(this.revokedIds),
        suspended: Array.from(this.suspendedIds),
        events: this.auditEvents,
      });
      await AsyncStorage.setItem(PERMISSIONS_STORAGE_KEY, payload);
    } catch {
      // Ignore storage errors safely
    }
  },

  async load(): Promise<{
    promoted: Set<string>;
    revoked: Set<string>;
    suspended: Set<string>;
    events: LocalPermissionEvent[];
  }> {
    if (this.isLoaded) {
      return {
        promoted: this.promotedIds,
        revoked: this.revokedIds,
        suspended: this.suspendedIds,
        events: this.auditEvents,
      };
    }
    try {
      const raw = await AsyncStorage.getItem(PERMISSIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.promoted)) this.promotedIds = new Set(parsed.promoted);
        if (Array.isArray(parsed.revoked)) this.revokedIds = new Set(parsed.revoked);
        if (Array.isArray(parsed.suspended)) this.suspendedIds = new Set(parsed.suspended);
        if (Array.isArray(parsed.events)) {
          this.auditEvents = parsed.events.map((e: Partial<LocalPermissionEvent>) => {
            let action: LocalPermissionEvent['action'] = (e.action as LocalPermissionEvent['action']) || 'role.grant';
            if (!e.action) {
              if (e.id?.includes('revoke')) action = 'role.revoke';
              else if (e.id?.includes('suspend')) action = 'role.suspend';
              else action = 'role.grant';
            }
            return {
              id: e.id || `role-${Date.now()}`,
              actorId: e.actorId ?? null,
              actorName: e.actorName || 'Admin',
              action,
              targetUserId: e.targetUserId || '',
              targetName: e.targetName || '',
              targetEmail: e.targetEmail || '',
              title: e.title || '',
              subtitle: e.subtitle || '',
              time: e.time || e.timeLabel || '',
              timeLabel: e.timeLabel || e.time || '',
              dotColor: e.dotColor || '#0891B2',
              createdAt: e.createdAt || new Date().toISOString(),
              safeChanges: e.safeChanges || {},
            };
          });
        }
      }
    } catch {
      // Ignore parse errors safely
    }
    this.isLoaded = true;
    return {
      promoted: this.promotedIds,
      revoked: this.revokedIds,
      suspended: this.suspendedIds,
      events: this.auditEvents,
    };
  },

  syncActorName(actorId: string | null, realName: string) {
    if (!realName || /^bnvawg/i.test(realName) || realName === 'Admin') return;
    let changed = false;
    this.auditEvents = this.auditEvents.map((e) => {
      const isMatch =
        (actorId && e.actorId === actorId) ||
        !e.actorName ||
        e.actorName === 'Admin' ||
        /^bnvawg/i.test(e.actorName) ||
        e.title.startsWith('Admin ') ||
        /^bnvawg/i.test(e.title);

      if (isMatch && (e.actorName !== realName || !e.title.startsWith(realName))) {
        changed = true;
        const oldName = e.actorName || 'Admin';
        let newTitle = e.title
          .replace(/^bnvawg87z\b/i, realName)
          .replace(/^Admin\b/i, realName);
        if (oldName && oldName !== realName) {
          newTitle = newTitle.replace(new RegExp(`^${oldName}\\b`, 'i'), realName);
        }
        return {
          ...e,
          actorName: realName,
          title: newTitle,
        };
      }
      return e;
    });
    if (changed) void this.persist();
  },

  syncTargetName(targetUserIdPrefix: string, newTargetName: string) {
    if (!newTargetName) return;
    let changed = false;
    this.auditEvents = this.auditEvents.map((e) => {
      const isTarget =
        (e.targetUserId && e.targetUserId.toLowerCase().startsWith(targetUserIdPrefix.toLowerCase())) ||
        (e.subtitle && e.subtitle.toLowerCase().includes(targetUserIdPrefix.toLowerCase())) ||
        e.title.includes('Ca Gia Bảo');

      if (isTarget && (e.targetName !== newTargetName || e.title.includes('Ca Gia Bảo'))) {
        changed = true;
        const newTitle = e.title.replace(/Ca Gia Bảo/g, newTargetName);
        return {
          ...e,
          targetName: newTargetName,
          title: newTitle,
        };
      }
      return e;
    });
    if (changed) void this.persist();
  },

  grantAdmin(input: {
    actorId: string | null;
    actorName: string;
    targetUserId: string;
    targetName: string;
    targetEmail: string;
    title: string;
    subtitle: string;
    timeLabel: string;
  }) {
    this.promotedIds.add(input.targetUserId);
    this.revokedIds.delete(input.targetUserId);
    const now = new Date().toISOString();
    const newEvent: LocalPermissionEvent = {
      id: `role-grant-${input.targetUserId}-${Date.now()}`,
      actorId: input.actorId,
      actorName: input.actorName,
      action: 'role.grant',
      targetUserId: input.targetUserId,
      targetName: input.targetName,
      targetEmail: input.targetEmail,
      title: input.title,
      subtitle: input.subtitle,
      time: input.timeLabel,
      timeLabel: input.timeLabel,
      dotColor: '#0891B2',
      createdAt: now,
      safeChanges: {
        role: 'admin',
        target_name: input.targetName,
        granted_to: input.targetName,
        email: input.targetEmail,
      },
    };
    this.auditEvents = [newEvent, ...this.auditEvents.filter((e) => e.id !== newEvent.id)];
    void this.persist();
  },

  revokeAdmin(input: {
    actorId: string | null;
    actorName: string;
    targetUserId: string;
    targetName: string;
    targetEmail: string;
    title: string;
    subtitle: string;
    timeLabel: string;
  }) {
    this.revokedIds.add(input.targetUserId);
    this.promotedIds.delete(input.targetUserId);
    const now = new Date().toISOString();
    const newEvent: LocalPermissionEvent = {
      id: `role-revoke-${input.targetUserId}-${Date.now()}`,
      actorId: input.actorId,
      actorName: input.actorName,
      action: 'role.revoke',
      targetUserId: input.targetUserId,
      targetName: input.targetName,
      targetEmail: input.targetEmail,
      title: input.title,
      subtitle: input.subtitle,
      time: input.timeLabel,
      timeLabel: input.timeLabel,
      dotColor: '#EF4444',
      createdAt: now,
      safeChanges: {
        role: 'customer',
        target_name: input.targetName,
        revoked_from: input.targetName,
        email: input.targetEmail,
      },
    };
    this.auditEvents = [newEvent, ...this.auditEvents.filter((e) => e.id !== newEvent.id)];
    void this.persist();
  },

  toggleSuspend(input: {
    actorId: string | null;
    actorName: string;
    targetUserId: string;
    targetName: string;
    targetEmail: string;
    title: string;
    subtitle: string;
    timeLabel: string;
    isSuspended: boolean;
  }) {
    if (this.suspendedIds.has(input.targetUserId)) {
      this.suspendedIds.delete(input.targetUserId);
    } else {
      this.suspendedIds.add(input.targetUserId);
    }
    const now = new Date().toISOString();
    const newEvent: LocalPermissionEvent = {
      id: `role-suspend-${input.targetUserId}-${Date.now()}`,
      actorId: input.actorId,
      actorName: input.actorName,
      action: input.isSuspended ? 'role.suspend' : 'role.reactivate',
      targetUserId: input.targetUserId,
      targetName: input.targetName,
      targetEmail: input.targetEmail,
      title: input.title,
      subtitle: input.subtitle,
      time: input.timeLabel,
      timeLabel: input.timeLabel,
      dotColor: input.isSuspended ? '#F59E0B' : '#10B981',
      createdAt: now,
      safeChanges: {
        status: input.isSuspended ? 'suspended' : 'active',
        target_name: input.targetName,
        account: input.targetName,
        email: input.targetEmail,
      },
    };
    this.auditEvents = [newEvent, ...this.auditEvents.filter((e) => e.id !== newEvent.id)];
    void this.persist();
  },

  toAuditLogRows(): AdminAuditLogRow[] {
    return this.auditEvents
      .filter((e) => Boolean(e && e.id))
      .map((e) => ({
        id: e.id,
        actor_user_id: e.actorId ?? null,
        action: e.action || 'role.grant',
        entity_type: 'user_roles',
        entity_id: e.targetUserId || null,
        safe_changes: (e.safeChanges ?? {}) as any,
        created_at: e.createdAt || new Date().toISOString(),
      }));
  },
};
