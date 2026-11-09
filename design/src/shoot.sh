#!/bin/bash
# usage: shoot.sh name [w h suffix] ; full-page variants use tall window
cd /workspace/seance/design
n=$1; w=$2; h=$3; sfx=$4
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=$w,$h --virtual-time-budget=6000 --screenshot=shots/$n-$sfx.png "file://$PWD/mocks/$n.html${5}" 2>/dev/null
