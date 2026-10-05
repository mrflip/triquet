# 2026-10-04: Every username is an admin of the library, until you say who is (dbpolicy thread 9, PR #92)

* **Anyone with a username can now change the shared widget library**: add, revise, move, remove
  and import widgets, and count how far a widget is used. They can do it from any client, with no
  hunt open. Before, it took a smith of the hunt on screen. This is the plan's *For the Coach* 4,
  as accepted. The library editor is still only reached from a smith's Workbench, but the
  mutation (`widgets.perform`) is open to any session with a username.
* **To close it**, give `Actor.isAdmin` in `src/lib/actor.ts` a real rule. It is the only place
  admin standing is decided; nothing else changes. It takes the actor alone and reads nothing, so
  a rule that needs the database (an admins table, a flag on the ident) also needs a read in
  `affirmLibraryAction`, which is the library mutation's `affirm` and may be async.
