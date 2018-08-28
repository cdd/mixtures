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
	private remote = require('electron').remote;

	constructor()
	{
		this.inchiPath = this.remote.getGlobal('INCHI_EXEC');
		console.log('** INCHI:'+this.inchiPath);

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
	// rejection; failure results in an exception
	public static makeInChI(mol:wmk.Molecule):string
	{
		if (!inchi) inchi = new InChI();
		if (!inchi.available) throw 'InChI executable is not available.';

		return '';
	}
}


/* EOF */ }