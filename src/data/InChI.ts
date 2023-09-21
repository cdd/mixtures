/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	Interoperability with InChI technology: the generator program is a native binary, the location of which
	needs to be discovered. Each generation operation involves a trip to the external execution subsystem.
*/

let execLocation:string = null;
let inchi:InChI = null;

export class InChI
{
	// optional override: when using the Emscripten-ported version of InChI, set this function to call the
	// natively encoded implementation
	public static nativeMolfileToInChI:(mdlmol:string, options:string) => Promise<string> = null;

	private available = false;
	private inchiPath = execLocation;
	private remote:Electron.Remote = null;

	constructor()
	{
		if (!ON_DESKTOP) return;

		if (!this.inchiPath)
		{
			this.remote = require('@electron/remote');
			this.inchiPath = this.remote.getGlobal('INCHI_EXEC');
		}

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

	// specify where the executable file is (overrides the global option)
	public static hasExecutable():boolean
	{
		return !!execLocation;
	}
	public static setExecutable(exec:string):void
	{
		execLocation = exec;
	}

	// returns true if we have reason to believe the InChI executable can be run on demand
	public static isAvailable():boolean
	{
		if (this.nativeMolfileToInChI != null) return true;
		if (!inchi) inchi = new InChI();
		return inchi.available;
	}

	// converts a molecule to an InChI string, if possible; should check the availability first, for graceful
	// rejection; failure results in an exception; note that it is executed synchronously: if the executable takes
	// a long time to run, this will be a problem for the UI; the return value is [InChI, InChIKey]
	public static async makeInChI(mol:wmk.Molecule):Promise<[string, string]>
	{
		mol = mol.clone();
		wmk.MolUtil.expandAbbrevs(mol, true);
		for (let n = 1; n <= mol.numBonds; n++) if (mol.bondOrder(n) < 1 || mol.bondOrder(n) > 3) mol.setBondOrder(n, 1);

		let writer = new wmk.MDLMOLWriter(mol);
		writer.enhancedFields = false;
		let mdlmol = writer.write();

		if (this.nativeMolfileToInChI != null)
		{
			let inchi = await this.nativeMolfileToInChI(mdlmol, '-AuxNone -NoLabels');
			return [inchi, null]; // NOTE: this version doesn't provide a key; address this in the future
		}

		if (!inchi) inchi = new InChI();
		if (!inchi.available) throw 'InChI executable is not available.';

		const proc = require('child_process'), path = require('path');

		let cmd = inchi.inchiPath.replace(/ /g, '\\\ '); // very crude escaping of spaces
		let result = proc.spawnSync(cmd, ['-STDIO', '-AuxNone', '-NoLabels', '-Key'], {input: mdlmol});
		let raw = result.stdout.toString(), bits = raw.split('\n');

		if (bits.length < 2 || !bits[0].startsWith('InChI='))
		{
			console.log('InChI command returned result:\n' + raw);
			console.log('Molecule:\n' + mol);
			console.log('MDL Molfile:\n' + mdlmol);
			throw 'Invalid returned by InChI generator: ' + raw;
		}
		return bits;
	}
}

/* EOF */ }