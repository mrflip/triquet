
There are doppler 'config's for dev_claude and dev_aijanitor. The latter is a replacement for the former, not an overlay -- don't run them as nested calls.
The container has DOPPLER_TOKEN_DEV_CLAUDE, DOPPLER_TOKEN_DEV_E2E, and DOPPLER_TOKEN_DEV_AIJANITOR set, but not DOPPLER_TOKEN

With no token set, running `scripts/doppledo` helper will adjust DOPPLER_TOKEN: i.e. `./scripts/doppledo dev_claude pnpm dev` will set DOPPLER_TOKEN using `$DOPPLER_TOKEN_DEV_CLAUDE`.