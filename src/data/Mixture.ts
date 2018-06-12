/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

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

	// makes a deep copy of self
	public clone():Mixture
	{
		return new Mixture(deepClone(this.mixfile));
	}

	// unpacks a string into a mixture; throws an exception if anything went wrong
	public static deserialise(data:string):Mixture
	{
		let mixfile = JSON.parse(data);
		return new Mixture(mixfile);
	}

	// uses the "origin vector" to fetch a particular component; this is an array of indices, where [] indicates the root; its first component is [0], 
	// the second child of its first component is [0,1], etc.
	public getComponent(origin:number[]):MixfileComponent
	{
		if (origin.length == 0) return this.mixfile;
		let find:MixfileComponent = null, look:MixfileComponent[] = this.mixfile.contents;
		for (let o of origin)
		{
			find = look[o];
			look = find.contents;
		}
		return find;
	}

	// takes an origin vector and splits it into {parent origin} and {child index}; returns null on both counts if this is the root node
	public static splitOrigin(origin:number[]):[number[], number]
	{
		if (origin.length == 0) return [null, null];
		let parent = origin.slice(0);
		let idx = parent.splice(origin.length - 1, 1)[0];
		return [parent, idx];
	}

	// ------------ private methods ------------
}

/* EOF */ }