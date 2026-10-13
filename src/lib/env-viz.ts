// How the stats page shows the environment it was built in: every variable by name, under the
// group its concern puts it in, and of its value only what `ENV_VAR_VIZ` allows. The page masks
// the environment as it is built, server-side, and a view takes the result as a prop, so no value
// it hides ever reaches a browser; the groups are of names alone, and a view may sort them itself.

/** How much of a variable's value the stats page shows: all of it, its ends (`snip`), or none */
export type VizKindT = 'show' | 'snip' | 'mask'

/** What the page shows, in parentheses, in place of a value: masked, not listed in `ENV_VAR_VIZ`, or one with nothing to show */
export type StandinT = 'not shown' | 'not shown, no def' | 'null' | 'undefined' | 'blank'

/** What may be seen of one variable: as much of its value as is shown, or what stands in for it */
export type EnvShownT = { seen: string } | { standin: StandinT }

/** The environment as the stats page shows it: each variable's name, and what may be seen of it */
export type EnvVizT = Record<string, EnvShownT>

/** The environment as it is handed over: a value may be missing, whatever `process.env`'s type says */
export type EnvHandedT = Readonly<Record<string, string | null | undefined>>

/**
 * How much of each variable's value the stats page shows. A variable not listed here is masked,
 * and falls in the `unknown` group whatever its name. Every variable of a production build on
 * Vercel is listed (`fixtures/vercel-build-env.txt`): its ids, endpoints, tokens and blobs masked.
 */
