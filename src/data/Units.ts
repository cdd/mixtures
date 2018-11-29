/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	Unit definitions and conversions. Units are preferentially stored by URI, displayed by common name, and interconverted
	as necessary to other schemes, such as MInChI mnemonics.
*/

export enum StandardUnits
{
	pc = 'http://purl.obolibrary.org/obo/UO_0000187', // percent (of arbitrary type)
	pcWV = 'http://purl.obolibrary.org/obo/UO_0000164', // percent (weight per volume),
	pcWW = 'http://purl.obolibrary.org/obo/UO_0000163', // percent (weight per weight),
	pcVV = 'http://purl.obolibrary.org/obo/UO_0000205', // percent (volume per volume),
	pcMM = 'http://purl.obolibrary.org/obo/UO_0000076', // percent (mole per mole)
	ratio = 'http://purl.obolibrary.org/obo/UO_0000190', // ratio (numerator only; nominally by volume)
	mol_L = 'http://purl.obolibrary.org/obo/UO_0000062', // moles per litre (mol/L)
	mmol_L = 'http://purl.obolibrary.org/obo/UO_0000063', // milli-moles per litre
	umol_L = 'http://purl.obolibrary.org/obo/UO_0000064', // micro-moles per litre
	nmol_L = 'http://purl.obolibrary.org/obo/UO_0000065', // nano-moles per litre
	pmol_L = 'http://purl.obolibrary.org/obo/UO_0000066', // pico-moles per litre
	/* could be handy to allow these... maybe
	logM = 'http://www.bioassayontology.org/bao#BAO_0000101', // log10 of mol/L
	perM = 'http://www.bioassayontology.org/bao#BAO_0000102', // -log10 of mol/L */
	g_L = 'http://purl.obolibrary.org/obo/UO_0000175', // grams per litre (g/L)
	mg_L = 'http://purl.obolibrary.org/obo/UO_0000273', // milligrams per litre (aka micrograms per mL)
	ug_L = 'http://purl.obolibrary.org/obo/UO_0000275', // micrograms per litre (aka nanograms per mL)
	mol_kg = 'http://purl.obolibrary.org/obo/UO_0000068', // moles per kilogram
}

const PAIR_UNIT_NAMES:any[] =
[
	[StandardUnits.pc, '%'],
	[StandardUnits.pcWV, 'w/v%'],
	[StandardUnits.pcWW, 'w/w%'],
	[StandardUnits.pcVV, 'v/v%'],
	[StandardUnits.pcMM, 'mol/mol%'],
	[StandardUnits.ratio, 'ratio'],
	[StandardUnits.mol_L, 'mol/L'],
	[StandardUnits.mmol_L, 'mmol/L', 1E-3],
	[StandardUnits.umol_L, '\u{03BC}mol/L', 1E-6],
	[StandardUnits.pmol_L, 'pmol/L', 1E-9],
	/*[StandardUnits.logM, ''],
	[StandardUnits.perM, ''],*/
	[StandardUnits.g_L, 'g/L', 1],
	[StandardUnits.mg_L, 'mg/L', 1E-3],
	[StandardUnits.ug_L, '\u{03BC}/L', 1E-6],
	[StandardUnits.mol_kg, 'mol/kg', 1],
];

const PAIR_UNIT_MINCHI:any[] =
[
	// [enum type, MInChI type, scaling] ... scaling factor is for going from standard to MInChI
	[StandardUnits.pc, 'pp', 1],
	[StandardUnits.pcWV, 'wv', 0.01],
	[StandardUnits.pcWW, 'wf', 0.01],
	[StandardUnits.pcVV, 'vf', 0.01],
	[StandardUnits.pcMM, 'mf', 0.01],
	[StandardUnits.ratio, 'vp', 1],
	[StandardUnits.mol_L, 'mr', 1],
	[StandardUnits.mmol_L, 'mr', 1E-3],
	[StandardUnits.umol_L, 'mr', 1E-6],
	[StandardUnits.nmol_L, 'mr', 1E-9],
	[StandardUnits.pmol_L, 'mr', 1E-12],
	/*[StandardUnits.logM, '', ],
	[StandardUnits.perM, '', ],*/
	[StandardUnits.g_L, 'wv', 1E-3],
	[StandardUnits.mg_L, 'wv', 1E-6],
	[StandardUnits.ug_L, 'wv', 1E-9],
	[StandardUnits.mol_kg, 'mb', 1],
];

/*Notation code	Concentration type	Units
mb	Molality	mol/kg
wv	Weight per Volume	mg/L
wf	Mass Fraction*	wt./total wt.
vf	Volume Fraction*	vol./total vol.
vp	Volume Proportion	v:v:v
mf	Mole Fraction	mol/total mol
pH	pH	pH
pp	Raw percent	Not specified
rt	Ratio (generic)	#:#:#
pt	Percent (generic)	%
*/

export class Units
{
	private static STANDARD_LIST:string[] = [];
	private static COMMON_NAMES:string[] = [];
	private static URI_TO_NAME:{[id:string] : string} = {};
	private static NAME_TO_URI:{[id:string] : string} = {};
	private static URI_TO_MINCHI:{[id:string] : [string, number]} = {};
	public static setup()
	{
		for (let pair of PAIR_UNIT_NAMES)
		{
			let uri:string = pair[0], name:string = pair[1];
			this.STANDARD_LIST.push(uri);
			this.COMMON_NAMES.push(name);
			this.URI_TO_NAME[uri] = name;
			this.NAME_TO_URI[name] = uri;
		}
		for (let pair of PAIR_UNIT_MINCHI)
		{
			let uri:string = pair[0], name:string = pair[1], scale:number = pair[2];
			this.URI_TO_MINCHI[uri] = [name, scale];
		}
		this.setup = () => {}; // calling it again is a nop
	}

	public static standardList():string[]
	{
		this.setup();
		return this.STANDARD_LIST;
	}
	public static commonNames():string[]
	{
		this.setup();
		return this.COMMON_NAMES;
	}
	public static uriToName(uri:string):string
	{
		this.setup();
		return this.URI_TO_NAME[uri];
	}
	public static nameToURI(name:string):string
	{
		this.setup();
		return this.NAME_TO_URI[name];
	}

	// converts a uri/value pair into mnemonic/value, ready to be exported to MInChI-style units; if the URI is not in the list of
	// things that can be converted, returns nulls
	public static convertToMInChI(uri:string, values:number[]):[string, number[]]
	{
		let [mnemonic, scale] = this.URI_TO_MINCHI[uri];
		if (!mnemonic) return [null, null];
		return [mnemonic, Vec.mul(values, scale)];
	}
}

/* EOF */ }