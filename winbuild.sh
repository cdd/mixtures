#!/bin/sh

# note: see https://www.christianengvall.se/electron-packager-tutorial/ for tutorial on this stuff

electron-packager app --overwrite --asar=true\
 --platform=win32 --arch=ia32\
 --icon=app/img/icon.ico --prune=true --out=dist\
 --version-string.CompanyName=\"Molecular Materials Informatics, Inc.\"\
 --version-string.FileDescription=Z\
 --version-string.ProductName=\"SketchEl2\"