export const ENV_VAR_VIZ: Readonly<Record<string, VizKindT>> = {
  __NEXT_PRERENDER_CLIENT_ASSET_SUFFIX:                 'show',
  __VERCEL_BUILD_RUNNING:                               'show',
  ANTHROPIC_API_KEY:                                    'snip',
  AUTH_GOOGLE_ID:                                       'snip',
  AUTH_GOOGLE_SECRET:                                   'mask',
  AWS_EXECUTION_ENV:                                    'show',
  BUN_INSTALL_GLOBAL_STORE:                             'show',
  CARGO_HOME:                                           'show',
  CI:                                                   'show',
  CONVEX_DEPLOY_KEY:                                    'mask',
  CONVEX_SELF_HOSTED_URL:                               'show',
  CONVEX_SITE_URL:                                      'show',
  DD_TAGS:                                              'mask',
  DD_TRACE_STARTUP_LOGS:                                'show',
  DOPPLER_CONFIG:                                       'show',
  DOPPLER_ENVIRONMENT:                                  'show',
  DOPPLER_PROJECT:                                      'show',
  ENABLE_ANTHROPIC_BOT:                                 'show',
  EXPOSE_INTERNAL_STATS_TO_ALL:                         'show',
  FAKEROOTKEY:                                          'mask',
  HOME:                                                 'show',
  INIT_CWD:                                             'show',
  IS_NEXT_WORKER:                                       'show',
  KILROYWUZHERE:                                        'show',
  LANG:                                                 'show',
  LOGGING:                                              'show',
  NEXT_ADAPTER_PATH:                                    'show',
  NEXT_ADAPTER_VERCEL_CONFIG:                           'mask',
  NEXT_DEPLOYMENT_ID:                                   'show',
  NEXT_DIST_DIR:                                        'show',
  NEXT_EDGE_RUNTIME_PROVIDER:                           'show',
  NEXT_ENABLE_ADAPTER:                                  'show',
  NEXT_EXPERIMENTAL_LARGE_FUNCTIONS:                    'show',
  NEXT_IS_EXPORT_WORKER:                                'show',
  NEXT_PHASE:                                           'show',
  NEXT_PRIVATE_MULTI_PAYLOAD:                           'show',
  NEXT_PRIVATE_OUTPUT_TRACE_ROOT:                       'show',
  NEXT_PRIVATE_START_TIME:                              'show',
  NEXT_PRIVATE_TARGET:                                  'show',
  NEXT_PUBLIC_CONVEX_SITE_URL:                          'show',
  NEXT_PUBLIC_CONVEX_URL:                               'show',
  NEXT_PUBLIC_TRIQUET_COMMIT_DEBOUNCE_SECONDS:          'show',
  NEXT_PUBLIC_VERCEL_BRANCH_URL:                        'show',
  NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID:                     'show',
  NEXT_PUBLIC_VERCEL_ENV:                               'show',
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_LOGIN:           'show',
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_NAME:            'show',
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE:                'show',
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF:                    'show',
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:                    'show',
  NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA:                  'show',
  NEXT_PUBLIC_VERCEL_GIT_PROVIDER:                      'show',
  NEXT_PUBLIC_VERCEL_GIT_PULL_REQUEST_ID:               'show',
  NEXT_PUBLIC_VERCEL_GIT_REPO_ID:                       'show',
  NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER:                    'show',
  NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG:                     'show',
  NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG:       'mask',
  NEXT_PUBLIC_VERCEL_PROJECT_ID:                        'snip',
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:            'show',
  NEXT_PUBLIC_VERCEL_TARGET_ENV:                        'show',
  NEXT_PUBLIC_VERCEL_URL:                               'show',
  NEXT_RUNTIME:                                         'show',
  NEXT_SHARP_PATH:                                      'show',
  NODE:                                                 'show',
  NODE_ENV:                                             'show',
  NODE_OPTIONS:                                         'show',
  NODE_PATH:                                            'show',
  NOW_BUILDER:                                          'show',
  npm_config_user_agent:                                'show',
  npm_execpath:                                         'show',
  npm_lifecycle_event:                                  'show',
  npm_lifecycle_script:                                 'show',
  npm_node_execpath:                                    'show',
  npm_package_engines_node:                             'show',
  npm_package_json:                                     'show',
  npm_package_name:                                     'show',
  npm_package_version:                                  'show',
  NX_DAEMON:                                            'show',
  PATH:                                                 'show',
  pnpm_config_verify_deps_before_run:                   'show',
  PNPM_SCRIPT_SRC_DIR:                                  'show',
  PORT:                                                 'show',
  PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG:            'mask',
  PWD:                                                  'show',
  REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG:         'mask',
  RUNTIME_CACHE_ENDPOINT:                               'mask',
  RUNTIME_CACHE_HEADERS:                                'mask',
  RUST_MIN_STACK:                                       'show',
  RUSTUP_HOME:                                          'show',
  SHLVL:                                                'show',
  SITE_URL:                                             'show',
  TRACEPARENT:                                          'show',
  TRACESTATE:                                           'show',
  TRIQUET_CLEARABLE:                                    'show',
  TRIQUET_ENV:                                          'show',
  TRIQUET_EVERYONE_ADMIN:                               'show',
  TRIQUET_LANE:                                         'show',
  TURBO_CACHE:                                          'show',
  TURBO_CI_VENDOR_ENV_KEY:                              'mask',
  TURBO_DOWNLOAD_LOCAL_ENABLED:                         'show',
  TURBO_ENGINE_READ_CONCURRENCY:                        'show',
  TURBO_PLATFORM_ENV:                                   'show',
  TURBO_REMOTE_ONLY:                                    'show',
  TURBO_RUN_SUMMARY:                                    'show',
  TURBOPACK:                                            'show',
  TZ:                                                   'show',
  UV_PYTHON_BIN_DIR:                                    'show',
  UV_PYTHON_DOWNLOADS:                                  'show',
  UV_PYTHON_DOWNLOADS_JSON_URL:                         'mask',
  UV_PYTHON_INSTALL_DIR:                                'show',
  UV_PYTHON_PREFERENCE:                                 'show',
  UV_THREADPOOL_SIZE:                                   'show',
  VERCEL:                                               'show',
  VERCEL_API_BUILD_CONTAINERS_ENDPOINT:                 'mask',
  VERCEL_API_ENDPOINT:                                  'mask',
  VERCEL_ARTIFACTS_OWNER:                               'mask',
  VERCEL_ARTIFACTS_TOKEN:                               'mask',
  VERCEL_BRANCH_URL:                                    'show',
  VERCEL_BUILD_GLOB_FAST_PATH:                          'show',
  VERCEL_BUILD_IMAGE:                                   'show',
  VERCEL_BUILD_MONOREPO_SUPPORT:                        'show',
  VERCEL_BUILD_ORDER_LISTENER_PORT:                     'show',
  VERCEL_BUILD_OUTPUTS_DOWNLOAD_FILE_SEMA:              'show',
  VERCEL_BUILD_OUTPUTS_GO_MAX_IN_FLIGHT:                'show',
  VERCEL_BUILD_OUTPUTS_GO_MAX_SOCKETS:                  'show',
  VERCEL_BUILD_OUTPUTS_GO_WORKER_PROCESS:               'show',
  VERCEL_BUILD_OUTPUTS_PATHS_METADATA_UPLOAD_SEMA:      'show',
  VERCEL_BUILD_OUTPUTS_POST_LAMBDA_SEMA:                'show',
  VERCEL_BUILD_OUTPUTS_S3_HEAD_SEMA:                    'show',
  VERCEL_BUILD_OUTPUTS_S3_OUTPUT_RECORDS_SEMA:          'show',
  VERCEL_BUILD_OUTPUTS_S3_SEMA:                         'show',
  VERCEL_BUILD_PROVIDER:                                'show',
  VERCEL_BUILDERS_DIR:                                  'show',
  VERCEL_BYPASS_API_ROUTES:                             'show',
  VERCEL_CLI_ROLLOUT_VERSION:                           'show',
  VERCEL_CLUSTER:                                       'show',
  VERCEL_COMPACT_POST_LAMBDA:                           'show',
  VERCEL_COMPRESS_SERVERLESS_RESPONSE:                  'show',
  VERCEL_COMPRESSED_ISR_BILLING:                        'show',
  VERCEL_CONSOLIDATE_CREATE_METADATA:                   'show',
  VERCEL_CONTAINER_START_TIME:                          'show',
  VERCEL_DEPLOYMENT_ID:                                 'show',
  VERCEL_DEPLOYMENT_KEY:                                'mask',
  VERCEL_DEPLOYMENT_USE_REDIS_PUB_SUB_FOR_ALIAS_EVENT:  'show',
  VERCEL_DETECT_CRYPTO_MINER_IN_BUILD_LOG:              'show',
  VERCEL_DISCOVER_FOLDER_SIZES:                         'show',
  VERCEL_EDGE_FNS_ON_SERVERLESS:                        'show',
  VERCEL_EDGE_FNS_ON_SERVERLESS_USE_FILESYSTEM_CONTENT: 'show',
  VERCEL_EDGE_FNS_ON_WORKERD:                           'show',
  VERCEL_EDGE_FNS_ON_WORKERD_UNBUNDLED_FORMAT:          'show',
  VERCEL_EDGE_FUNCTIONS_BATCH_SIZE:                     'show',
  VERCEL_EDGE_FUNCTIONS_ENABLE_CREATE_FUNC_DEDUPE:      'show',
  VERCEL_EDGE_FUNCTIONS_MEMORY_SIZE:                    'show',
  VERCEL_EDGE_FUNCTIONS_USE_FILESYSTEM_CONTENT:         'show',
  VERCEL_EDGE_FUNCTIONS_WITH_NODEJS_24:                 'show',
  VERCEL_EDGE_MIDDLEWARE_MEMORY_SIZE:                   'show',
  VERCEL_EDGE_MIDDLEWARE_WITH_NODEJS_24:                'show',
  VERCEL_EDGE_ON_SERVERLESS_NODE:                       'show',
  VERCEL_ENABLE_BASIC_BUILD_MACHINES_ROUTING:           'show',
  VERCEL_ENABLE_BLOCKED_PACKAGE_ENFORCEMENT:            'show',
  VERCEL_ENABLE_BUILD_CONTAINER_SOURCE_PREFETCH:        'show',
  VERCEL_ENABLE_BUN_1_4_LAYER_INJECTION:                'show',
  VERCEL_ENABLE_DIRECT_BUILD_EXECUTION:                 'show',
  VERCEL_ENABLE_EXTENDED_FALLBACK_PAYLOAD:              'show',
  VERCEL_ENABLE_FUNCTION_ENV_DOCUMENT_WRITE:            'show',
  VERCEL_ENABLE_FUNCTIONS_INTERFACE_V2:                 'show',
  VERCEL_ENABLE_GIT_PERFORMANCE_CONFIGURATION:          'show',
  VERCEL_ENABLE_INTERNAL_MIDDLEWARE_CACHE:              'show',
  VERCEL_ENABLE_INTERNAL_MIDDLEWARE_PREFETCH:           'show',
  VERCEL_ENABLE_MALWARE_MANIFEST:                       'show',
  VERCEL_ENABLE_PARALLEL_CACHE_DOWNLOAD:                'show',
  VERCEL_ENABLE_PATH_LOOKUP_BLOOM_FILTER:               'show',
  VERCEL_ENABLE_REGIONALIZED_ISR:                       'show',
  VERCEL_ENABLE_STAGED_BUILD_CONTAINER_ROLLOUT:         'show',
  VERCEL_ENABLE_UNCOMPRESSED_LAMBDA_SIZE_CHECK:         'show',
  VERCEL_ENABLE_VERCEL_TOML:                            'show',
  VERCEL_ENABLE_VHS_FUNCTION_IMAGES:                    'show',
  VERCEL_ENABLE_WORKFLOW_CONSUMER_CHECK:                'show',
  VERCEL_ENCRYPTED_ENV_CONTENT:                         'mask',
  VERCEL_ENCRYPTED_ENV_FILENAME:                        'show',
  VERCEL_ENV:                                           'show',
  VERCEL_ENV_ENC_KEY:                                   'mask',
  VERCEL_EVAL_LAMBDA_GROUPING_RATIO:                    'show',
  VERCEL_EXPERIMENTAL_BUILD_CONCURRENCY:                'show',
  VERCEL_FASTAPI_STATIC_CDN:                            'show',
  VERCEL_FORCE_FUNCTION_VHS_BUILDS:                     'show',
  VERCEL_FUNCTION_REGIONS:                              'show',
  VERCEL_FUNCTION_VSM_ENV_S3_ONLY:                      'show',
  VERCEL_FUNCTION_VSM_S3_WRITE:                         'show',
  VERCEL_GIT_COMMIT_AUTHOR_LOGIN:                       'show',
  VERCEL_GIT_COMMIT_AUTHOR_NAME:                        'show',
  VERCEL_GIT_COMMIT_MESSAGE:                            'show',
  VERCEL_GIT_COMMIT_REF:                                'show',
  VERCEL_GIT_COMMIT_SHA:                                'show',
  VERCEL_GIT_PREVIOUS_SHA:                              'show',
  VERCEL_GIT_PROVIDER:                                  'show',
  VERCEL_GIT_PULL_REQUEST_ID:                           'show',
  VERCEL_GIT_REPO_ID:                                   'show',
  VERCEL_GIT_REPO_OWNER:                                'show',
  VERCEL_GIT_REPO_SLUG:                                 'show',
  VERCEL_HASH_SALT:                                     'mask',
  VERCEL_HIVE_BANDWIDTH:                                'show',
  VERCEL_HIVE_CELL_ID:                                  'mask',
  VERCEL_HIVE_ID:                                       'mask',
  VERCEL_HIVE_INSTANCE_TYPE:                            'show',
  VERCEL_HIVE_IOPS:                                     'show',
  VERCEL_HIVE_REALM:                                    'show',
  VERCEL_HIVE_VERSION:                                  'show',
  VERCEL_IMAGE_ID:                                      'mask',
  VERCEL_IMMUTABLE_STATIC_FILES_ENABLED:                'show',
  VERCEL_INCLUDE_GROUP_IN_MANIFEST:                     'show',
  VERCEL_INVALIDATE_BUILD_CACHE_ON_SIZE_EXCEEDED:       'show',
  VERCEL_LAMBDA_OUTPUTS_AS_MIDDLEWARE:                  'show',
  VERCEL_LOCAL_NPM_PROXY:                               'mask',
  VERCEL_LOCKFILE_SCANNER:                              'show',
  VERCEL_MIDDLEWARE_DEFAULT_RUNTIME_NODEJS:             'show',
  VERCEL_NEXT_BUNDLED_SERVER:                           'show',
  VERCEL_NODE_BRIDGE_COMPRESS_MULTI_PAYLOADS:           'show',
  VERCEL_NODE_MODULES_SCANNER:                          'show',
  VERCEL_OBSERVABILITY_CLIENT_CONFIG:                   'mask',
  VERCEL_OIDC_TOKEN:                                    'mask',
  VERCEL_ORG_ID:                                        'snip',
  VERCEL_PREFER_NEXTJS_PREVIEW_COMMENTS_INJECTION:      'show',
  VERCEL_PREVIEW_COMMENTS_ENABLED:                      'show',
  VERCEL_PREWARM_CLI:                                   'show',
  VERCEL_PROJECT_ID:                                    'snip',
  VERCEL_PROJECT_NAME:                                  'show',
  VERCEL_PROJECT_PRODUCTION_URL:                        'show',
  VERCEL_PROJECT_SETTINGS_BUILD_COMMAND:                'show',
  VERCEL_PROJECT_SETTINGS_NODE_VERSION:                 'show',
  VERCEL_PYTHON_COMPILEALL:                             'show',
  VERCEL_RESOLVE_ROOT_DIRECTORY:                        'show',
  VERCEL_RICHER_DEPLOYMENT_OUTPUTS:                     'show',
  VERCEL_SERVERLESS_FUNCTION_FAILOVER:                  'show',
  VERCEL_SERVERLESS_SUSPENSE_CACHE:                     'show',
  VERCEL_SET_REQUESTED_AT_PRODUCTION_ON_DEPLOYMENT:     'show',
  VERCEL_SKIP_DEPLOYMENT_BUILDS_READ_FOR_CLI_BUILDS:    'show',
  VERCEL_SKIP_EDGE_FUNCTION_ENDPOINT:                   'show',
  VERCEL_SKIP_EMPTY_FUNCTION_PATH_UPLOADS:              'show',
  VERCEL_SKIP_METADATA_PATH:                            'show',
  VERCEL_SKIP_PER_PATH_METADATA:                        'show',
  VERCEL_TARGET_ENV:                                    'show',
  VERCEL_TELEMETRY_DISABLED:                            'show',
  VERCEL_TOML_CONFIG_ENABLED:                           'show',
  VERCEL_UNIVERSAL_ENCRYPTED_ENV_FILE_SUPPORT:          'show',
  VERCEL_URL:                                           'show',
  VERCEL_USE_API_CONNECTORS:                            'show',
  VERCEL_USE_BYTECODE_CACHING:                          'show',
  VERCEL_USE_DEFAULT_PNPM_10:                           'show',
  VERCEL_USE_HASHED_ISR_CACHE_KEY:                      'mask',
  VERCEL_USE_NEW_LAMBDA_OUTPUT_HANDLER:                 'show',
  VERCEL_USE_ONLY_STREAMING_LAMBDA:                     'show',
  VERCEL_USE_START_CELL:                                'show',
  VERCEL_USE_STREAMING_PRERENDER:                       'show',
  VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG:              'mask',
  YARN_NODE_LINKER:                                     'show',
}

