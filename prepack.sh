#!/bin/tcsh
zip -m -r /tmp/stash_old_mixture_files dist/cmdline dist/electron dist/mixture dist/nodejs dist/web dist/pkg
npm run build
mkdir dist/pkg
cd dist/pkg
cp ../../package.json .
cp ../../README* .
cp -r ../mixture/* .

# note: not bundling any resources at the moment, but may decide to do so later
# cp -r ../../res .
# node ../../tools/relativise.js --map \@reswmk res

npm pack --pack-destination ../..
