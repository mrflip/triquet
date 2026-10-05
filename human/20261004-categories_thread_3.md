# 2026-10-04: Categories thread 3 -- a new seed widget wants a seeding run on production

* **Run `seeding:seedWidgets` on production after #91 deploys.** The library gains a seeded
  category-estimate entry, `categories`. Seeding is by hand (`notes/deploy.md`, step 4 of the
  rewidgeting procedure: `./scripts/doppledo prd_janitor npx convex run seeding:seedWidgets`),
  and it adds only what is absent, so it is safe to run. Until it runs, a smith can still make the
  widget in the library (Entry kind: *Category estimates*); nothing breaks either way. The schema
  change itself is additive (a fifth `entry_kind`), with no migration.
* **The wheel and the export, again.** Thread 1 asked whether the wheel belongs in the hunt's
  export. It now matters a little more: a formula reading a persona's chance
  (`qn.categories.masie`) is worked out for the Export box against the default wheel, since
  `HuntT` carries none, while the grid, the server's sort and the history mirror use the hunt's
  own wheel.