/**
 * Which group of the stats page's environment panel a variable listed in `ENV_VAR_VIZ` falls in,
 * by its concern: the first whose pattern its name matches. One that matches none is `other`, and
 * one `ENV_VAR_VIZ` does not list is `unknown`, whatever it matches. `main` holds the few worth
 * reading first, and is the only group open to begin with.
 */
export const ENV_VAR_GROUPS: Readonly<Record<string, RegExp>> = {
  'main':          anyOf(/TRIQUET_ENV/, /NODE_ENV/, /VERCEL_ENV/, /VERCEL_URL/, /VERCEL_GIT_COMMIT_(REF|SHA)/, /NEXT_PUBLIC_CONVEX_URL/, /DOPPLER_CONFIG/, /LOGGING/, /KILROYWUZHERE/, /ENABLE_ANTHROPIC_BOT/, /EXPOSE_INTERNAL_STATS_TO_ALL/),
  'app':           anyOf(/TRIQUET_\w+/, /NEXT_PUBLIC_TRIQUET_\w+/, /SITE_URL/, /PORT/),
  'auth':          anyOf(/AUTH_\w+/, /VERCEL_OIDC_TOKEN/),
  'bots':          anyOf(/ANTHROPIC_\w+/),
  'backend':       anyOf(/(NEXT_PUBLIC_)?CONVEX_\w+/),
  'settings':      anyOf(/DOPPLER_\w+/, /VERCEL_ENCRYPTED_ENV_\w+/, /VERCEL_ENV_ENC_KEY/, /VERCEL_UNIVERSAL_ENCRYPTED_ENV_FILE_SUPPORT/),
  'git':           anyOf(/(NEXT_PUBLIC_)?VERCEL_GIT_\w+/, /VERCEL_ENABLE_GIT_\w+/),
  'deployment':    anyOf(/NEXT_DEPLOYMENT_ID/, /(NEXT_PUBLIC_)?VERCEL_(ENV|URL|BRANCH_URL|TARGET_ENV|ORG_ID|DEPLOYMENT_\w+)/, /(NEXT_PUBLIC_)?VERCEL_PROJECT_(ID|NAME|PRODUCTION_URL)/, /VERCEL_\w*PREVIEW_COMMENTS\w*/, /VERCEL_SET_REQUESTED_AT_PRODUCTION_ON_DEPLOYMENT/),
  'logging':       anyOf(/DD_\w+/, /TRACE(PARENT|STATE)/, /((NEXT_PUBLIC|PUBLIC|REACT_APP|VITE)_)?VERCEL_OBSERVABILITY_CLIENT_CONFIG/, /VERCEL_TELEMETRY_DISABLED/),
  'safeguards':    anyOf(/VERCEL_DETECT_CRYPTO_MINER_IN_BUILD_LOG/, /VERCEL_ENABLE_BLOCKED_PACKAGE_ENFORCEMENT/, /VERCEL_ENABLE_MALWARE_MANIFEST/, /VERCEL_(LOCKFILE|NODE_MODULES)_SCANNER/),
  'edge workers':  anyOf(/NEXT_EDGE_\w+/, /VERCEL_\w*(EDGE|MIDDLEWARE)\w*/),
  'caching':       anyOf(/RUNTIME_CACHE_\w+/, /TURBO_(CACHE|REMOTE_ONLY|DOWNLOAD_LOCAL_ENABLED)/, /VERCEL_ARTIFACTS_\w+/, /VERCEL_\w*_ISR\w*/, /VERCEL_ENABLE_PARALLEL_CACHE_DOWNLOAD/, /VERCEL_INVALIDATE_BUILD_CACHE_ON_SIZE_EXCEEDED/, /VERCEL_SERVERLESS_SUSPENSE_CACHE/, /VERCEL_IMMUTABLE_STATIC_FILES_ENABLED/),
  'functions':     anyOf(/NEXT_EXPERIMENTAL_LARGE_FUNCTIONS/, /NEXT_PRIVATE_MULTI_PAYLOAD/, /NEXT_RUNTIME/, /VERCEL_\w*(FUNCTION|LAMBDA|SERVERLESS)\w*/, /VERCEL_NODE_BRIDGE_\w+/, /VERCEL_USE_BYTECODE_CACHING/, /VERCEL_ENABLE_WORKFLOW_CONSUMER_CHECK/, /VERCEL_USE_START_CELL/),
  'routing':       anyOf(/VERCEL_BYPASS_API_ROUTES/, /VERCEL_USE_API_CONNECTORS/, /VERCEL_ENABLE_PATH_LOOKUP_BLOOM_FILTER/, /VERCEL_ENABLE_EXTENDED_FALLBACK_PAYLOAD/),
  'next':          anyOf(/__NEXT_\w+/, /NEXT_(?!PUBLIC_)\w+/, /IS_NEXT_WORKER/, /TURBOPACK/, /VERCEL_NEXT_BUNDLED_SERVER/, /VERCEL_USE_STREAMING_PRERENDER/),
  'node':          anyOf(/NODE/, /NODE_(OPTIONS|PATH)/, /INIT_CWD/, /UV_THREADPOOL_SIZE/, /(npm|pnpm|PNPM|YARN|BUN)_\w+/, /VERCEL_LOCAL_NPM_PROXY/, /VERCEL_USE_DEFAULT_PNPM_10/, /VERCEL_ENABLE_BUN_\w+/),
  'toolchains':    anyOf(/CARGO_HOME/, /RUSTUP_HOME/, /RUST_\w+/, /UV_PYTHON_\w+/, /VERCEL_(PYTHON|FASTAPI)_\w+/),
  'build machine': anyOf(/VERCEL/, /NOW_BUILDER/, /AWS_EXECUTION_ENV/, /VERCEL_BUILDERS_DIR/, /VERCEL_(HIVE|API|CLI)_\w+/, /VERCEL_(PREWARM_CLI|CLUSTER|CONTAINER_START_TIME|IMAGE_ID)/),
  'build':         anyOf(/CI/, /NX_DAEMON/, /TURBO_\w+/, /__VERCEL_BUILD_RUNNING/, /VERCEL_BUILD_\w+/, /VERCEL_\w*BUILDS?_\w*/, /VERCEL_PROJECT_SETTINGS_\w+/, /VERCEL_\w*TOML\w*/, /VERCEL_(RESOLVE_ROOT_DIRECTORY|DISCOVER_FOLDER_SIZES|RICHER_DEPLOYMENT_OUTPUTS|INCLUDE_GROUP_IN_MANIFEST)/, /VERCEL_\w*METADATA\w*/, /VERCEL_HASH_SALT/),
  'shell':         anyOf(/HOME/, /PATH/, /PWD/, /LANG/, /TZ/, /SHLVL/, /FAKEROOTKEY/),
}

