/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2021 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {MixfileComponent} from '../data/Mixfile';
import {MixtureCollection} from '../data/MixtureCollection';
import {DataSheet} from 'webmolkit/data/DataSheet';
import {AssayProvenance} from 'webmolkit/aspect/AssayProvenance';
import {MeasurementData} from 'webmolkit/aspect/MeasurementData';
import {Molecule} from 'webmolkit/data/Molecule';
import {DataSheetStream} from 'webmolkit/data/DataSheetStream';
import {MDLSDFReader} from 'webmolkit/data/MDLReader';
import {MDLMOLWriter} from 'webmolkit/data/MDLWriter';
import {Mixture as MixtureAspect} from 'webmolkit/aspect/Mixture';
import {Vec} from 'webmolkit/util/Vec';
import {Mixture} from '../data/Mixture';
import * as fs from 'fs';
import * as path from 'path';

/*
	Table extraction: create Mixfile instances from tabular data sources, with the help of directions for placing columns into
	the mixture hierarchy.
*/

export enum TableExtractType
{
	Structure = 'structure',
	Name = 'name',
	Quantity = 'quantity',
	Bound = 'bound',
	Error = 'error',
	Ratio = 'ratio',
	Units = 'units',
	Relation = 'relation',
	Identifier = 'identifier',
	Link = 'link',
	Property = 'property',
}

interface TableExtractMapping
{
	column:string;
	origin:number[];
	type:TableExtractType;
	info?:string[];
}

export class TableExtract
{
	private table:DataSheet = null;
	private aprov:AssayProvenance = null;
	private mdata:MeasurementData = null;

	private lookup:Map<string, Molecule> = null;
	private mappings:TableExtractMapping[] = [];

	constructor(private tableFile:string, private lookupFile:string, private mappingFile:string, private verbose:boolean)
	{
	}

	public async exec():Promise<void>
	{
		let content:string;
		try {content = fs.readFileSync(this.tableFile).toString();}
		catch (ex) {throw 'Unable to read file ' + this.tableFile + ': ' + ex;}

		if (this.tableFile.endsWith('.ds')) this.table = DataSheetStream.readXML(content);
		else if (this.tableFile.endsWith('.sdf')) this.table = new MDLSDFReader(content).parse();
		else if (this.tableFile.endsWith('.csv')) this.table = this.parseLines(',', true);
		else if (this.tableFile.endsWith('.tsv') || this.tableFile.endsWith('.tab')) this.table = this.parseLines('\t', false);
		if (!this.table) throw 'Unable to parse: ' + this.tableFile;

		if (AssayProvenance.isAssayProvenance(this.table)) this.aprov = new AssayProvenance(this.table, false);
		if (MeasurementData.isMeasurementData(this.table)) this.mdata = new MeasurementData(this.table, false);

		if (this.lookupFile)
		{
			// TODO
		}

		this.initialMapping();
		if (this.mappingFile)
		{
			content = fs.readFileSync(this.mappingFile).toString();
			this.customMapping(JSON.parse(content));
		}

		if (this.mappings.length == 0) throw 'No column mapping information available.';

		let mixtures = new MixtureCollection();
		for (let n = 0; n < this.table.numRows; n++)
		{
			let mixture = this.extractMixture(n);
			if (mixture) mixtures.appendMixtureDirect(mixture);
		}

		console.log(mixtures.serialise(true));
	}

	// ------------ private methods ------------

	// read TSV/CSV file, which is presumed to have column headings, and may include escape sequences
	private parseLines(sep:string, escaped:boolean):DataSheet
	{
		let ds = new DataSheet();

		// !! load each line, split into strings, apply columns then rows...
		// !! anything that's all {int} or {real} gets changed retroactively

		return ds;
	}

	// extract column-to-mixture information embedded in the initial datasheet, if possible
	private initialMapping():void
	{
		if (!MixtureAspect.isMixture(this.table)) return;

		let aspect = new MixtureAspect(this.table, false);
		for (let attr of aspect.getHeader().attributes)
		{
			let map:TableExtractMapping =
			{
				'column': attr.column,
				'origin': Vec.add(attr.position, -1),
				'type': attr.type as any as TableExtractType, // same enum values
				'info': attr.info,
			};
			this.mappings.push(map);
		}
	}

	// merge in user-provided mappings
	private customMapping(custom:TableExtractMapping[]):void
	{
		for (let map of custom)
		{
			let idx = this.mappings.findIndex((look) => look.column == map.column);
			if (idx >= 0) this.mappings[idx] = map; else this.mappings.push(map);
		}
	}

