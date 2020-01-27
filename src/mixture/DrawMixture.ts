/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/CoordUtil.ts'/>
///<reference path='../../../WebMolKit/src/data/QuantityCalc.ts'/>
///<reference path='../../../WebMolKit/src/gfx/Rendering.ts'/>
///<reference path='../../../WebMolKit/src/gfx/ArrangeMeasurement.ts'/>
///<reference path='../../../WebMolKit/src/gfx/FontData.ts'/>
///<reference path='../../../WebMolKit/src/gfx/MetaVector.ts'/>
///<reference path='../../../WebMolKit/src/util/Geom.ts'/>

namespace Mixtures /* BOF */ {

/*
	Drawing a Mixfile, which has been rendered.
*/

export class DrawMixture
{
	public hoverIndex = -1; // component to give a faint tinting to (for hover-over effect)
	public activeIndex = -1; // component that is actively engaged with UI
	public selectedIndex = -1; // component that is passively selected

	private measure:wmk.ArrangeMeasurement;
	private policy:wmk.RenderPolicy;

	private scale:number;
	private invScale:number;

	// --------------------- public methods ---------------------

	constructor(private layout:ArrangeMixture, private vg:wmk.MetaVector)
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
		let xm = 0.5 * (x1 + x2), ym = 0.5 * (y1 + y2), d = 4, xd = d, yd = y1 < y2 - 1 ? -d : y1 > y2 + 1 ? d : 0;

		let px = [x1, xm - xd, xm, xm, xm, xm, xm + xd, x2];
		let py = [y1, y1, y1, y1 - yd, y2 + yd, y2, y2, y2];
		let lsz = this.scale * 0.1;
		this.vg.drawPath(px, py, [false, false, true, false, false, true, false, false], false, 0x000000, lsz, wmk.MetaVector.NOCOLOUR, false);
	}

	private drawComponent(idx:number):void
	{
		let comp = this.layout.components[idx];

		let box = comp.boundary;
		let bg = 0xF8F8F8;
		if (idx == this.activeIndex) bg = 0x8296E4;
		else if (idx == this.selectedIndex) bg = 0xA9BBFF;
		else if (idx == this.hoverIndex) bg = 0xE0E0E0;

		this.vg.drawRect(box.x, box.y, box.w, box.h, 0x808080, 1, bg);

		if (comp.molLayout) new wmk.DrawMolecule(comp.molLayout, this.vg).draw();

		if (comp.nameLines.length > 0)
		{
			let x = box.x + comp.nameBox.midX(), y = box.y + comp.nameBox.y;
			for (let line of comp.nameLines)
			{
				let wad = this.measure.measureText(line, comp.fontSize);
				this.vg.drawText(x, y, line, comp.fontSize, 0x000000, wmk.TextAlign.Centre | wmk.TextAlign.Top);
				y += wad[1] + 2 * wad[2];
			}
		}
	}
}

/* EOF */ }