


```
SANDNAME=foo  ## replace with the name
mkdir $HOME/sand/tq/triquet-$SANDNAME
doppler configs tokens create sandbox-dev_claude    --project triquet --config dev_claude    --plain
doppler configs tokens create sandbox-dev_aijanitor --project triquet --config dev_aijanitor --plain
```