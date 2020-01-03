/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/data/MDLReader.ts'/>
///<reference path='../../../WebMolKit/src/data/MDLWriter.ts'/>
///<reference path='../../../WebMolKit/src/data/MolUtil.ts'/>
///<reference path='../../../WebMolKit/src/data/CoordUtil.ts'/>

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>
///<reference path='../main/startup.ts'/>

namespace Mixtures /* BOF */ {

/*
	Searching PubChem via the REST API, using names to track down other information, primarily structure.
*/

const BASE_COMPOUND = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';
//const BASE_SUBSTANCE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/substance';

export interface PubChemSearchResult
{
	mol:wmk.Molecule;
	names:string[];
	formula:string;
	inchi:string;
	inchiKey:string;
}

export class PubChemSearch
{
	private stopped = false;
	private cidList:number[] = [];

	// ------------ public methods ------------

	constructor(private searchText:string, private callbackResult:(result:PubChemSearchResult) => void, private callbackFinished:(err?:string) => void)
	{
	}

	// initiates the search: callback results are to be expected afterward
	public start():void
	{
		let url = BASE_COMPOUND + '/name/' + encodeURIComponent(this.searchText) + '/cids/JSON';

		const https = require('https');
		https.get(url, (resp:any) =>
		{
			let data = '';
			resp.on('data', (chunk:string) => data += chunk);
			resp.on('end', () => this.receivedList(data));
		}).on('error', (err:any) => {if (!this.stopped) this.callbackFinished(err.toString());});
	}

	// premature cessation: action ceases, no more callbacks
	public stop():void
	{
		this.stopped = true;
	}

	// ------------ private methods ------------

	// obtained the list of compounds, so proceed from there
	private receivedList(data:string):void
	{
		if (this.stopped) return;

		let obj = null;
		try
		{
			obj = JSON.parse(data);
		}
		catch (ex)
		{
			console.log('Received unparseable result: ' + data);
			this.callbackFinished('Unparseable result from name query: ' + ex.toString());
		}

		if (!obj.IdentifierList)
		{
			// found nothing
			this.callbackFinished();
			return;
		}

		this.cidList = obj.IdentifierList.CID;
		this.fetchNext();
	}

	private fetchNext():void
	{
		if (this.stopped) return;
		if (this.cidList.length == 0)
		{
			this.callbackFinished();
			return;
		}

		let cid = this.cidList.shift();
		let url = BASE_COMPOUND + '/cid/' + cid + '/SDF';

		const https = require('https');
		https.get(url, (resp:any) =>
		{
			let data = '';
			resp.on('data', (chunk:string) => data += chunk);
			resp.on('end', () => this.receivedCompound(data));
		}).on('error', (err:any) => {if (!this.stopped) this.callbackFinished(err.toString());});
	}

	private receivedCompound(data:string):void
	{
		if (this.stopped) return;

		let ds = new wmk.MDLSDFReader(data).parse();
		for (let n = 0; n < ds.numRows; n++) this.unpackCompound(ds, n);

		this.fetchNext();
	}

	private unpackCompound(ds:wmk.DataSheet, row:number):void
	{
		let result:PubChemSearchResult =
		{
			'mol': ds.getMolecule(row, 'Molecule'),
			'names': [],
			'formula': ds.getString(row, 'PUBCHEM_MOLECULAR_FORMULA'),
			'inchi': ds.getString(row, 'PUBCHEM_IUPAC_INCHI'),
			'inchiKey': ds.getString(row, 'PUBCHEM_IUPAC_INCHIKEY'),
		};

		if (result.mol)
		{
			wmk.MolUtil.stripHydrogens(result.mol);
			wmk.CoordUtil.normaliseBondDistances(result.mol);
		}

		const NAMECOLS = ['PUBCHEM_IUPAC_TRADITIONAL_NAME', 'PUBCHEM_IUPAC_SYSTEMATIC_NAME',
						  'PUBCHEM_IUPAC_OPENEYE_NAME', 'PUBCHEM_IUPAC_CAS_NAME', 'PUBCHEM_IUPAC_NAME'];
		for (let colName of NAMECOLS)
		{
			let names = ds.getString(row, colName);
			if (!names || typeof names != 'string') continue;
			for (let name of names.split('\n')) if (name && result.names.indexOf(name) < 0) result.names.push(name);
		}

		this.callbackResult(result);
	}
}

/* EOF */ }