/** A pattern matching a whole name that any of `alternatives` matches */
function anyOf(...alternatives: readonly RegExp[]): RegExp {
  return new RegExp(`^(${alternatives.map((alternative) => alternative.source).join('|')})$`)
}

/** The group of a variable listed in `ENV_VAR_VIZ` that no pattern of `ENV_VAR_GROUPS` matches */
export const OtherGroup = 'other'

/** The group of a variable `ENV_VAR_VIZ` does not list */
export const UnknownGroup = 'unknown'

/** How many characters `snip` keeps at each end of a value at least so long, longest first: never more than half of it */
const SnipEnds: readonly (readonly [minlen: number, head: number, tail: number])[] = [
  [12, 2, 4],
  [8,  0, 4],
  [6,  0, 3],
]

/** The longest value `snip` stars out character for character; a longer one is shortened, its length hidden */
const LongestStarred = 18

/**
 * A value with all but its ends starred out, its characters other than letters, digits and `_`
 * dropped first. Of one longer than eighteen, the first two and last four, `****...****` between;
 * of one twelve to eighteen long, the first two and last four; of one eight to eleven long, the
 * last four; of one six or seven long, the last three; and nothing of a shorter one. Never more
 * than half of a value is shown, nor its length past eighteen.
 *
 * @param val - The value to snip.
 * @returns The value's letters, digits and underscores, those not shown replaced by `*`.
 *
 * @example snip('sk-ant-api03-abcdefghijklmnopqrstuvwxyz-WXYZ')  // => 'sk****...****WXYZ'
 * @example snip('abcdefghijklmn')  // => 'ab********klmn'
 * @example snip('abcd.efgh.ij')  // => '******ghij'
 * @example snip('abcdef')  // => '***def'
 * @example snip('abcde')  // => '*****'
 */
