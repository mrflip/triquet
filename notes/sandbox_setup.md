notes/sandbox_setup.md

* You should be running in a sandbox with `$TQ_IS_SANDBOXED`=true

* From my home directory, the sandboxen for this project (triquet) are in ~/sand/tq/triquet-{name}, with a checkout of the code into `triquet`. The vscode file is in `~/sand/tq/triquet-{name}/triquet/triquet-{name}.code-workspace

* `node_modules` is a Docker volume, not the checkout's own folder: the container's Linux build of
  the native packages (next-swc, esbuild, sharp) never lands where the Mac can see it,
  and the Mac's never reaches the container. pnpm keeps its store inside that volume. To start
  afresh, remove the volume (`docker volume ls | grep node_modules`) and rebuild the container;
  `rm -rf node_modules` empties it but cannot remove the mount itself.
* Ports belong to the container: every sandbox can run `pnpm dev:agent` on 3001 without meeting
  another. To look at one from the Mac, forward 3001 and 3401 together from VS Code's Ports panel,
  one sandbox at a time -- the page finds its Convex backend at `127.0.0.1:3401`, so a remapped
  pair would talk to the wrong sandbox's data. (Each role's backend is on its own 34xx port.)
* Agents' worktrees live in the container only, under `~/worktrees/triquet/`: nothing there is
  visible from the Mac, and a container rebuild loses whatever was uncommitted in them (commits
  are in the shared repository from the moment they are made). Each has a lane of its own
  (`pnpm lane` in it), and its ports are the main checkout's plus ten per lane: lane 2's
  `dev:agent` is on 3021 with its backend on 3421, to forward as a pair like any other.
