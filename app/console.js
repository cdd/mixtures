/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2021 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

let Mixtures = require(__dirname + '/mixfile.js');
new Mixtures.Console(process.argv.slice(0)).run().then();

