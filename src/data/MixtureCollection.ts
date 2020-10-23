/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	Collection of mixtures: convenience methods for handling an array thereof, including serialisation.

	Most of the methods that fetch or modify the mixture content one item at a time make deep clones, so it is safe to
	assume that there are no dangling pointers. Exceptions include the constructor, bulk modifications, and methods marked
	as providing direct access.
*/

export class MixtureCollection
{
	private mixtures:Mixture[] = [];

	// ------------ public methods ------------

	constructor(mixtures?:Mixture[])
	{
		if (mixtures) this.mixtures = mixtures.slice(0);
	}

	public get count():number
	{
		return this.mixtures.length;
	}
	public getMixture(idx:number):Mixture
	{
		return this.mixtures[idx].clone();
	}
	public getMixtureDirect(idx:number):Mixture
	{
		return this.mixtures[idx];
	}
	public setMixture(idx:number, mixture:Mixture):void
	{
		this.mixtures[idx] = mixture.clone();
	}
	public setMixtureDirect(idx:number, mixture:Mixture):void
	{
		this.mixtures[idx] = mixture;
	}
	public deleteMixture(idx:number):void
	{
		this.mixtures.splice(idx, 1);
	}
	public appendMixture(mixture:Mixture):number
	{
		this.mixtures.push(mixture.clone());
		return this.mixtures.length - 1;
	}
	public appendMixtureDirect(mixture:Mixture):number
	{
		this.mixtures.push(mixture);
		return this.mixtures.length - 1;
	}
	public appendCollection(collection:MixtureCollection):void
	{
		this.mixtures = this.mixtures.concat(collection.mixtures);
	}
	public insertMixture(idx:number, mixture:Mixture):void
	{
		this.mixtures.splice(idx, 0, mixture.clone());
	}
	public swapMixtures(idx1:number, idx2:number):void
	{
		let [m1, m2] = [this.mixtures[idx1], this.mixtures[idx2]];
		this.mixtures[idx1] = m2;
		this.mixtures[idx2] = m1;
	}

	// unpacks a string into a mixture; throws an exception if anything went wrong
	public static deserialise(data:string):MixtureCollection
	{
		let list = JSON.parse(data);
		if (!Array.isArray(list)) throw 'Input content is not a JSON array.';
		let mixtures:Mixture[] = [];
		for (let mixfile of list) mixtures.push(new Mixture(mixfile));
		return new MixtureCollection(mixtures);
	}

	// converts the entire underlying JSON mixfile into a prettyprinted string; note the optional beautification parameter:
	// if not specified, small collections will get nice whitespace, whereas large ones will be densely packed for efficiency
	public serialise(beautify?:boolean):string
	{
		let list:any[] = [];
		for (let mixture of this.mixtures) list.push(mixture.mixfile);
		return list.length <= 1000 ? Mixture.beautify(list) : JSON.stringify(list);
	}

	// ------------ private methods ------------

}

/* EOF */ }