export function snip(val: string): string {
  const bare = val.replaceAll(/\W/g, '')
  if (bare.length > LongestStarred) { return `${bare.slice(0, 2)}****...****${bare.slice(-4)}` }
  const [, head, tail] = SnipEnds.find(([minlen]) => bare.length >= minlen) ?? [0, 0, 0]
  return bare.slice(0, head) + '*'.repeat(bare.length - head - tail) + bare.slice(bare.length - tail)
}

/**
 * Every variable in `env`, in order of name, with as much of its value as `viz` allows: all of it
 * for `show`, its ends for `snip`, and a stand-in otherwise. A value that is null, undefined or
 * blank says so whatever `viz` says of it, since it hides nothing; `not shown` stands in for one
 * masked, and `not shown, no def` for one `viz` does not list.
 *
 * @param env - The environment: `process.env`, as the page is built.
 * @param viz - How much of each variable to show (`ENV_VAR_VIZ`).
 *
 * @example visualize({ TRIQUET_ENV: 'dev', AUTH_GOOGLE_SECRET: 'hunter2', HOME: '', TQ_LANE: '1', AUTH_GOOGLE_ID: 'abcdefghij' })
 *   // => { AUTH_GOOGLE_ID: { seen: '******ghij' }, AUTH_GOOGLE_SECRET: { standin: 'not shown' }, HOME: { standin: 'blank' },
 *   //      TQ_LANE: { standin: 'not shown, no def' }, TRIQUET_ENV: { seen: 'dev' } }
 */
