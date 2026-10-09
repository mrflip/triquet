// recheck's pure build, the one `lib/redos.ts` imports: the same `check` and `checkSync` the
// package's root declares, which its root types. Its root module is the Node build, which starts
// a worker thread or a native process, and neither is there in Convex's runtime.
declare module 'recheck/lib/browser.js' {
  export * from 'recheck'
}
