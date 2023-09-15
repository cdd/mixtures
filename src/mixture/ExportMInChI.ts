/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2020 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

// quick implementation of CRC hash codes
let crc_table:number[] = [];
function make_crc_table():void
{
	if (crc_table.length > 0) return;
	for (let n = 0; n < 256; n++)
	{
		let c = n;
		for (let i = 0; i < 8; i++) if ((c & 1) != 0) c = 0xEDB88320 ^ (c >>> 1); else c = (c >>> 1);
		crc_table.push(c);
	}
}
const BOOT_CRC = 0xFFFFFFFF;
function start_crc():number {return BOOT_CRC;}
function feed_crc(crc:number, byte:number):number
{
	let idx = (crc ^ byte) & 0xFF;
	return crc_table[idx] ^ (crc >>> 8);
}
function end_crc(crc:number):number {return crc ^ BOOT_CRC;}

// work-in-progress placeholder for the recursive MInChI assembler
interface MInChIBuilder
{
	layerN:string; // N-layer is the hierarchical form
	layerG:string; // G-layer has the concentrations
}

// for marking the segments of the outgoing MInChI string according to category
export enum MInChISegment
{
	None = 0,
	Header, // the initial recognition string
	Component, // the components (of which there can be multiple contiguous instances)
	Hierarchy, // the /n layer
	Concentration, // the /g layer
}

// augmented version of a component used to stash some MInChI-specific derived content
interface MInChIComponent extends MixfileComponent
{
	inchiFrag:string;
	useRatio:number;
	note:NormMixtureNote;
}

const MINCHI_VERSION = 'MInChI=0.99.1S';

/*
	Formulates a MInChI string out of the given mixture.
*/

export class ExportMInChI
{
	private mixture:Mixture;
	private norm:NormMixture;
	private minchi = '?';
	private segment:MInChISegment[] = null;

	// ------------ public methods ------------

	constructor(mixfile:Mixfile)
	{
		this.mixture = new Mixture(deepClone(mixfile));
		this.norm = new NormMixture(this.mixture);
		this.norm.analyse();
	}

	// this should generally be called first: any component that has a structure but not an InChI string gets one calculated,
	// which presumes that the external environment has been configured to allow this; returns true if anything was done, i.e.
	// the parameter mixture was modified; note that if any components have an InChI that is wrong, this will be believed
	public async fillInChI():Promise<boolean>
	{
		if (!InChI.isAvailable()) return false; // silent failure: the caller should check if specific action is required

		let modified = false;
		for (let comp of this.mixture.getComponents())
		{
			if (!comp.molfile || comp.inchi) continue;
			let mol:wmk.Molecule = null;
			try {mol = wmk.MoleculeStream.readUnknown(comp.molfile);}
			catch (e) {continue;} // silent failure if it's an invalid molecule
			if (wmk.MolUtil.isBlank(mol)) continue;
			let [inchi, inchiKey] = await InChI.makeInChI(mol);
			comp.inchi = inchi;
			comp.inchiKey = inchiKey;
			modified = true;
		}
		return modified;
	}

	// assembles the MInChI string: once this has completed, the result is available
	public formulate():void
	{
		let modmix = this.mixture.clone();
		//this.sortContents(sortmix.contents);

		for (let origin of modmix.getOrigins())
		{
			let note = this.norm.findNote(origin);
			if (note) (modmix.getComponent(origin) as MInChIComponent).note = note;
		}

		// special deal: any component with >2 mixtures that has a consistent ratio definition needs to be marked
		// at the parent-component level
		skip: for (let comp of modmix.getComponents()) if (Vec.len(comp.contents) >= 2)
		{
			if (Vec.len(comp.contents[0].ratio) != 2) continue;
			let [numer, denom] = comp.contents[0].ratio;
			for (let n = 1; n < comp.contents.length; n++)
			{
				let ratio = comp.contents[n].ratio;
				if (Vec.len(ratio) != 2 || ratio[1] != denom) continue skip;
				numer += ratio[0];
			}
			if (numer != denom) continue;
			for (let sub of comp.contents) (sub as MInChIComponent).useRatio = sub.ratio[0];
		}

		// assemble the InChI fragments - which is sorted and unique and devoid of blanks; same for "placenames", which are
		// terminal components that have name and concentration information, but no InChI
		let inchiList:string[] = [];
		const PFX = 'InChI=1S/'; // if it doesn't start with this, we don't consider it a valid InChI
		for (let origin of modmix.getOrigins())
		{
			let mcomp = modmix.getComponent(origin) as MInChIComponent;
			if (Vec.len(mcomp.contents) > 0) continue; // leaf nodes only need apply

			mcomp.inchiFrag = mcomp.inchi || '';
			if (mcomp.inchiFrag.startsWith(PFX)) mcomp.inchiFrag = mcomp.inchiFrag.substring(PFX.length);
			if (!inchiList.includes(mcomp.inchiFrag)) inchiList.push(mcomp.inchiFrag);
		}
		inchiList.sort();

		let root = modmix.mixfile as any as MInChIComponent;
		let builder = this.assembleContents(root, inchiList);

		this.minchi = '';
		this.segment = [];

		let appendSegment = (str:string, type:MInChISegment):void =>
		{
			this.minchi += str;
			for (let n = 0; n < str.length; n++) this.segment.push(type);
		};

		appendSegment(MINCHI_VERSION, MInChISegment.Header);
		appendSegment('/', MInChISegment.None);
		for (let n = 0; n < inchiList.length; n++)
		{
			if (n > 0) appendSegment('&', MInChISegment.None);
			appendSegment(inchiList[n], MInChISegment.Component);
		}
		appendSegment('/', MInChISegment.None);
		appendSegment('n' + builder.layerN, MInChISegment.Hierarchy);
		appendSegment('/', MInChISegment.None);
		appendSegment('g' + builder.layerG, MInChISegment.Concentration);
	}

