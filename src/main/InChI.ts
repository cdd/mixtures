/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>

namespace Mixtures /* BOF */ {

/*
	Interoperability with InChI technology: the generator program is a native binary, the location of which
	needs to be discovered. Each generation operation involves a trip to the external execution subsystem.
*/

let inchi:InChI = null;

export class InChI
{
	private available = false;
	private inchiPath = '';
	private remote:Electron.Remote = null;

	constructor()
	{
		if (!ON_DESKTOP) return;

		this.remote = require('electron').remote;
		this.inchiPath = this.remote.getGlobal('INCHI_EXEC');

		if (this.inchiPath)
		{
			const fs = require('fs');
			try
			{
				fs.accessSync(this.inchiPath, fs.constants.X_OK);
				this.available = true;
			}
			catch (ex) {} // not available
		}
	}

	// returns true if we have reason to believe the InChI executable can be run on demand
	public static isAvailable():boolean
	{
		if (!inchi) inchi = new InChI();
		return inchi.available;
	}

	// converts a molecule to an InChI string, if possible; should check the availability first, for graceful
	// rejection; failure results in an exception; note that it is executed synchronously: if the executable takes
	// a long time to run, this will be a problem for the UI; the return value is [InChI, InChIKey]
	public static makeInChI(mol:wmk.Molecule):[string, string]
	{
		if (!inchi) inchi = new InChI();
		if (!inchi.available) throw 'InChI executable is not available.';

		const proc = require('child_process'), path = require('path');

		let cmd = inchi.inchiPath.replace(/ /g, '\\\ '); // very crude escaping of spaces
		let writer = new wmk.MDLMOLWriter(mol);
		//writer.enhancedFields = false; (InChI generator will ignore the enhanced fields, so this is OK)
		let mdlmol = writer.write();
		let result = proc.spawnSync(cmd, ['-STDIO', '-AuxNone', '-NoLabels', '-Key'], {'input': mdlmol});
		let raw = result.stdout.toString(), bits = raw.split('\n')

		if (bits.length < 2 || !bits[0].startsWith('InChI='))
		{
			console.log('InChI command returned result:\n' + raw);
			console.log('Molecule:\n' + mol);
			console.log('MDL Molfile:\n' + mdlmol);
			throw 'Invalid returned by InChI generator';
		}
		return [bits[0], bits[1]];
	}
}


/* EOF */ }