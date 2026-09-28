notes/sandbox_setup.md

* You should be running in a sandbox with `$TQ_IS_SANDBOXED`=true

* From my home directory, the sandboxen for this project (triquet) are in ~/sand/tq/triquet-{name}, with a checkout of the code into `triquet`. The vscode file is in `~/sand/tq/triquet-{name}/triquet/triquet-{name}.code-workspace

* `node_modules` is a Docker volume, not the checkout's own folder: the container's Linux build of
  the native packages (next-swc, esbuild, jazz-napi, sharp) never lands where the Mac can see it,
  and the Mac's never reaches the container. pnpm keeps its store inside that volume. To start
  afresh, remove the volume (`docker volume ls | grep node_modules`) and rebuild the container;
  `rm -rf node_modules` empties it but cannot remove the mount itself.
* Ports belong to the container: every sandbox can run `pnpm dev:agent` on 3001 without meeting
  another. To look at one from the Mac, forward 3001 and 3201 together from VS Code's Ports panel,
  one sandbox at a time -- the page finds Jazz at `localhost:3201`, so a remapped pair would
  talk to the wrong sandbox's data.
