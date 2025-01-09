/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2025 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Molecule} from 'webmolkit/mol/Molecule';
import {Vec} from 'webmolkit/util/Vec';
import {MDLSDFReader} from 'webmolkit/io/MDLReader';
import {DataSheetColumn} from 'webmolkit/ds/DataSheet';
import {MDLMOLWriter} from 'webmolkit/io/MDLWriter';
import {Mixfile, MixfileComponent} from './Mixfile';
import {Mixture} from './Mixture';
import {StandardUnits, Units} from './Units';

/*
	Importing one or more mixtures from chunks of text that represent an SDfile with special mixture fields.
*/

interface ImportComponent
{
	mol:Molecule;
	name:string;
	conc:string;
	hier:string;
}

export class ImportSDFile
{
	private buffer = '';
	private components:ImportComponent[] = [];
	private mixfiles:Mixfile[] = [];

	// ------------ public methods ------------

	constructor()
	{
	}

	// adds a chunk of text to the buffer, which may cause more SDfile units to be extracted; after calling this, 0-or-more new mixtures will become available
	// to be polled
	public feed(chunk:string):void
	{
		this.buffer += chunk;
		while (true)
		{
			let sep = this.buffer.indexOf('$$$$\n');
			if (sep < 0) break;
			sep += 5;
			this.processBlock(this.buffer.substring(0, sep));
			this.buffer = this.buffer.substring(sep);
		}
	}

	// grab the next assembled mixfile and take it out of the delivery list; if the final flag is true, it means we've reached the end of the input sequence, so
	// whatever components remain must be complete
	public poll(final = false):Mixfile
	{
		if (Vec.notBlank(this.mixfiles)) return this.mixfiles.shift();
		if (final && Vec.notBlank(this.components))
		{
			this.assembleComponents();
			return this.mixfiles[0];
		}
		return null;
	}

	// ------------ private methods ------------

	// have identified one SDfile record (ending in $$$$), so carve it up into an upcoming component
	private processBlock(sdfile:string):void
	{
		let reader = new MDLSDFReader(sdfile);
		reader.upcastColumns = false;
		let ds = reader.parse();
		if (!ds || ds.numRows == 0) return;
		let colMol = ds.firstColOfType(DataSheetColumn.Molecule);
		let colName = ds.findColByName('Name');
		let colHier = ds.findColByName('MINCHI$N');
		let colConc = ds.findColByName('MINCHI$C');
		if (colHier < 0) return; // not a valid mixture block

		let mol = colMol < 0 ? null : ds.getMolecule(0, colMol);
		let name = colName < 0 ? null : ds.getString(0, colName);
		let hier = ds.getString(0, colHier);
		let conc = colConc < 0 ? null : ds.getString(0, colConc);
		if (Vec.notBlank(this.components) && hier == '1') this.assembleComponents();

		this.components.push({mol, name, hier, conc});
	}

	// turn the current list of components into a mixfile, based on the assumption that we've reached a dividing point
	private assembleComponents():void
	{
		let mixture = new Mixture();

		for (let incomp of this.components)
		{
			let molfile = incomp.mol ? new MDLMOLWriter(incomp.mol).write() : undefined;
			let origin = incomp.hier.split('.').map((str) => parseInt(str) - 1);
			let idx = origin.pop();
			let parent = mixture.getComponent(origin);
			if (!parent.contents) parent.contents = [];
			let comp:MixfileComponent = {name: incomp.name, molfile: molfile, contents: []};
			if (incomp.conc) this.decodeConcentration(incomp.conc, comp);
			parent.contents[idx] = comp;
		}

		if (mixture.mixfile.contents.length == 1) mixture = new Mixture(mixture.mixfile.contents[0] as Mixfile);

		// ratios are expressed as the numerator; fill in the denominator as well
		let finishRatio = (comp:MixfileComponent):void =>
		{
			if (Vec.isBlank(comp.contents)) return;
			let denom = 0;
			for (let child of comp.contents)
			{
				 if (!child.ratio || Vec.len(child.ratio) != 2)
				 {
				 	denom = 0;
					break;
				 }
				 denom += child.ratio[0];
			}
			for (let child of comp.contents)
			{
				if (denom > 0)
					child.ratio = [child.ratio[0], denom];
				else
					child.ratio = undefined;
			}
			for (let child of comp.contents) finishRatio(child);
		};
		finishRatio(mixture.mixfile);

		this.components = [];
		this.mixfiles.push(mixture.mixfile);
	}

	// unpacks the MInChI-style concentration from the SDfile into the dictionary-style used by Mixfile components
	private decodeConcentration(conc:string, comp:MixfileComponent):void
	{
		let match = conc.match(/^([\>\<\=\~]*)([-\d\.:]+)(\w\w)([-\d]*)$/);
		if (!match) return; // this is technically an error: fails silently

		let relation = match[1], qstr = match[2], mnemonic = match[3], mantissa = parseInt(match[4]) || 0;

		let quant1:number = null, quant2:number = NaN;
		if ((match = qstr.match(/^([-\d\.]+):([-\d\.]+)$/)))
		{
			quant1 = parseFloat(match[1]);
			quant2 = parseFloat(match[2]);
			if (isNaN(quant1) || isNaN(quant2)) return;
		}
		else
		{
			quant1 = parseFloat(qstr);
			if (isNaN(quant1)) return;
		}

		let units = '', scale = 1, isRatio = false;
		if (mnemonic == 'pp') units = StandardUnits.pc;
		else if (mnemonic == 'wv') [units, scale] = [StandardUnits.pcWV, 100];
		else if (mnemonic == 'wf') [units, scale] = [StandardUnits.pcWW, 100];
		else if (mnemonic == 'vf') [units, scale] = [StandardUnits.pcVV, 100];
		else if (mnemonic == 'mf') [units, scale] = [StandardUnits.pcMM, 100];
		else if (mnemonic == 'rt') isRatio = true;
		else if (mnemonic == 'mr') [units, scale] = [StandardUnits.mol_L, 1];
		else if (mnemonic == 'wv') [units, scale] = [StandardUnits.g_L, 1E3];
		else if (mnemonic == 'mb') units = StandardUnits.mol_kg;
		else return; // not recognised

		comp.relation = relation || undefined;

		if (isRatio) comp.ratio = [quant1, 0];
		else if (isNaN(quant2))
		{
			comp.quantity = quant1 * Math.pow(10, mantissa) * scale;
			comp.units = Units.uriToName(units);
		}
		else // it's a range
		{
			comp.quantity = [quant1 * Math.pow(10, mantissa) * scale, quant2 * Math.pow(10, mantissa) * scale];
			comp.units = Units.uriToName(units);
		}
	}
}

