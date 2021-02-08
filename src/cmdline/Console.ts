/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2021 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	Console utilities, to be run from NodeJS with command line arguments.
*/

export class Console
{
	private tableFile:string = null;
	private lookupFile:string = null;
	private mappingFile:string = null;
	private justHelp = false;
	private verbose = false;

	constructor(args:string[])
	{
		const {DOMParser, XMLSerializer} = require('xmldom/dom-parser.js');
		wmk.XML.customParser = DOMParser;
		wmk.XML.customSerial = XMLSerializer;

		for (let n = 0; n < args.length; n++)
		{
			if (args[n] == '--table' && n + 1 < args.length) this.tableFile = args[++n];
			else if (args[n] == '--lookup' && n + 1 < args.length) this.lookupFile = args[++n];
			else if (args[n] == '--mapping' && n + 1 < args.length) this.mappingFile = args[++n];
			else if (args[n] == '-h' || args[n] == '-help' || args[n] == '--help') this.justHelp = true;
			else if (args[n] == '--verbose') this.verbose = true;
		}
	}

	public async run():Promise<void>
	{
		if (this.tableFile) await new TableExtract(this.tableFile, this.lookupFile, this.mappingFile, this.verbose).exec();
		else if (this.justHelp) this.printHelp();
		else
		{
			this.log('Nothing to do.');
			this.printHelp();
		}
	}

	// ------------ private methods ------------

	private printHelp():void
	{
		console.log('Mixtures console utilities. Arguments:');
		console.log('    --table {fn}     convert a tabular datafile to mixfile collection');
		console.log('    --lookup {fn}    (optional) lookup file for name-to-structure');
		console.log('    --mapping {fn}   (optional) JSON-formatted file for column mappings');
	}

	private log(str:string):void
	{
		if (this.verbose) console.log(str);
	}
}

// if being run in NodeJS context, need to export the class
if (typeof module == 'object') module.exports['Console'] = Console;

/* EOF */ }