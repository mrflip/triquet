
We distinguish these distinct lifecycle phases for structured data:

* *Sketch* -- convenient, generous, elegant data format indicating the caller's intent, requesting
  opinionated defaults. Use when that generosity is warranted over what DNA offers. It may have a
  different shape than the later stages. However, fields with the same name may narrow in type but
  must always mean the same thing (eg don't use `strategy` for both a strategy record and an enum
  indicating which record to select).
* *DNA* -- same structure as `Real` up to validating, defaulting and nulling fields. Can be
  broader: eg accepting a policy record, or a policy record label, and offering a default if
  neither is present.
* *Real* -- fully validated plain JS object (POJO). Every field exists (possibly null, never
  undefined). If it belongs to a model, it is a subset of that type. Defaults have been applied.
  Further typechecking is neither needed nor (within module boundary) invited.
* *Live* -- model class instance: data, getters, functions, etc.

Use these verbs: `fill(dna: FooDNA): FooReal`; `live(dna: FooDNA | FooReal): Foo`;
`get real(): FooReal` (serializing getter); `get dupe(overrides: FooPatch): FooReal`.
