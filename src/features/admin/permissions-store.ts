/** Retired: account authority and immutable audit events are stored on the server.
 * Kept only so older report consumers return no fabricated local audit entries.
 */
export const permissionsStore = {
  async load() { return { promoted: new Set<string>(), revoked: new Set<string>(), suspended: new Set<string>(), events: [] }; },
  toAuditLogRows() { return []; },
};
