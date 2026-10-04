# Addresses: the path names the resource, the query the presentation (Sept 2026)

**Decision.** A quiz lives at `/h/<hunt>/<realm>/<quiz>`, three labels, each scoped by the one
before it: hunt labels are global, realm labels unique within a hunt, quiz labels within a
realm. How the quiz is shown is a query parameter, `?act=smith` (the Workbench) or `?act=review`
(the review screen). An address with no `act` is sent on to one: `smith` today, and by the
visitor's role once hunts have members. `src/lib/routes.ts` writes these shapes and nothing else
does. Old `/my/quiz/<label>` links break, by decision; nobody but the author held one.

**Why the path is the resource.** A link is what a smith pastes to a reviewer, and it should
open the right view for whoever opens it: the same quiz, as a smith sees it or as a reviewer
does, without a second address to keep in step. Putting the view in the path (`/review/<quiz>`)
would make every link say who it was meant for, and a link forwarded to the wrong person would
open the wrong thing. The hunt segment is what lets labels be short and stable: two hunts can
each have a quiz `home` without either renaming it.

**Arriving without an ident.** The front door, `/`, is where a visitor says who they are. Any
page that needs an ident and finds none sends the visitor to `/?then=<where they were going>`,
and the gate sends them on once they have one. `then` is followed only to a path on this site
(`Routes.thenFrom` refuses a scheme, a host, or `//`), so a link cannot bounce a visitor
off-site. `/?switch` keeps the gate open for someone who wants to become someone else.
