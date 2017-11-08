#!/bin/sh

# NOTE the megahack: node_modules has to exist locally otherwise the packager barfs (a bug
# or shortcoming of some kind); but the node_modules breaks typescript's compiler process,
# and don't really want a local version anyway, so...

ln -s /usr/local/lib/node_modules .

electron-packager app --overwrite\
 --platform=linux --arch=x64\
 --icon=img/icon --prune=true --out=dist

unlink node_modules
