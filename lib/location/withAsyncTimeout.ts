/** Race an async task against a deadline — always settles within `ms`. */
export function withAsyncTimeout<T>(task: () => Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    task(),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