	// pull out the content from a row in the table and corral them into a mixture
	private extractMixture(row:number):Mixture
	{
		let mixture = new Mixture();

		for (let map of this.mappings)
		{
			let comp = mixture.mixfile as MixfileComponent;
			for (let idx of map.origin)
			{
				if (comp.contents == null) comp.contents = [];
				while (idx >= comp.contents.length) comp.contents.push({});
				comp = comp.contents[idx];
			}
		}

		let appendQuant = (quantity:number | number[], val:number):number | number[] =>
		{
			if (isNaN(val)) return quantity;
			if (quantity == null) return val;
			else if (typeof quantity == 'number' && quantity != val) return [Math.min(quantity, val), Math.max(quantity, val)];
			else return quantity;
		};

		let stashRatio = new Map<string, number>();
		let fields = this.mdata ? this.mdata.getHeader().fields : [];

		for (let map of this.mappings)
		{
			let col = this.table.findColByName(map.column);
			if (col < 0 || this.table.isNull(row, col)) continue;

			let comp = mixture.getComponent(map.origin);

			if (map.type == TableExtractType.Structure)
			{
				let mol = this.table.getMolecule(row, col);
				comp.molfile = new MDLMOLWriter(mol).write();
			}
			else if (map.type == TableExtractType.Name)
			{
				comp.name = this.table.toString(row, col);
			}
			else if (map.type == TableExtractType.Quantity)
			{
				// if aspected: can extract more information
				if (this.aprov && map.column == AssayProvenance.COLNAME_VALUE)
				{
					comp.quantity = this.aprov.getValue(row);
					let error = this.aprov.getError(row);
					if (!isNaN(error)) comp.error = error;
					comp.units = this.aprov.getUnits(row); // TODO: translate based on URI
					let relation = this.aprov.getRelation(row);
					if (relation && relation != '=') comp.relation = relation;
					continue;
				}
				let field = fields.find((f) => f.name == map.column);
				if (field)
				{
					let value = this.mdata.getValueField(row, field);
					comp.quantity = value.value;
					if (!isNaN(value.error)) comp.error = value.error;
					comp.units = value.units;
					if (value.mod && value.mod != '=') comp.relation = value.mod;
					continue;
				}

				let val = parseFloat(this.table.toString(row, col));
				comp.quantity = appendQuant(comp.quantity, val);
			}
			else if (map.type == TableExtractType.Bound)
			{
				let val = parseFloat(this.table.toString(row, col));
				comp.quantity = appendQuant(comp.quantity, val);
			}
			else if (map.type == TableExtractType.Error)
			{
				let val = parseFloat(this.table.toString(row, col));
				if (!isNaN(val)) comp.error = val;
			}
			else if (map.type == TableExtractType.Ratio)
			{
				let val = parseFloat(this.table.toString(row, col));
				if (!isNaN(val)) stashRatio.set(JSON.stringify(map.origin), val);
			}
			else if (map.type == TableExtractType.Units)
			{
				let units = this.table.toString(row, col);
				// TODO: correction/mapping...
				comp.units = units;
			}
			else if (map.type == TableExtractType.Relation)
			{
				let relation = this.table.toString(row, col);
				// TODO: correction/mapping...
				comp.relation = relation;
			}
			else if (map.type == TableExtractType.Identifier)
			{
				if (comp.identifiers == null) comp.identifiers = {};
				comp.identifiers[map.column] = this.table.toString(row, col);
			}
			else if (map.type == TableExtractType.Link)
			{
				if (comp.links == null) comp.links = {};
				comp.links[map.column] = this.table.toString(row, col);
			}
			else if (map.type == TableExtractType.Property)
			{
				console.log('TODO: property'); // !! lookup aspects...
			}
		}

		// fill in any missing ratios
		for (let origin of mixture.getOrigins())
		{
			let comp = mixture.getComponent(origin);
			if (Vec.isBlank(comp.contents)) continue;
			let num = 0, total = 0;
			for (let n = 0; n < comp.contents.length; n++) if (!Mixture.isComponentEmpty(comp.contents[n]))
			{
				let ratio = stashRatio.get(JSON.stringify([...origin, n]));
				if (!ratio) {num = 0; break;}
				num++;
				total += ratio;
			}
			if (num > 0) for (let n = 0; n < comp.contents.length; n++) if (!Mixture.isComponentEmpty(comp.contents[n]))
			{
				let ratio = stashRatio.get(JSON.stringify([...origin, n]));
				comp.contents[n].ratio = [ratio, total];
			}
		}

		// trim out blank pieces
		skip: for (let origin of Vec.reverse(mixture.getOrigins()))
		{
			let comp = mixture.getComponent(origin);
			if (Mixture.isComponentEmpty(comp))
			{
				mixture.deleteComponent(origin);
				continue;
			}

			// may collapse singletons
			if (Vec.arrayLength(comp.contents) != 1) continue;
			for (let key in comp) if (key != 'contents' && (comp as any)[key]) continue skip;
			let sub = comp.contents[0];
			comp.contents = null;
			mixture.setComponent(origin, sub);
		}

		return mixture;
	}
}

