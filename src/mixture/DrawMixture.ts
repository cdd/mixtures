/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2025 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {MetaVector, TextAlign} from 'webmolkit/gfx/MetaVector';
import {ArrangeMixture, ArrangeMixtureComponent, ArrangeMixtureLine} from './ArrangeMixture';
import {Box} from 'webmolkit/util/Geom';
import {ArrangeMeasurement} from 'webmolkit/gfx/ArrangeMeasurement';
import {RenderPolicy} from 'webmolkit/gfx/Rendering';
import {DrawMolecule} from 'webmolkit/gfx/DrawMolecule';

/*
	Drawing a Mixfile, which has been arranged already.
*/

export class DrawMixture
{
	public hoverIndex = -1; // component to give a faint tinting to (for hover-over effect)
	public activeIndex = -1; // component that is actively engaged with UI
	public selectedIndex = -1; // component that is passively selected

	// optionally override drawing functionality within a component; return true if the rendering was intercepted,
	// or false to fall back to default rendering
	public callbackDrawMolecule:(comp:ArrangeMixtureComponent, gfx:MetaVector, box:Box) => boolean = null;
	public callbackDrawNameLine:(comp:ArrangeMixtureComponent, line:ArrangeMixtureLine, gfx:MetaVector, box:Box) => boolean = null;

	private measure:ArrangeMeasurement;
	private policy:RenderPolicy;

	private scale:number;
	private invScale:number;

	// --------------------- public methods ---------------------

	constructor(private layout:ArrangeMixture, private vg:MetaVector)
	{
		this.measure = layout.measure;
		this.policy = layout.policy;
		this.scale = layout.scale;
		this.invScale = 1.0 / this.scale;
	}

	// renders the experiment, one component at a time
	public draw():void
	{
		for (let comp of this.layout.components) if (comp.parentIdx >= 0)
			this.drawConnection(this.layout.components[comp.parentIdx], comp);

		for (let n = 0; n < this.layout.components.length; n++) this.drawComponent(n);
	}

	// --------------------- private methods ---------------------

	private drawConnection(parent:ArrangeMixtureComponent, child:ArrangeMixtureComponent):void
	{
		let x1 = parent.boundary.maxX(), x2 = child.boundary.minX();
		let y1 = parent.boundary.midY(), y2 = child.boundary.midY();
		//let xm = 0.5 * (x1 + x2);
		let xm = x1 + 0.25 * this.scale;
		let ym = 0.5 * (y1 + y2);
		let d = 4, xd = d, yd = y1 < y2 - 1 ? -d : y1 > y2 + 1 ? d : 0;

		let px = [x1, xm - xd, xm, xm, xm, xm, xm + xd, x2];
		let py = [y1, y1, y1, y1 - yd, y2 + yd, y2, y2, y2];
		let lsz = this.scale * 0.1;
		this.vg.drawPath(px, py, [false, false, true, false, false, true, false, false], false, 0x000000, lsz, MetaVector.NOCOLOUR, false);
	}

	private drawComponent(idx:number):void
	{
		let comp = this.layout.components[idx];

		let box = comp.outline.clone();
		box.offsetBy(comp.boundary.x, comp.boundary.y);
		let bg = 0xF8F8F8;
		if (idx == this.activeIndex) bg = 0x8296E4;
		else if (idx == this.selectedIndex) bg = 0xA9BBFF;
		else if (idx == this.hoverIndex) bg = 0xE0E0E0;

		this.vg.drawRect(box.x, box.y, box.w, box.h, 0x808080, 1, bg);

			if (comp.molLayout)
			{
				let b1 = comp.boundary, b2 = comp.molBox;
				comp.molLayout.squeezeInto(b1.x + b2.x, b1.y + b2.y, b2.w, b2.h);
			}

		let molBox = new Box(comp.boundary.x + comp.molBox.x, comp.boundary.y + comp.molBox.y, comp.molBox.w, comp.molBox.h);
		let override = this.callbackDrawMolecule && this.callbackDrawMolecule(comp, this.vg, molBox);

		if (!override && comp.molLayout) new DrawMolecule(comp.molLayout, this.vg).draw();

		if (comp.nameLines.length > 0)
		{
			let x = box.x, cx = x + comp.nameBox.midX(), y = box.y + comp.nameBox.y;
			for (let line of comp.nameLines)
			{
				let wad = this.measure.measureText(line.text, comp.fontSize), h = wad[1] + 2 * wad[2];
				let override = this.callbackDrawNameLine && this.callbackDrawNameLine(comp, line, this.vg, new Box(x, y, box.w, h));
				if (!override) this.vg.drawText(cx, y, line.text, comp.fontSize, line.col, TextAlign.Centre | TextAlign.Top);
				y += h;
			}
		}

		if (comp.collapseBox)
		{
			let cbox = comp.collapseBox.clone();
			cbox.offsetBy(comp.boundary.x, comp.boundary.y);
			this.vg.drawRect(cbox.x, cbox.y, cbox.w, cbox.h, 0x808080, 1, 0xF8F8F8);
			let cx = cbox.midX(), cy = cbox.midY(), d = Math.min(cbox.w, cbox.h) * 0.4, sz = d * 0.2;
			this.vg.drawLine(cx - d, cy, cx + d, cy, 0x000000, sz);
			if (comp.isCollapsed) this.vg.drawLine(cx, cy - d, cx, cy + d, 0x000000, sz);
		}
	}
}

