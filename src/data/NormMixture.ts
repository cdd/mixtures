/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2020 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/


///<reference path='Mixfile.ts'/>
///<reference path='Mixture.ts'/>

namespace Mixtures /* BOF */ {

/*
	Mixture normalisation options: recommendations for how to make a mixture more conformant.
*/

export interface NormMixtureNote
{
	origin:number[];

	stereoEnum?:string[]; // if defined, contains stereo-enumerated versions of current

	// units converted into concentration, if both possible & necessary
	concQuantity?:number | number[]; // a concentration numeric which is associated with the units below (two numbers in case of a range)
	concError?:number; // optional standard error (applies to quantity when it's a scalar)
	concRatio?:number[]; // a ratio, specified as [numerator, denominator]
	concUnits?:string; // units for quantity (e.g. %, mol/L, g, etc.)
	concRelation?:string; // optional modifier when applied to quantity (e.g. >, <, ~)
}

export class NormMixture
{
	public notes:NormMixtureNote[] = [];

	// ------------ public methods ------------

	constructor(private mixture:Mixture)
	{
	}

	public analyse():void
	{
		for (let origin of this.mixture.getOrigins())
		{
			let note:NormMixtureNote = {'origin': origin};

			// !!

			this.notes.push(note);
		}
	}

	// ------------ private methods ------------


}

/* EOF */ }