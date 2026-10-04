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
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as hunts from "../hunts.js";
import type * as idents from "../idents.js";
import type * as migrations from "../migrations.js";
import type * as questions from "../questions.js";
import type * as quizzes from "../quizzes.js";
import type * as reading from "../reading.js";
import type * as reviews from "../reviews.js";
import type * as seeding from "../seeding.js";
import type * as testing from "../testing.js";
import type * as widgets from "../widgets.js";
import type * as writing_account_actions from "../writing/account_actions.js";
import type * as writing_hunt_actions from "../writing/hunt_actions.js";
import type * as writing_hunting_actions from "../writing/hunting_actions.js";
import type * as writing_layout_actions from "../writing/layout_actions.js";
import type * as writing_library_actions from "../writing/library_actions.js";
import type * as writing_perform from "../writing/perform.js";
import type * as writing_quiz_actions from "../writing/quiz_actions.js";
import type * as writing_quiz_writing from "../writing/quiz_writing.js";
import type * as writing_review_actions from "../writing/review_actions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authorize: typeof authorize;
  functions: typeof functions;
  http: typeof http;
  hunts: typeof hunts;
  idents: typeof idents;
  migrations: typeof migrations;
  questions: typeof questions;
  quizzes: typeof quizzes;
  reading: typeof reading;
  reviews: typeof reviews;
  seeding: typeof seeding;
  testing: typeof testing;
  widgets: typeof widgets;
  "writing/account_actions": typeof writing_account_actions;
  "writing/hunt_actions": typeof writing_hunt_actions;
  "writing/hunting_actions": typeof writing_hunting_actions;
  "writing/layout_actions": typeof writing_layout_actions;
  "writing/library_actions": typeof writing_library_actions;
  "writing/perform": typeof writing_perform;
  "writing/quiz_actions": typeof writing_quiz_actions;
  "writing/quiz_writing": typeof writing_quiz_writing;
  "writing/review_actions": typeof writing_review_actions;
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
