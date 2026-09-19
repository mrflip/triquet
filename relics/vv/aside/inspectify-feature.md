My existing error handler uses the Node::Util inspect method, which is not available in Next.js; even trying to import it catches fire without a workaround. It does a very useful thing, however: shows me the true state of even a horribly nested giant object without blowing up the console; and it shows values set to `undefined`, which are (a) often the most important to know about and (b) swallowed during a json emit.

This document was prepared by Gemini fast mode -- a much less capable agent than you. it does capture parts of what I want. I want
1. a function called inspectify(val: any, opts: InspectOptions)
2. that function must be immediate (**NON-async**) and never itself throw: fall back to jsonify, fall back to String(val)
3. there must be some version of it on client and server side
4. no heroics.
5. strong preference for whatever option goes with the framework recommendations
6. if it's possible to, on the server side, have node:util's inspect deliver inspectify's contract, I'm in joy.
   1. I don't yet care what things are output in server code: you decide if we do anything fancier than a JSON dump and if so how to do it.
   2. write according to our conventions, not Geminii's

---

To keep inspectify completely synchronous while ensuring the client bundle never touches or compiles node:util, you cannot use dynamic import(). Instead, you must use Next.js's bundler-level resolution via separate files, or a unified module using standard require() wrapped in a try/catch block that Webpack and Turbopack can safely optimize away.
Here are the two best options to achieve a zero-overhead, synchronous boundary.

## Option 1: The require Safe-Guarded Module (Unified File)
Next.js's bundlers are highly optimized for dead-code elimination. By combining typeof window with a standard Node require, the server gets the native speed of node:util, while the client bundler completely shakes out the server-side block, preventing any "Module not found" or compilation errors.

// utils/inspectify.ts
export interface InspectOptions {
  depth?: number | null;
  showHidden?: boolean;
}
// 1. Precise, lightweight synchronous browser formatterfunction customClientFormat(val: unknown, depth: number | null, currentDepth = 0): string {
  if (depth !== null && currentDepth > depth) return '[Object]';
  if (val === undefined) return 'undefined';
  if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`;
  if (typeof val === 'symbol') return val.toString();
  if (val === null) return 'null';

  if (typeof val === 'object') {
    if (val instanceof Error) return `${val.name}: ${val.message}`;
    if (val instanceof Date) return `[Date: ${val.toISOString()}]`;
    if (Array.isArray(val)) {
      const items = val.map(item => customClientFormat(item, depth, currentDepth + 1));
      return `[ ${items.join(', ')} ]`;
    }

    // Custom handling for Lodash-style collection abstractions, Maps, or Sets if needed
    if (val instanceof Map) {
      const entries: string[] = [];
      val.forEach((v, k) => entries.push(`${k} => ${customClientFormat(v, depth, currentDepth + 1)}`));
      return `Map(${val.size}) { ${entries.join(', ')} }`;
    }

    // Manually read own keys so undefined values are explicitly captured
    const keys = Reflect.ownKeys(val);
    if (keys.length === 0) return '{}';

    const fields = keys.map(key => {
      const k = typeof key === 'symbol' ? key.toString() : String(key);
      const v = customClientFormat((val as Record<string | symbol, unknown>)[key], depth, currentDepth + 1);
      return `${k}: ${v}`;
    });
    return `{ ${fields.join(', ')} }`;
  }

  return JSON.stringify(val);
}
/**
 * Synchronous object dump across Next.js runtime environments.
 */export function inspectify(obj: unknown, options: InspectOptions = {}): string {
  // Server-side path (Node.js runtime)
  if (typeof window === 'undefined') {
    try {
      // Next.js bundlers treat this branch as dead code on the client.
      // We use the string literal to prevent overly aggressive static analysis.
      const nodeUtil = require('node' + ':util');
      return nodeUtil.inspect(obj, {
        depth: options.depth ?? null,
        showHidden: options.showHidden ?? false,
        colors: false,
      });
    } catch {
      // Fallback in case of an edge environment runtime mismatch
    }
  }

  // Client-side path (Browser runtime)
  return customClientFormat(obj, options.depth ?? null);
}

## Option 2: Next.js/Webpack Subpath Imports (Zero Runtime Checks)
If you want perfect separation with zero typeof window execution overhead, use Next.js's native support for standard Node.js Subpath Imports. This configures the bundler to load entirely different files depending on the environment.

   1. In your project's root package.json, add an #imports mapping:

   {
     "imports": {
       "#inspect-env": {
         "node": "./utils/inspect.node.ts",
         "default": "./utils/inspect.browser.ts"
       }
     }
   }

   2. Create utils/inspect.node.ts (Server-only file):

   import { inspect } from 'node:util';import type { InspectOptions } from './inspectify';
   export function runInspect(obj: unknown, options: InspectOptions): string {
     return inspect(obj, { depth: options.depth ?? null, showHidden: options.showHidden ?? false, colors: false });
   }

   3. Create utils/inspect.browser.ts (Client-only file):

   import type { InspectOptions } from './inspectify';// Reuse your synchronous customClientFormat utility hereexport function runInspect(obj: unknown, options: InspectOptions): string {
     return customClientFormat(obj, options.depth ?? null);
   }

   4. Create your clean entry point in utils/inspectify.ts:

   // @ts-ignore - TypeScript requires paths/compiler setup for subpath imports, but NextJS resolves it out-of-the-boximport { runInspect } from '#inspect-env';
   export interface InspectOptions {
     depth?: number | null;
     showHidden?: boolean;
   }
   export function inspectify(obj: unknown, options: InspectOptions = {}): string {
     return runInspect(obj, options);
   }

   (Note: If using TypeScript with Option 2, add "#inspect-env": ["./utils/inspect.*"] to the paths object in your tsconfig.json to make the types resolve nicely).


