#!/bin/sh

# note: see https://www.christianengvall.se/electron-packager-tutorial/ for tutorial on this stuff

electron-packager app --overwrite\
 --platform=darwin --arch=x64\
 --icon=app/img/icon.icns --prune=true --out=dist

