/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2021 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {RenderPolicy} from 'webmolkit/gfx/Rendering';
import {MixtureCollection} from '../data/MixtureCollection';
import {ArrangeMixture} from '../mixture/ArrangeMixture';
import {DrawMixture} from '../mixture/DrawMixture';
import {ExportMInChI, MInChISegment} from '../mixture/ExportMInChI';
import {OutlineMeasurement} from 'webmolkit/gfx/ArrangeMeasurement';
import {MetaVector} from 'webmolkit/gfx/MetaVector';
import {escapeHTML} from 'webmolkit/util/util';
import * as path from 'path';
import * as fs from 'fs';

/*
	Loads a mixture collection and emits it as visualisable HTML.
*/

export class RenderHTML
{
	constructor(private htmlFile:string, private withMInChI:boolean)
	{
	}

	public async exec():Promise<void>
	{
		let content:string;
		try {content = fs.readFileSync(this.htmlFile).toString();}
		catch (ex) {throw 'Unable to read file ' + this.htmlFile + ': ' + ex;}

		let mixlist = MixtureCollection.deserialise(content);
		if (mixlist.count == 0) throw 'Nothing to render';

		let emitln = (line:string):void => console.log(line);
		let emit = (txt:string):void => {process.stdout.write(txt);};

		emitln('<html>');
		emitln('<style>');
		emitln('table {border-collapse: collapse;}');
		emitln('td {border: 1px solid black; padding: 0.2em;}');
		emitln('.header {background-color: #FFC0C0;}');
		emitln('.component {background-color: #C0C0FF;}');
		emitln('.hierarchy {background-color: #E0E080;}');
		emitln('.concentration {background-color: #80E080;}');
		emitln('</style>');
		
		emitln('<body><table>');

		let policy = RenderPolicy.defaultColourOnWhite(15);
		let measure = new OutlineMeasurement(0, 0, policy.data.pointScale);

		for (let n = 0; n < mixlist.count; n++)
		{
			let mixture = mixlist.getMixtureDirect(n);

			emitln('<tr>');
			emitln(`<td>${n + 1}</td>`);

			let layout = new ArrangeMixture(mixture, measure, policy);
			layout.arrange();

			let gfx = new MetaVector();
			let draw = new DrawMixture(layout, gfx);
			draw.draw();
			gfx.normalise();

			emitln('<td>');
			emitln(gfx.createSVG());
			emitln('</td>');

			if (this.withMInChI)
			{
				let maker = new ExportMInChI(mixture.mixfile);
				await maker.fillInChI();
				maker.formulate();
				//let minchi = creator.getResult();
				//emitln('<td><pre>' + escapeHTML(minchi) + '</pre></td>');

				emit('<td><pre>');
				let minchi = maker.getResult(), segment = maker.getSegment();
				for (let n = 0; n < minchi.length; n++)
				{
					emit('<span');
					if (segment[n] == MInChISegment.Header) emit(' class="header"');
					else if (segment[n] == MInChISegment.Component) emit(' class="component"');
					else if (segment[n] == MInChISegment.Hierarchy) emit(' class="hierarchy"');
					else if (segment[n] == MInChISegment.Concentration) emit(' class="concentration"');
					emit('>' + escapeHTML(minchi[n]) + '</span>');
				}
				emitln('</pre></td>');
			}

			emitln('</tr>');
		}

		emitln('</table></body></html>');
	}

	// ------------ private methods ------------
}

