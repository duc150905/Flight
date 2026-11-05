type SuspensionPorts = {
  prepare(userId: string, suspended: boolean): Promise<string>;
  updateAuth(userId: string, suspended: boolean): Promise<void>;
  finish(userId: string, operationId: string): Promise<void>;
};
/** A failed or uncertain Auth request must leave the database denial in force. */
export async function changeAccountSuspension(ports: SuspensionPorts, userId: string, suspended: boolean) {
  const operationId = await ports.prepare(userId, suspended);
  await ports.updateAuth(userId, suspended);
  await ports.finish(userId, operationId);
}
