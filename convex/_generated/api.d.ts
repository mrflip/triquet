/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authorize from "../authorize.js";
import type * as check_reserved from "../check_reserved.js";
import type * as deploying from "../deploying.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as hunts from "../hunts.js";
import type * as migrations from "../migrations.js";
import type * as policy_rules from "../policy_rules.js";
import type * as questions from "../questions.js";
import type * as quizzes from "../quizzes.js";
import type * as reading from "../reading.js";
import type * as reviews from "../reviews.js";
import type * as seeding from "../seeding.js";
import type * as signalling from "../signalling.js";
import type * as stamping from "../stamping.js";
import type * as stats from "../stats.js";
import type * as testing from "../testing.js";
import type * as triggers from "../triggers.js";
import type * as users from "../users.js";
import type * as widgets from "../widgets.js";
import type * as writing_hunt_actions from "../writing/hunt_actions.js";
import type * as writing_huntship_actions from "../writing/huntship_actions.js";
import type * as writing_layout_actions from "../writing/layout_actions.js";
import type * as writing_library_actions from "../writing/library_actions.js";
import type * as writing_perform from "../writing/perform.js";
import type * as writing_quiz_actions from "../writing/quiz_actions.js";
import type * as writing_quiz_writing from "../writing/quiz_writing.js";
import type * as writing_regex_vetting from "../writing/regex_vetting.js";
import type * as writing_review_actions from "../writing/review_actions.js";
import type * as writing_user_actions from "../writing/user_actions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authorize: typeof authorize;
  check_reserved: typeof check_reserved;
  deploying: typeof deploying;
  functions: typeof functions;
  http: typeof http;
  hunts: typeof hunts;
  migrations: typeof migrations;
  policy_rules: typeof policy_rules;
  questions: typeof questions;
  quizzes: typeof quizzes;
  reading: typeof reading;
  reviews: typeof reviews;
  seeding: typeof seeding;
  signalling: typeof signalling;
  stamping: typeof stamping;
  stats: typeof stats;
  testing: typeof testing;
  triggers: typeof triggers;
  users: typeof users;
  widgets: typeof widgets;
  "writing/hunt_actions": typeof writing_hunt_actions;
  "writing/huntship_actions": typeof writing_huntship_actions;
  "writing/layout_actions": typeof writing_layout_actions;
  "writing/library_actions": typeof writing_library_actions;
  "writing/perform": typeof writing_perform;
  "writing/quiz_actions": typeof writing_quiz_actions;
  "writing/quiz_writing": typeof writing_quiz_writing;
  "writing/regex_vetting": typeof writing_regex_vetting;
  "writing/review_actions": typeof writing_review_actions;
  "writing/user_actions": typeof writing_user_actions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