export function visualize(env: EnvHandedT, viz: Readonly<Record<string, VizKindT>> = ENV_VAR_VIZ): EnvVizT {
  return Object.fromEntries(Object.entries(env)
    .toSorted(([aa], [bb]) => aa.localeCompare(bb))
    .map(([envvar, val]) => [envvar, shownOf(val, Object.hasOwn(viz, envvar) ? viz[envvar] : undefined)]))
}

/** What of `val` may be seen, by `vizkind`; undefined for a variable not listed */
function shownOf(val: string | null | undefined, vizkind: VizKindT | undefined): EnvShownT {
  if (val === null) { return { standin: 'null' } }
  if (val === undefined) { return { standin: 'undefined' } }
  if (val.trim() === '') { return { standin: 'blank' } }
  if (vizkind === undefined) { return { standin: 'not shown, no def' } }
  if (vizkind === 'mask') { return { standin: 'not shown' } }
  return { seen: vizkind === 'show' ? val : snip(val) }
}

/**
 * The group of the stats page's environment panel `envvar` falls in: `unknown` for one `viz` does
 * not list, else the first of `groups` whose pattern its name matches, else `other`.
 *
 * @example groupOf('VERCEL_GIT_REPO_SLUG')  // => 'git'
 * @example groupOf('TRIQUET_SOMETHING_NEW')  // => 'unknown', though `app`'s pattern matches it
 */