	// returns the MInChI notationstring formulated as above
	public getResult():string
	{
		return this.minchi;
	}

	// return the segmentation values that mark the type for each character (corresponding to the notation string)
	public getSegment():MInChISegment[]
	{
		return this.segment;
	}

	// prepares a "hash key" for the mixture: this is basically a sorted unique list of the InChI keys for the structures; it has no concentration or hierarchy
	// information because these things are not canonical
	public makeLongHashKey():string
	{
		let bits:string[] = [];
		for (let comp of this.mixture.getComponents())
		{
			if (!comp.molfile) continue;
			if (!comp.inchiKey) throw 'Mixture has InChIKey(s) missing';
			if (!comp.inchiKey.startsWith('InChIKey=')) throw 'Invalid InChI key: ' + comp.inchiKey;
			bits.push(comp.inchiKey.substring(9));
		}
		bits = Vec.sortedUnique(bits);
		return 'Long-MInChIKey=' + bits.join(';');
	}

	// similar to above except fixed length and quite short
	public makeShortHashKey():string
	{
		make_crc_table();
		const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const NCRC = 4;
		let crclist:number[] = [], pos = 0;
		for (let n = 0; n < NCRC; n++) crclist.push(start_crc());

		let feedCharacter = (letter:string) =>
		{
			let idx = LETTERS.indexOf(letter);
			if (idx < 0) return;
			crclist[pos] = feed_crc(crclist[pos], idx);
			pos = pos < NCRC - 1 ? pos + 1 : 0;
		};

		let bits:string[] = [];
		for (let comp of this.mixture.getComponents())
		{
			if (!comp.molfile) continue;
			if (!comp.inchiKey) throw 'Mixture has InChIKey(s) missing';
			if (!comp.inchiKey.startsWith('InChIKey=')) throw 'Invalid InChI key: ' + comp.inchiKey;
			bits.push(comp.inchiKey.substring(9));
		}
		for (let bit of Vec.sortedUnique(bits)) for (let letter of bit)
		{
			feedCharacter(letter);
		}

		let key = 'Short-MInChIKey=';

		for (let crc of crclist)
		{
			crc = end_crc(crc) >>> 1; // clear the least significant bit and the sign as well
			for (let n = 0; n < 7; n++)
			{
				let idx = crc % 26;
				key += LETTERS[idx];
				crc = Math.trunc(crc / 26);
			}
		}

		return key;
	}

