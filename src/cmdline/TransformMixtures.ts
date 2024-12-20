/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2021 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {RenderPolicy} from 'webmolkit/gfx/Rendering';
import {ExportMInChI} from '../mixture/ExportMInChI';
import {ExportSDFile} from '../mixture/ExportSDFile';
import {ImportSDFile} from '../mixture/ImportSDFile';
import {OutlineMeasurement} from 'webmolkit/gfx/ArrangeMeasurement';
import {ArrangeMixture} from '../mixture/ArrangeMixture';
import {MetaVector} from 'webmolkit/gfx/MetaVector';
import {DrawMixture} from '../mixture/DrawMixture';
import {Vec} from 'webmolkit/util/Vec';
import * as fs from 'fs';
import {InChI} from '../nodejs/InChI';
import {Mixfile} from '../mixture/Mixfile';
import {Mixture} from '../mixture/Mixture';

/*
	Reads a stream of mixtures and writes it out as a stream, with format transformation as necessary.
*/

export enum TransformMixtureFormat
{
	Mixfile = 'mixfile', // single mixfile
	JSON = 'json', // list of mixtures
	SDF = 'sdf', // SDfile with mixture-specific columns
	MInChI = 'minchi', // MInChI notation, newline separated
	LongMInChIKey = 'longminchikey', // hashed keys of MInChI structure section
	ShortMInChIKey = 'shortminchikey', // crunched keys of MInChI structure section, fixed length
	SVG = 'svg', // graphical rendering
}
export const ALL_TRANSFORMMIXTURE_FORMATS = Object.values(TransformMixtureFormat);

export class TransformMixtures
{
	private process = require('process');

	private inputFormat:TransformMixtureFormat = null;
	private outputFormat:TransformMixtureFormat = null;

	private instream:any = null;
	private outstream:any = null;

	private count = 0;

	private nextIndex = 0;
	private roster:{idx:number; chunk:string}[] = [];

	constructor(private inputFile:string, inputFormat:string, private outputFile:string, outputFormat:string)
	{
		if (inputFormat)
		{
			if (!ALL_TRANSFORMMIXTURE_FORMATS.includes(inputFormat as TransformMixtureFormat)) throw 'Unknown input format: ' + inputFormat;
			this.inputFormat = inputFormat as TransformMixtureFormat;
		}
		if (outputFormat)
		{
			if (!ALL_TRANSFORMMIXTURE_FORMATS.includes(outputFormat as TransformMixtureFormat)) throw 'Unknown output format: ' + outputFormat;
			this.outputFormat = outputFormat as TransformMixtureFormat;
		}
	}

	public async exec():Promise<void>
	{
		if (this.inputFile && !this.inputFormat)
		{
			for (let fmt of ALL_TRANSFORMMIXTURE_FORMATS) if (this.inputFile.endsWith('.' + fmt))
			{
				this.inputFormat = fmt;
				break;
			}
		}
		if (!this.inputFormat) throw 'Unknown input format';
		if (this.inputFormat == TransformMixtureFormat.MInChI || this.inputFormat == TransformMixtureFormat.SVG ||
			this.inputFormat == TransformMixtureFormat.LongMInChIKey || this.inputFormat == TransformMixtureFormat.ShortMInChIKey) throw 'Can only write format: ' + this.inputFormat;

		if (this.outputFile && !this.outputFormat)
		{
			for (let fmt of ALL_TRANSFORMMIXTURE_FORMATS) if (this.outputFile.endsWith('.' + fmt))
			{
				this.outputFormat = fmt;
				break;
			}
		}
		if (!this.outputFormat) throw 'Unknown output format';
		if ((this.outputFormat == TransformMixtureFormat.MInChI || this.outputFormat == TransformMixtureFormat.LongMInChIKey ||
			this.outputFormat == TransformMixtureFormat.ShortMInChIKey) && !InChI.hasExecutable()) throw 'For MInChI, must specify InChI executable as command line parameter.';

		this.instream = this.inputFile ? fs.createReadStream(this.inputFile) : this.process.stdin;
		this.outstream = this.outputFile ? fs.createWriteStream(this.outputFile) : this.process.stdout;

		if (this.outputFormat == TransformMixtureFormat.JSON) this.outstream.write('[\n');

		if (this.inputFormat == TransformMixtureFormat.Mixfile) await this.pipeMixfile();
		else if (this.inputFormat == TransformMixtureFormat.JSON) await this.pipeJSON();
		else if (this.inputFormat == TransformMixtureFormat.SDF) await this.pipeSDF();

		this.flushRoster();

		if (this.outputFormat == TransformMixtureFormat.JSON) this.outstream.write(']\n');

		this.outstream.end();
	}

	// ------------ private methods ------------