export function groupOf(envvar: string, viz: Readonly<Record<string, VizKindT>> = ENV_VAR_VIZ, groups: Readonly<Record<string, RegExp>> = ENV_VAR_GROUPS): string {
  if (! Object.hasOwn(viz, envvar)) { return UnknownGroup }
  return Object.entries(groups).find(([, pattern]) => pattern.test(envvar))?.[0] ?? OtherGroup
}

/**
 * The environment the page shows, split into its groups: in the order of `groups`, then `other`,
 * then `unknown`, leaving out any with nothing in it, and each in the order `env` gave.
 *
 * @example grouped({ HOME: { seen: '/root' }, TQ_LANE: { standin: 'not shown, no def' }, TRIQUET_ENV: { seen: 'dev' } })
 *   // => [['main', { TRIQUET_ENV: { seen: 'dev' } }], ['shell', { HOME: { seen: '/root' } }], ['unknown', { TQ_LANE: { standin: 'not shown, no def' } }]]
 */
export function grouped(env: EnvVizT, viz: Readonly<Record<string, VizKindT>> = ENV_VAR_VIZ, groups: Readonly<Record<string, RegExp>> = ENV_VAR_GROUPS): [grouplabel: string, env: EnvVizT][] {
  const bygroup = Object.groupBy(Object.entries(env), ([envvar]) => groupOf(envvar, viz, groups))
  return [...Object.keys(groups), OtherGroup, UnknownGroup].flatMap((grouplabel) => {
    const entries = bygroup[grouplabel]
    return entries ? [[grouplabel, Object.fromEntries(entries)] as [string, EnvVizT]] : []
  })
}
