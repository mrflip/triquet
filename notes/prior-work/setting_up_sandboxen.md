```
SANDNAME=foo  ## replace with the name
mkdir $HOME/sand/tq/triquet-$SANDNAME

doppler configs tokens create sandbox-dev_claude    --project triquet --config dev_claude    --plain
doppler configs tokens create sandbox-dev_aijanitor --project triquet --config dev_aijanitor --plain
doppler configs tokens create sandbox-dev_e2e --project triquet --config dev_aijanitor --plain
```

Checking orbstack installed correctly:

```
nightingale main cdd4d68 ~/code/flipshop/onshape/flipshop/coreUtils$ env | grep -i docker           # should print nothing; DOCKER_HOST or DOCKER_CONTEXT here overrides everything
nightingale main cdd4d68 ~/code/flipshop/onshape/flipshop/coreUtils$ docker context ls              # the * should be on "orbstack"
NAME            DESCRIPTION                               DOCKER ENDPOINT                                ERROR
default         Current DOCKER_HOST based configuration   unix:///var/run/docker.sock
desktop-linux   Docker Desktop                            unix:///Users/flip/.docker/run/docker.sock
orbstack *      OrbStack                                  unix:///Users/flip/.orbstack/run/docker.sock
nightingale main cdd4d68 ~/code/flipshop/onshape/flipshop/coreUtils$ docker info --format '{{.OperatingSystem}}'   # should say OrbStack
OrbStack
nightingale main cdd4d68 ~/code/flipshop/onshape/flipshop/coreUtils$ which -a docker                # first hit should resolve into OrbStack
/opt/homebrew/bin/docker
/usr/local/bin/docker
nightingale main cdd4d68 ~/code/flipshop/onshape/flipshop/coreUtils$ ls -l /var/run/docker.sock     # symlink into ~/.orbstack/run/docker.sock if OrbStack took it over
lrwxr-xr-x 1 root daemon 37 Sep 27 21:40 /var/run/docker.sock -> /Users/flip/.orbstack/run/docker.sock=
```