import { schema as s } from "jazz-tools";

export default s.defineMigration({
  createTables: {
    "hunts": true,
    "identings": true,
    "idents": true,
    "realms": true,
  },
  dropTables: {
    "workspaces": true,
  },
  // Quizzes and expressions from before hunts belong to none: they point at the nil id, which no
  // hunt or realm has, and so are never read into one. Nothing of them was to be carried over.
  migrate: {
    "expressions": {
      "hunt_id": s.add.ref("hunts", { default: "00000000-0000-0000-0000-000000000000" }),
      "workspace_id": s.drop.ref("workspaces", { backwardsDefault: "00000000-0000-0000-0000-000000000000" }),
    },

    "quizzes": {
      "realm_id": s.add.ref("realms", { default: "00000000-0000-0000-0000-000000000000" }),
      "workspace_id": s.drop.ref("workspaces", { backwardsDefault: "00000000-0000-0000-0000-000000000000" }),
    },
  },
  fromHash: "a18e544018ca",
  toHash: "835fd1888faf",
  from: {
  "bottings": s.table({
    "question_id": s.uuid(),
    "bot_label": s.enum("dumdum", "numnum"),
    "textkind": s.enum("clueing", "hint"),
    "asked_text": s.string().optional(),
    "status": s.enum("done", "error"),
    "reply_text": s.string().optional(),
    "items": s.json(JSON.parse("{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"maxItems\":200,\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"text\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":3600,\"pattern\":\"^[\\\\P{Cc}\\\\t\\\\r\\\\n]*$\",\"description\":\"The span exactly as it appears in the source text, preserving punctuation, currency, and script: \\\"#17-19\\\", \\\"9,000+\\\", \\\"千\\\", \\\"douzaine\\\", \\\"Feb 27\\\". Shown verbatim so the author can see precisely what the model latched onto and judge whether a player would too.\"},\"value\":{\"type\":\"number\",\"description\":\"What a reasonable player would add up for that span. Magnitude phrases carry their whole value (\\\"300 million\\\" is 300000000, not 300), and fractions stay fractional (\\\"quarter\\\" is 0.25). Zod rejects NaN and Infinity here without further checks.\"},\"kind\":{\"type\":\"string\",\"enum\":[\"numeral\",\"wordish\"],\"description\":\"\\\"numeral\\\" when the span is written in digits, \\\"wordish\\\" when it reads as a number in words, as an ordinal, or as a magnitude phrase. The two are totalled separately so the author can compare the strict digits-only reading of a clue against the generous reading.\"}},\"required\":[\"text\",\"value\",\"kind\"],\"additionalProperties\":false,\"description\":\"One number-like span found in a clueing or a hint.\"},\"description\":\"A numnum reply: every number-like span it found, in the order they appear in the text asked. Empty for any other botting.\"}")).default("[]"),
    "message": s.string().optional(),
    "response": s.string().optional(),
    "truncated": s.boolean(),
    "model_tier_applied": s.enum("quick", "careful").optional(),
    "approx_tokens": s.int().optional(),
  }, {
    "question": s.rel("questions", "question_id"),
  }),
  "columns": s.table({
    "quiz_id": s.uuid(),
    "label": s.string(),
    "title": s.string(),
    "source": s.string(),
    "width_px": s.int(),
    "position": s.int(),
  }, {
    "quiz": s.rel("quizzes", "quiz_id"),
  }),
  "expressions": s.table({
    "workspace_id": s.uuid(),
    "owner": s.enum("tq"),
    "label": s.string(),
    "formula": s.string(),
    "description": s.string(),
    "position": s.int(),
  }, {
    "workspace": s.rel("workspaces", "workspace_id"),
  }),
  "questions": s.table({
    "quiz_id": s.uuid(),
    "position": s.int(),
    "label": s.string(),
    "forced_label": s.string().optional(),
    "title": s.string(),
    "qnum": s.string(),
    "clueing": s.string(),
    "hint": s.string(),
    "chains_to": s.string().optional(),
    "full_answer": s.string(),
    "alt_text": s.string(),
    "notes": s.string(),
  }, {
    "quiz": s.rel("quizzes", "quiz_id"),
    "bottings": s.reverse("bottings", "question"),
  }),
  "quizzes": s.table({
    "workspace_id": s.uuid(),
    "title": s.string(),
    "label": s.string(),
    "forced_label": s.string().optional(),
    "version": s.string(),
    "locked": s.boolean(),
    "last_sortkey": s.string().optional(),
    "bulk_ishes_last": s.string().optional(),
  }, {
    "workspace": s.rel("workspaces", "workspace_id"),
    "questions": s.reverse("questions", "quiz"),
    "widgets": s.reverse("widgets", "quiz"),
    "columns": s.reverse("columns", "quiz"),
  }),
  "widgets": s.table({
    "quiz_id": s.uuid(),
    "label": s.string(),
    "kind": s.enum("expressing", "botting"),
    "expression_label": s.string().optional(),
    "bot_label": s.enum("dumdum", "numnum").optional(),
    "textkind": s.enum("clueing", "hint").optional(),
    "description": s.string(),
    "position": s.int(),
  }, {
    "quiz": s.rel("quizzes", "quiz_id"),
  }),
  "workspaces": s.table({
    "active_quiz_id": s.uuid().optional(),
  }, {
    "active_quiz": s.rel("quizzes", "active_quiz_id"),
    "quizzes": s.reverse("quizzes", "workspace"),
    "expressions": s.reverse("expressions", "workspace"),
  })
},
  to: {
  "bottings": s.table({
    "question_id": s.uuid(),
    "bot_label": s.enum("dumdum", "numnum"),
    "textkind": s.enum("clueing", "hint"),
    "asked_text": s.string().optional(),
    "status": s.enum("done", "error"),
    "reply_text": s.string().optional(),
    "items": s.json(JSON.parse("{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"maxItems\":200,\"type\":\"array\",\"items\":{\"type\":\"object\",\"properties\":{\"text\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":3600,\"pattern\":\"^[\\\\P{Cc}\\\\t\\\\r\\\\n]*$\",\"description\":\"The span exactly as it appears in the source text, preserving punctuation, currency, and script: \\\"#17-19\\\", \\\"9,000+\\\", \\\"千\\\", \\\"douzaine\\\", \\\"Feb 27\\\". Shown verbatim so the author can see precisely what the model latched onto and judge whether a player would too.\"},\"value\":{\"type\":\"number\",\"description\":\"What a reasonable player would add up for that span. Magnitude phrases carry their whole value (\\\"300 million\\\" is 300000000, not 300), and fractions stay fractional (\\\"quarter\\\" is 0.25). Zod rejects NaN and Infinity here without further checks.\"},\"kind\":{\"type\":\"string\",\"enum\":[\"numeral\",\"wordish\"],\"description\":\"\\\"numeral\\\" when the span is written in digits, \\\"wordish\\\" when it reads as a number in words, as an ordinal, or as a magnitude phrase. The two are totalled separately so the author can compare the strict digits-only reading of a clue against the generous reading.\"}},\"required\":[\"text\",\"value\",\"kind\"],\"additionalProperties\":false,\"description\":\"One number-like span found in a clueing or a hint.\"},\"description\":\"A numnum reply: every number-like span it found, in the order they appear in the text asked. Empty for any other botting.\"}")).default("[]"),
    "message": s.string().optional(),
    "response": s.string().optional(),
    "truncated": s.boolean(),
    "model_tier_applied": s.enum("quick", "careful").optional(),
    "approx_tokens": s.int().optional(),
  }, {
    "question": s.rel("questions", "question_id"),
  }),
  "columns": s.table({
    "quiz_id": s.uuid(),
    "label": s.string(),
    "title": s.string(),
    "source": s.string(),
    "width_px": s.int(),
    "position": s.int(),
  }, {
    "quiz": s.rel("quizzes", "quiz_id"),
  }),
  "expressions": s.table({
    "hunt_id": s.uuid(),
    "owner": s.enum("tq"),
    "label": s.string(),
    "formula": s.string(),
    "description": s.string(),
    "position": s.int(),
  }, {
    "hunt": s.rel("hunts", "hunt_id"),
  }),
  "hunts": s.table({
    "label": s.string(),
    "forced_label": s.string().optional(),
    "title": s.string(),
  }, {
    "realms": s.reverse("realms", "hunt"),
    "expressions": s.reverse("expressions", "hunt"),
  }),
  "identings": s.table({
    "ident_id": s.uuid(),
  }, {
    "ident": s.rel("idents", "ident_id"),
  }),
  "idents": s.table({
    "label": s.string(),
    "title": s.string(),
  }, {
    "identings": s.reverse("identings", "ident"),
  }),
  "questions": s.table({
    "quiz_id": s.uuid(),
    "position": s.int(),
    "label": s.string(),
    "forced_label": s.string().optional(),
    "title": s.string(),
    "qnum": s.string(),
    "clueing": s.string(),
    "hint": s.string(),
    "chains_to": s.string().optional(),
    "full_answer": s.string(),
    "alt_text": s.string(),
    "notes": s.string(),
  }, {
    "quiz": s.rel("quizzes", "quiz_id"),
    "bottings": s.reverse("bottings", "question"),
  }),
  "quizzes": s.table({
    "realm_id": s.uuid(),
    "title": s.string(),
    "label": s.string(),
    "forced_label": s.string().optional(),
    "version": s.string(),
    "locked": s.boolean(),
    "last_sortkey": s.string().optional(),
    "bulk_ishes_last": s.string().optional(),
  }, {
    "realm": s.rel("realms", "realm_id"),
    "questions": s.reverse("questions", "quiz"),
    "widgets": s.reverse("widgets", "quiz"),
    "columns": s.reverse("columns", "quiz"),
  }),
  "realms": s.table({
    "hunt_id": s.uuid(),
    "label": s.string(),
    "title": s.string(),
    "position": s.int(),
  }, {
    "hunt": s.rel("hunts", "hunt_id"),
    "quizzes": s.reverse("quizzes", "realm"),
  }),
  "widgets": s.table({
    "quiz_id": s.uuid(),
    "label": s.string(),
    "kind": s.enum("expressing", "botting"),
    "expression_label": s.string().optional(),
    "bot_label": s.enum("dumdum", "numnum").optional(),
    "textkind": s.enum("clueing", "hint").optional(),
    "description": s.string(),
    "position": s.int(),
  }, {
    "quiz": s.rel("quizzes", "quiz_id"),
  })
},
});
