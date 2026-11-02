/** Navigation promises must not outlive their focused checkout step. */
export function createStepRequestGuard() {
  let generation = 0;
  return { begin: () => ++generation, cancel: () => { generation++; }, isCurrent: (token: number) => token === generation };
}
