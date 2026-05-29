export function withBootTimeout<T>(promise: Promise<T>, ms: number, label = 'Auth bootstrap timeout'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(label)), ms);
    }),
  ]);
}
