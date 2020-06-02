/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2020 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery/index.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/data/DataSheetStream.ts'/>
///<reference path='../../../WebMolKit/src/data/MDLWriter.ts'/>

///<reference path='../startup.ts'/>
///<reference path='../data/Mixfile.ts'/>
///<reference path='../data/Mixture.ts'/>
///<reference path='../data/Units.ts'/>

namespace Mixtures /* BOF */ {

/*
	Interoperability with SDfiles: conversion of the Mixfile hierarchy into a flattened SDfile is useful for presenting to
	software that can read this format, and is also a waypoint en route to a MInChI string.
*/

export class ExportSDFile
{
	private ds = new wmk.DataSheet();
	private colMol:number;
	private colSeq:number;
	private colConc:number;

	// ------------ public methods ------------

	constructor()
	{
		this.colMol = this.ds.appendColumn('Molecule', wmk.DataSheetColumn.Molecule, '');
		this.colSeq = this.ds.appendColumn('MINCHI$N', wmk.DataSheetColumn.String, '');
		this.colConc = this.ds.appendColumn('MINCHI$C', wmk.DataSheetColumn.String, '');
	}

	// can add any number of mixtures, which will be numbered automatically
	public append(mixfile:Mixfile):void
	{
		// if the root node is something other than a pure placeholder, then add it explicitly
		if (mixfile.name || mixfile.molfile || mixfile.inchi)
		{
			this.appendComponent(mixfile, [1]);
			return;
		}

		// otherwise, add all of contents of the root node as a series with incrementing primary indexes
		if (!mixfile.contents) return;
		for (let n = 0; n < mixfile.contents.length; n++) this.appendComponent(mixfile.contents[n], [n + 1]);
	}

	// return the SDF-serialised representation
	public write():string
	{
		return new wmk.MDLSDFWriter(this.ds).write();
	}

	// ------------ private methods ------------

	// recursively add a component, and all of its subcomponents
	private appendComponent(comp:MixfileComponent, seq:number[]):void
	{
		let row = this.ds.appendRow();

		let mol:wmk.Molecule = null;
		if (comp.molfile)
		{
			mol = wmk.Molecule.fromString(comp.molfile);
			if (!mol)
			{
				try
				{
					mol = new wmk.MDLMOLReader(comp.molfile).parse();
				}
				catch (e) {}
			}
		}
		if (!mol) mol = new wmk.Molecule();

		this.ds.setMolecule(row, this.colMol, mol);
		this.ds.setString(row, this.colSeq, seq.join('.'));
		this.ds.setString(row, this.colConc, this.formatConcentration(comp));

		if (comp.contents) for (let n = 0; n < comp.contents.length; n++)
		{
			let subseq = seq.slice(0);
			subseq.push(n + 1);
			this.appendComponent(comp.contents[n], subseq);
		}
	}

	// turns a concentration into a suitable precursor string, or null otherwise
	private formatConcentration(comp:MixfileComponent):string
	{
		// TODO: need special deal for ratio without denominator - can sometimes add them up to form an implicit denominator

		if (comp.ratio && comp.ratio.length >= 2)
		{
			let numer = comp.ratio[0], denom = comp.ratio[1];
			if (!(denom > 0)) return null;
			return (100 * numer / denom) + ' pp';
		}

		if (comp.quantity == null || comp.units == null) return null;

		// special deal (maybe temporary): units that are written with common names that map to a URI are converted automatically
		let unitURI = comp.units;
		if (!unitURI.startsWith('http://')) unitURI = Units.nameToURI(unitURI);
		if (!unitURI) return;

		// TODO: maybe another special deal for absolute weight/volume/mole quantities - convert them into ratios, to the extent that's
		// possible... maybe approximating where necessary

		let bits:string[] = [];

		if (comp.relation != null) bits.push(comp.relation);

		let values:number[] = typeof comp.quantity == 'number' ? [comp.quantity as number] : comp.quantity;

		let [mnemonic, scaled] = Units.convertToMInChI(unitURI, values);
		if (!mnemonic) return;
		bits.push(scaled[0].toString());
		if (scaled.length > 1) {bits.push('..'); bits.push(scaled[1].toString());}
		bits.push(mnemonic);

		return bits.join(' ');
	}
}

/* EOF */ }