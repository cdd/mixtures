/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	The Mixfile is a raw definition of the contents of a mixture, which maps directly to the JSON datastructure
	that holds the serialised content. For keeping an operable mixture instance, see the Mixture class.
*/

export const MIXFILE_VERSION = 0.01; // version number to use for newly created instances

export interface Mixfile extends MixfileComponent
{
	mixfileVersion:number;
}

export interface MixfileComponent
{
	name?:string;
	description?:string;
	synonyms?:string[];

	// molecular specification: none of them are mandatory, but if more than one is specified, they must refer to the same species, 
	// to the extent that the format allows; InChI strings are expected to be standard, while SMILES are not
	formula?:string;
	molfile?:string;
	inchi?:string;
	inchiKey?:string;
	smiles?:string;

	// if the concentration is known, then these fields should be filled out as appropriate; if the concentration is a ratio,
	// it is relative to all of the components within the same branch
	ratio?:number[]; // a ratio, specified as [numerator, denominator]
	quantity?:number | number[]; // a concentration numeric which is associated with the units below (two numbers in case of a range)
	units?:string; // units for quantity (e.g. %, mol/L, g, etc.)
	relation?:string; // optional modifier when applied to quantity (e.g. >, <, ~)

	// identifiers that map the substance to external databases (e.g. PubChem, ChemSpider, CAS, etc.); identifiers are ID numbers, and
	// the meaning is implied by the context; links should be resolvable URLs, which are an alternative way of locating external
	// resources; in some cases where there are multiple identifiers, the value should be specified as an array
	identifiers?:{[id:string] : string | string[]};
	links?:{[id:string] : string | string[]};

	// subcomponents: if this is a discrete molecular entity, then there will be none; usually there are either 0 or 2-or-more; in cases
	// where there are any subcomponents, any of the properties above apply to all of these subcomponents collectively
	contents?:MixfileComponent[];
}

// useful for cleaning up external JSON content
export const MIXFILE_COMPONENT_FIELDS =
[
	'name', 'description', 'synonyms', 'formula', 'molfile', 'inchi', 'inchiKey', 'smiles',
	'ratio', 'quantity', 'units', 'relation', 'identifiers', 'links', 'contents'
];

/* orignal example of what the format might look like (1st draft):
{
	"mixture": "1.0 M lithium diisopropyl amide in THF/hexanes",
	"contents":
	[
		{
			"name": "lithium diisopropylamide",
			"synonyms": ["LDA", "(iPr)2N.Li"],
			"formula": "C6H14LiN",
			"pubchem": "2724682",
			"chemspider": "2006804",
			"inchi": "InChI=1S/C6H14N.Li/c1-5(2)7-6(3)4;/h5-6H,1-4H3;/q-1;+1",
			"smiles": "[Li+].CC(C)[N-]C(C)C",
			"molfile": "\nOpenMolecule\n\n  8  7  0  0  0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0\n    1.5000    0.0000    0.0000 Li  0  0  0  0  0  0  0  0  0  0  0  0\n   -0.7500    1.2990    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.7500   -1.2990    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -0.0000    2.5981    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -2.2500    1.2990    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    0.0000   -2.5981    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -2.2500   -1.2990    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  3  1  0  0  0  0\n  1  4  1  0  0  0  0\n  3  5  1  0  0  0  0\n  3  6  1  0  0  0  0\n  4  7  1  0  0  0  0\n  4  8  1  0  0  0  0\nM  END\n",
			"quantity": 1.0,
			"units": "mol/L"
		},
		{
			"group": "solvent",
			"contents":
			[
				{
					"name": "tetrahydrofuran",
					"synonyms": ["THF"],
					"formula": "C4H8O",
					"pubchem": "8028",
					"chemspider": "7737",
					"inchi": "InChI=1S/C4H8O/c1-2-4-5-3-1/h1-4H2",
					"smiles": "C1CCOC1",
					"molfile": "...",
					"fraction": [1, 8]
				},
				{
					"group": "hexanes",
					"fraction": [7, 8],
					"contents":
					[
						{
							"name": "n-hexane",
							"formula": "C6H14",
							"pubchem": "8058",
							"chemspider": "7767",
							"inchi": "InChI=1S/C6H14/c1-3-5-6-4-2/h3-6H2,1-2H3",
							"smiles": "CCCCCC",
							"molfile": "...",
							"percentage": [50, 70]
						},
						{
							"name": "methylcyclopentane",
							"formula": "C6H14",
							"pubchem": "7296",
							"chemspider": "7024",
							"inchi": "InChI=1S/C6H12/c1-6-4-2-3-5-6/h6H,2-5H2,1H3",
							"smiles": "CC1CCCC1",
							"molfile": "...",
							"percentage": [10, 20]
						},
						{
							"name": "2-methypentane",
							"formula": "C6H14",
							"pubchem": "7892",
							"chemspider": "7604",
							"inchi": "InChI=1S/C6H14/c1-4-5-6(2)3/h6H,4-5H2,1-3H3",
							"smiles": "CCCC(C)C",
							"molfile": "...",
							"percentage": [1, 5]
						},
						{
							"name": "3-methylpentane",
							"formula": "C6H14",
							"pubchem": "7282",
							"chemspider": "7010",
							"inchi": "InChI=1S/C6H14/c1-4-6(3)5-2/h6H,4-5H2,1-3H3",
							"smiles": "CCC(C)CC",
							"molfile": "...",
							"percentage": [1, 5]
						},
						{
							"name": "other hexanes"
						}
					]
				}
			]
		}
	]
}
*/

/* EOF */ }