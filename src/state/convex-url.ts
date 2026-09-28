import * as Z from 'zod'

/**
 * Where this build's Convex deployment answers, from `NEXT_PUBLIC_CONVEX_URL`, or undefined when
 * the build was given none. Next inlines the variable at build time, so it is read by its literal
 * name.
 *
 * @param given - The variable's value.
 * @returns The URL.
 * @throws When the variable is set but is not a URL.
 *
 * @example convexUrl()  // => 'http://127.0.0.1:3401' under `pnpm dev:agent`
 */
export function convexUrl(given: string | undefined = process.env.NEXT_PUBLIC_CONVEX_URL): string | undefined {
  if (given === undefined || given === '') { return undefined }
  return Z.url().describe('Where the Convex deployment answers, from NEXT_PUBLIC_CONVEX_URL.').parse(given)
}
