/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../decl/node.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/util/Vec.ts'/>
///<reference path='Mixfile.ts'/>
///<reference path='Mixture.ts'/>

namespace Mixtures /* BOF */ {

/*
	Collection of mixtures: convenience methods for handling an array thereof, including serialisation.
*/

export class MixtureCollection
{
	// ------------ public methods ------------

	constructor(public mixtures:Mixture[] = [])
	{
	}

/*
	// makes a deep copy of self
	public clone():Mixture
	{
		return new Mixture(deepClone(this.mixfile));
	}

	// returns true if the two mixtures are identical at all parts of their branch structure
	public equals(other:Mixture):boolean
	{
		if (other == null) return false;
		return this.recursiveEqual(this.mixfile, other.mixfile);
	}*/

	// unpacks a string into a mixture; throws an exception if anything went wrong
	public static deserialise(data:string):MixtureCollection
	{
		let list = JSON.parse(data);
		if (!Array.isArray(list)) throw 'Input content is not a JSON array.';
		let mixtures:Mixture[] = [];
		for (let mixfile of list) mixtures.push(new Mixture(mixfile));
		return new MixtureCollection(mixtures);
	}

	// converts the entire underlying JSON mixfile into a prettyprinted string
	public serialise():string
	{
		let list:any[] = [];
		for (let mixture of this.mixtures) list.push(mixture.mixfile);
		return Mixture.beautify(list);
	}

	// ------------ private methods ------------


}

/* EOF */ }