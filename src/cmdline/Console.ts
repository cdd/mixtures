/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2025 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {InChI} from '../nodejs/InChI';
import {RenderHTML} from './RenderHTML';
import {TableExtract} from './TableExtract';
import {ALL_TRANSFORMMIXTURE_FORMATS, TransformMixtures} from './TransformMixtures';
import {XML} from 'webmolkit/util/XML';

/*
	Console utilities, to be run from NodeJS with command line arguments.
*/

export class Console
{
	private inputFile:string = null;
	private inputFormat:string = null;
	private outputFile:string = null;
	private outputFormat:string = null;
	private tableFile:string = null;
	private lookupFile:string = null;
	private mappingFile:string = null;
	private htmlFile:string = null;
	private withMInChI = false;
	private justHelp = false;
	private verbose = false;

	constructor(args:string[])
	{
		// const {DOMParser, XMLSerializer} = require('xmldom/dom-parser.js');
		// XML.customParser = DOMParser;
		// XML.customSerial = XMLSerializer;

		for (let n = 0; n < args.length; n++)
		{
			if (args[n] == '-i' && n + 1 < args.length) this.inputFile = args[++n];
			else if (args[n] == '-if' && n + 1 < args.length) this.inputFormat = args[++n];
			else if (args[n] == '-o' && n + 1 < args.length) this.outputFile = args[++n];
			else if (args[n] == '-of' && n + 1 < args.length) this.outputFormat = args[++n];
			else if (args[n] == '--table' && n + 1 < args.length) this.tableFile = args[++n];
			else if (args[n] == '--lookup' && n + 1 < args.length) this.lookupFile = args[++n];
			else if (args[n] == '--mapping' && n + 1 < args.length) this.mappingFile = args[++n];
			else if (args[n] == '--html' && n + 1 < args.length) this.htmlFile = args[++n];
			else if (args[n] == '--minchi') this.withMInChI = true;
			else if (args[n] == '--inchi' && n < args.length - 1) InChI.setExecutable(args[++n]);
			else if (args[n] == '-h' || args[n] == '-help' || args[n] == '--help') this.justHelp = true;
			else if (args[n] == '--verbose') this.verbose = true;
		}
	}

	public async run():Promise<void>
	{
		if (this.tableFile) await new TableExtract(this.tableFile, this.lookupFile, this.mappingFile, this.verbose).exec();
		else if (this.htmlFile) await new RenderHTML(this.htmlFile, this.withMInChI).exec();
		else if (this.inputFile || this.inputFormat || this.outputFile || this.outputFormat) await new TransformMixtures(this.inputFile, this.inputFormat, this.outputFile, this.outputFormat).exec();
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
		console.log('    -i {fn}          read input file (type guessed from suffix)');
		console.log('    -if {fmt}        specify/override type for input file');
		console.log('    -o {fn}          write output file (type guessed from suffix)');
		console.log('    -of {fmt}        specify/override type for output file');
		console.log('    --table {fn}     convert a tabular datafile to mixfile collection');
		console.log('    --lookup {fn}    (optional) lookup file for name-to-structure');
		console.log('    --mapping {fn}   (optional) JSON-formatted file for column mappings');
		console.log('    --html {fn}      render mixfile collection as an HTML table');
		console.log('    --minchi         (optional) include MInChI notation');
		console.log('    --inchi {fn}     (optional) specify InChI executable location');
		console.log('Mixture formats:');
		for (let fmt of ALL_TRANSFORMMIXTURE_FORMATS) console.log('    ' + fmt);
	}

	private log(str:string):void
	{
		if (this.verbose) console.log(str);
	}
}

// if being run in NodeJS context, need to export the class
// if (typeof module == 'object') module.exports['Console'] = Console;