	private async pipeMixfile():Promise<void>
	{
		return new Promise((resolve, reject) =>
		{
			let json = '';
			this.instream.on('data', (chunk:string) => json += chunk);
			this.instream.on('end', () =>
			{
				// (explicit blocking would be correct but hard to code in this framework; async tasks are ordered though, so is OK)
				(async () =>
				{
					try
					{
						let mixfile = JSON.parse(json) as Mixfile;
						await this.processMixfile(this.count++, mixfile);
						resolve();
					}
					catch (ex) {reject(ex);}
				})();
			});
		});
	}

	private async pipeJSON():Promise<void>
	{
		const StreamArray = require('stream-json/streamers/StreamArray');
		return new Promise((resolve, reject) =>
		{
			let array = StreamArray.withParser();
			this.instream.pipe(array.input);
			let json:Record<string, any> = {};
			array.on('data', (keyval:Record<string, any>) =>
			{
				let mixfile = keyval['value'] as Mixfile;
				// (explicit blocking would be correct but hard to code in this framework; async tasks are ordered though, so is OK)
				(async () =>
				{
					try
					{
						await this.processMixfile(this.count++, mixfile);
					}
					catch (ex) {reject(ex);}
				})();
			});
			array.on('end', () => resolve());
		});
	}

	private async pipeSDF():Promise<void>
	{
		let sdfile = new ImportSDFile();

		return new Promise((resolve, reject) =>
		{
			this.instream.on('data', (chunk:string) =>
			{
				sdfile.feed(chunk);
				for (let mixfile = sdfile.poll(); mixfile; mixfile = sdfile.poll()) this.processMixfile(this.count++, mixfile);
			});
			this.instream.on('end', () =>
			{
				// (explicit blocking would be correct but hard to code in this framework; async tasks are ordered though, so is OK)
				(async () =>
				{
					try
					{
						let mixfile = sdfile.poll(true);
						if (mixfile) await this.processMixfile(this.count++, mixfile);
						resolve();
					}
					catch (ex) {reject(ex);}
				})();
			});
		});
	}

	// a mixfile has been parsed out from the input stream, so deal with it appropriately: this means that something goes into the output roster
	// with the given index
	private async processMixfile(idx:number, mixfile:Mixfile):Promise<void>
	{
		if (mixfile.mixfileVersion == null) throw 'Invalid mixfile';

		let chunk:string = null;

		if (this.outputFormat == TransformMixtureFormat.Mixfile)
		{
			let json = new Mixture(mixfile).serialise(); // makes it nice
			chunk = json + '\n';
		}
		else if (this.outputFormat == TransformMixtureFormat.JSON)
		{
			this.outstream.write(idx == 0 ? ' ' : ',');
			let json = JSON.stringify(mixfile); // single line compact
			chunk = json + '\n';
		}
		else if (this.outputFormat == TransformMixtureFormat.SDF)
		{
			let sdfile = new ExportSDFile();
			sdfile.append(mixfile);
			let record = sdfile.write();
			chunk = record + '\n';
		}
		else if (this.outputFormat == TransformMixtureFormat.MInChI)
		{
			if (!InChI.isAvailable()) throw 'InChI unavailable: need to specify executable on command line';
			let minchi = new ExportMInChI(mixfile, new InChI());
			await minchi.fillInChI();
			minchi.formulate();
			chunk = minchi.getResult() + '\n';
		}
		else if (this.outputFormat == TransformMixtureFormat.LongMInChIKey)
		{
			if (!InChI.isAvailable()) throw 'InChI unavailable: need to specify executable on command line';
			let minchi = new ExportMInChI(mixfile, new InChI());
			await minchi.fillInChI();
			let hashkey = minchi.makeLongHashKey();
			chunk = hashkey + '\n';
		}
		else if (this.outputFormat == TransformMixtureFormat.ShortMInChIKey)
		{
			if (!InChI.isAvailable()) throw 'InChI unavailable: need to specify executable on command line';
			let minchi = new ExportMInChI(mixfile, new InChI());
			await minchi.fillInChI();
			let hashkey = minchi.makeShortHashKey();
			chunk = hashkey + '\n';
		}
		else if (this.outputFormat == TransformMixtureFormat.SVG)
		{
			let policy = RenderPolicy.defaultColourOnWhite(20);
			let measure = new OutlineMeasurement(0, 0, policy.data.pointScale);
			let layout = new ArrangeMixture(new Mixture(mixfile), measure, policy);
			layout.arrange();

			let gfx = new MetaVector();
			new DrawMixture(layout, gfx).draw();
			gfx.normalise();
			let svg = gfx.createSVG(false);

			chunk = svg + '\n';
		}

		this.roster.push({idx, chunk});
		this.flushRoster();
	}

	// checks the output roster for content to write out: will only write chunks if they are consecutive with the last emitted index; this is so because the
	// async generation methods do not necessarily come in with the same order
	private flushRoster():void
	{
		if (this.roster.length > 1) this.roster.sort((r1, r2) => r1.idx - r2.idx);

		while (this.roster.length > 0 && Vec.first(this.roster).idx == this.nextIndex)
		{
			let {chunk} = this.roster.shift();
			if (chunk) this.outstream.write(chunk);
			this.nextIndex++;
		}
	}

}

