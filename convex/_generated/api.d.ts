/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as authorize from "../authorize.js";
import type * as functions from "../functions.js";
import type * as hunts from "../hunts.js";
import type * as idents from "../idents.js";
import type * as questions from "../questions.js";
import type * as quizzes from "../quizzes.js";
import type * as reading from "../reading.js";
import type * as reviews from "../reviews.js";
import type * as testing from "../testing.js";
import type * as writing_account_actions from "../writing/account_actions.js";
import type * as writing_layout_actions from "../writing/layout_actions.js";
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
  authorize: typeof authorize;
  functions: typeof functions;
  hunts: typeof hunts;
  idents: typeof idents;
  questions: typeof questions;
  quizzes: typeof quizzes;
  reading: typeof reading;
  reviews: typeof reviews;
  testing: typeof testing;
  "writing/account_actions": typeof writing_account_actions;
  "writing/layout_actions": typeof writing_layout_actions;
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

export declare const components: {};
