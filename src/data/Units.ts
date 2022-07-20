/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Vec} from '../../wmk/util/Vec';

/* eslint-disable @typescript-eslint/naming-convention */

/*
	Unit definitions and conversions. Units are preferentially stored by URI, displayed by common name, and interconverted
	as necessary to other schemes, such as MInChI mnemonics.
*/

export enum StandardUnits
{
	// concentration units (these are favoured for most purposes)
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

	// absolute units (these are often converted to concentrations when possible)
	kg = 'http://purl.obolibrary.org/obo/UO_0000009', // kilogram
	g = 'http://purl.obolibrary.org/obo/UO_0000021', // gram
	mg = 'http://purl.obolibrary.org/obo/UO_0000022', // milligram
	ug = 'http://purl.obolibrary.org/obo/UO_0000023', // microgram
	ng = 'http://purl.obolibrary.org/obo/UO_0000024', // nanogram
	L = 'http://purl.obolibrary.org/obo/UO_0000099', // litre
	mL = 'http://purl.obolibrary.org/obo/UO_0000098', // millilitre
	uL = 'http://purl.obolibrary.org/obo/UO_0000101', // microlitre
	nL = 'http://purl.obolibrary.org/obo/UO_0000102', // nanolitre
	mol = 'http://purl.obolibrary.org/obo/UO_0000013', // mole
	mmol = 'http://purl.obolibrary.org/obo/UO_0000040', // millimole
	umol = 'http://purl.obolibrary.org/obo/UO_0000039', // micromole
	nmol = 'http://purl.obolibrary.org/obo/UO_0000041', // nanomole

	// other
	ppm = 'placeholder1',
	ppb = 'placeholder2',
}

const PAIR_UNIT_NAMES:any[] =
[
	// form: [reference URI, primary display name, ...optional alternative names]

	[StandardUnits.pc, '%'],
	[StandardUnits.pcWV, 'w/v%'],
	[StandardUnits.pcWW, 'w/w%'],
	[StandardUnits.pcVV, 'v/v%'],
	[StandardUnits.pcMM, 'mol/mol%'],
	[StandardUnits.ratio, 'ratio'],
	[StandardUnits.mol_L, 'mol/L', 'M'],
	[StandardUnits.mmol_L, 'mmol/L', 'mM'],
	[StandardUnits.umol_L, '\u{03BC}mol/L', 'umol/L', 'uM'],
	[StandardUnits.nmol_L, 'nmol/L', 'nM'],
	[StandardUnits.pmol_L, 'pmol/L', 'pM'],
	/*[StandardUnits.logM, ''],
	[StandardUnits.perM, ''],*/
	[StandardUnits.g_L, 'g/L'],
	[StandardUnits.mg_L, 'mg/L'],
	[StandardUnits.ug_L, '\u{03BC}g/L', 'ug/L'],
	[StandardUnits.mol_kg, 'mol/kg'],

	[StandardUnits.kg, 'kg'],
	[StandardUnits.g, 'g'],
	[StandardUnits.mg, 'mg'],
	[StandardUnits.ug, '\u{03BC}g', 'ug'],
	[StandardUnits.ng, 'ng'],
	[StandardUnits.L, 'L'],
	[StandardUnits.mL, 'mL'],
	[StandardUnits.uL, '\u{03BC}L', 'uL'],
	[StandardUnits.nL, 'nL'],
	[StandardUnits.mol, 'mol'],
	[StandardUnits.mmol, 'mmol'],
	[StandardUnits.umol, '\u{03BC}mol', 'umol'],
	[StandardUnits.nmol, 'nmol'],

	[StandardUnits.ppm, 'ppm'],
	[StandardUnits.ppb, 'ppb'],
];

const PAIR_UNIT_MINCHI:any[] =
[
	// [enum type, MInChI type, scaling] ... scaling factor is for going from standard to MInChI
	[StandardUnits.pc, 'pp', 1],
	[StandardUnits.pcWV, 'wv', 0.01],
	[StandardUnits.pcWW, 'wf', 0.01],
	[StandardUnits.pcVV, 'vf', 0.01],
	[StandardUnits.pcMM, 'mf', 0.01],
	[StandardUnits.ratio, 'rt', 1],
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
	[StandardUnits.ppm, 'pp', 1E-6],
	[StandardUnits.ppb, 'pp', 1E-9],
];

export class Units
{
	public static STANDARD_LIST:string[] = []; // all of the applicable unit URIs
	public static COMMON_NAMES:string[] = []; // all of the preferred names (same order as above)
	public static URI_TO_NAME:Record<string, string> = {}; // each URI has one preferred display name
	public static NAME_TO_URI:Record<string, string> = {}; // multiple unit forms can point to the same URI
	public static URI_TO_MINCHI:Record<string, [string, number]> = {}; // URI to MInChI, when applicable

	public static setup():void
	{
		for (let pair of PAIR_UNIT_NAMES)
		{
			let uri:string = pair[0], name:string = pair[1];
			this.STANDARD_LIST.push(uri);
			this.COMMON_NAMES.push(name);
			this.URI_TO_NAME[uri] = name;
			
			//this.NAME_TO_URI[name] = uri; (some of them have alternate names)
			for (let n = 1; n <= pair.length; n++) this.NAME_TO_URI[pair[n]] = uri;
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
		let [mnemonic, scale] = this.URI_TO_MINCHI[uri] || [null, null];
		if (!mnemonic) return [null, null];
		return [mnemonic, Vec.mul(values, scale)];
	}
}
