/*
    Mixfile Editor & Viewing Libraries

    (c) 2017 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../decl/node.d.ts'/>
///<reference path='Mixfile.ts'/>

namespace Mixtures /* BOF */ {

/*
	Data container for mixtures: basically wraps the Mixfile interface, with additional functionality.
*/

export class Mixture
{
	// ------------ public methods ------------

	constructor(public mixfile?:Mixfile)
	{
		if (!mixfile) this.mixfile = {'mixfileVersion': MIXFILE_VERSION};
	}

	// returns true if the mixture is blank
	public isEmpty():boolean
	{
		const BITS = ['name', 'description', 'synonyms', 'formula', 'molfile', 'inchi', 'inchiKey', 'smiles', 
					  'ratio', 'quantity', 'units', 'relation', 'identifiers', 'links', 'contents'];
		for (let bit of BITS) if ((this.mixfile as any)[bit] != null) return false;
		return true;
	}

	// unpacks a string into a mixture; throws an exception if anything went wrong
	public static deserialise(data:string):Mixture
	{
		let mixfile = JSON.parse(data);
		return new Mixture(mixfile);
	}
	
	// ------------ private methods ------------
}

/* EOF */ }