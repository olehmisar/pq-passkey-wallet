/** Dev-only Nitro routes (Anvil cheats) vs production testnet relay routes. */
export function apiRoute(devPath: string, prodPath: string): string {
  return import.meta.env.DEV ? devPath : prodPath;
}