	// turns a concentration into a suitable precursor string, or null otherwise
	public static formatConcentration(quantity:number | number[], error:number, useRatio:number, units:string, relation:string):string
	{
		let mantissa = (value:number, exp:number):string => Math.round(value * Math.pow(10, -exp)).toString();

		// check for special deal: the "useRatio" property is defined if everything in this peer group has a ratio with
		// the same denominator and they add up correctly; when this isn't the case, it will fall through and convert to
		// a percentage
		if (useRatio != null)
		{
			let exp = this.determineExponent([useRatio], 4);
			return mantissa(useRatio, exp) + 'rt' + exp;
		}

		/*if (comp.ratio && comp.ratio.length >= 2)
		{
			let numer = comp.ratio[0], denom = comp.ratio[1];
			if (!(denom > 0)) return null;
			let value = 100 * numer / denom, exp = this.determineExponent([value], 4);
			return mantissa(value, exp) + 'pp' + exp;
		}*/

		if (quantity == null || units == null) return null;

		// special deal (maybe temporary): units that are written with common names that map to a URI are converted automatically
		let unitURI = units;
		if (!unitURI.startsWith('http://')) unitURI = Units.nameToURI(unitURI);
		if (!unitURI) return;

		// TODO: maybe another special deal for absolute weight/volume/mole quantities - convert them into ratios, to the extent that's
		// possible... maybe approximating where necessary

		let bits:string[] = [];

		if (relation != null) bits.push(relation);

		let values:number[] = typeof quantity == 'number' ? [quantity as number] : quantity;
		if (error != null) values.push(error);

		let [mnemonic, scaled] = Units.convertToMInChI(unitURI, values);
		if (!mnemonic) return;

		let exp = this.determineExponent(scaled, 4);

		bits.push(mantissa(scaled[0], exp));
		if (scaled.length > 1)
		{
			if (Array.isArray(quantity)) bits.push(':'); else bits.push('?');
			bits.push(mantissa(scaled[1], exp));
		}
		bits.push(mnemonic);
		bits.push(exp.toString());

		return bits.join('');
	}

	// ------------ private methods ------------

	private assembleContents(mcomp:MInChIComponent, inchiList:string[]):MInChIBuilder
	{
		let tree:MInChIBuilder = {layerN: '', layerG: ''};
		let builder:MInChIBuilder = {layerN: '', layerG: ''};

		// emit sub-contents recursively
		if (Vec.len(mcomp.contents) > 0)
		{
			if (mcomp.contents != null) for (let subComp of mcomp.contents)
			{
				let subTree = this.assembleContents(subComp as MInChIComponent, inchiList);
				//if (!subTree.layerN && !subTree.layerG) continue;
				if (tree.layerN.length > 0 || tree.layerG.length > 0)
				{
					tree.layerN += '&';
					tree.layerG += '&';
				}
				tree.layerN += subTree.layerN;
				tree.layerG += subTree.layerG;
			}
		}

		// append the current information
		let idx = mcomp.inchiFrag != null ? inchiList.indexOf(mcomp.inchiFrag) + 1 : 0;
		if (idx > 0) builder.layerN += idx.toString();

		let conc = ExportMInChI.formatConcentration(mcomp.quantity, mcomp.error, mcomp.useRatio, mcomp.units, mcomp.relation);
		if (!conc && mcomp.note)
		{
			let {concQuantity, concError, concUnits, concRelation} = mcomp.note;
			conc = ExportMInChI.formatConcentration(concQuantity, concError, null, concUnits, concRelation);
		}
		if (conc) builder.layerG += conc;

		if (tree.layerN.length > 0 || tree.layerG.length > 0)
		{
			builder.layerN = '{' + tree.layerN + '}' + builder.layerN;
			builder.layerG = '{' + tree.layerG + '}' + builder.layerG;
			this.shaveBeard(builder);
		}

		return builder;
	}

	// removes unnecessary nesting stubble
	private shaveBeard(builder:MInChIBuilder):void
	{
		while (builder.layerN.startsWith('{{') && builder.layerN.endsWith('}}') &&
			   builder.layerG.startsWith('{{') && builder.layerG.endsWith('}}'))
		{
			builder.layerN = builder.layerN.substring(1, builder.layerN.length - 1);
			builder.layerG = builder.layerG.substring(1, builder.layerG.length - 1);
		}
	}

	// given a positive number, gives out an appropriate exponent to scale it to, such that the mantissa can be an integer that accommodates
	// the required number of significant figures
	private static determineExponent(values:number[], sigfig:number):number
	{
		let minval = Number.POSITIVE_INFINITY;
		for (let v of values) minval = Math.min(minval, Math.abs(v));

		if (!Number.isFinite(minval) || Number.isNaN(minval) || minval <= 0) return 0;

		let exp = Math.round(Math.log10(minval)) - sigfig;
		//let man = Math.round(minval * Math.pow(10, -exp));

		let str:string[] = [];
		for (let v of values) str.push(Math.round(v * Math.pow(10, -exp)).toString());

		outer: while (true)
		{
			for (let n = 0; n < str.length; n++)
			{
				if (!str[n].endsWith('0')) break outer;
				str[n] = str[n].substring(0, str[n].length - 1);
			}
			exp++;
		}

		return exp;
	}
}

/* EOF */ }