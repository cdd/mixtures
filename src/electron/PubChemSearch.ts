/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2025 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {DataSheet} from 'webmolkit/ds/DataSheet';
import {MDLSDFReader} from 'webmolkit/io/MDLReader';
import {Molecule} from 'webmolkit/mol/Molecule';
import {MolUtil} from 'webmolkit/mol/MolUtil';
import {CoordUtil} from 'webmolkit/mol/CoordUtil';

/*
	Searching PubChem via the REST API, using names to track down other information, primarily structure.
*/

const BASE_COMPOUND = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';

export interface PubChemSearchResult
{
	mol:Molecule;
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

	public static async find(searchText:string):Promise<PubChemSearchResult[]>
	{
		return new Promise<PubChemSearchResult[]>((resolve, reject) =>
		{
			let results:PubChemSearchResult[] = [];
			let callbackResult = (result:PubChemSearchResult):void =>
			{
				results.push(result);
			};
			let callbackFinished = (err?:string):void =>
			{
				if (err) reject(err); else resolve(results);
			};
			new PubChemSearch(searchText, callbackResult, callbackFinished).start();
		});
	}

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

		let ds = new MDLSDFReader(data).parse();
		for (let n = 0; n < ds.numRows; n++) this.unpackCompound(ds, n);

		this.fetchNext();
	}

	private unpackCompound(ds:DataSheet, row:number):void
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
			MolUtil.stripHydrogens(result.mol);
			CoordUtil.normaliseBondDistances(result.mol);
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

