/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

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

/*			comp.nameBox = new Box(padding, padding);
			comp.fontSize = 0.5 * this.scale;
			for (let line of comp.nameLines)
			{
				let wad = this.measure.measureText(line, comp.fontSize);
				comp.nameBox.w = Math.max(comp.nameBox.w, wad[0]);
				comp.nameBox.h += wad[1] + wad[2];
			}*/		
	}

	/*private drawComponent(xc:ArrangeComponent):void
    {
		let vg = this.vg, policy = this.policy;
		let bx = xc.box.x + xc.padding, by = xc.box.y + xc.padding;
		let bw = xc.box.w - 2 * xc.padding, bh = xc.box.h - 2 * xc.padding;

		//vg.drawRect(bx,by,bw,bh,0x000000,1,NOCOLOUR);

		if (xc.text)
		{
			let wad = this.measure.measureText(xc.text, xc.fszText);
			vg.drawText(bx + 0.5 * bw, by + bh, xc.text, xc.fszText, policy.data.foreground, TextAlign.Bottom | TextAlign.Centre);
			bh -= wad[1] + wad[2];
		}

		if (xc.leftNumer)
		{
			let wad1 = this.measure.measureText(xc.leftNumer, xc.fszLeft);
			if (xc.leftDenom)
			{
				vg.drawText(bx, by + 0.5 * bh, xc.leftNumer, xc.fszLeft, policy.data.foreground, TextAlign.Left | TextAlign.Middle);
				let useW = wad1[0] + ArrangeExperiment.COMP_GAP_LEFT * (wad1[1] + wad1[2]);
				bx += useW;
				bw -= useW;
			}
			else
			{
				let wad2 = this.measure.measureText(xc.leftDenom, xc.fszLeft);
				let tw = Math.max(wad1[0], wad2[0]);
				let x = bx + 0.5 * tw, y = by + 0.5 * bh;
				vg.drawText(x, y, xc.leftNumer, xc.fszLeft, policy.data.foreground, TextAlign.Centre | TextAlign.Bottom);
				vg.drawText(x, y + wad1[2], xc.leftDenom, xc.fszLeft, policy.data.foreground, TextAlign.Centre | TextAlign.Top);
				vg.drawLine(bx, y, bx + tw, y, policy.data.foreground, this.scale * 0.03);
				let useW = tw + ArrangeExperiment.COMP_GAP_LEFT * (wad1[1] + wad1[2]);
				bx += useW;
				bw -= useW;
			}
    	}
		if (xc.annot != 0)
		{
			let aw = ArrangeExperiment.COMP_ANNOT_SIZE * this.scale;
			bw -= aw;
			this.drawAnnotation(xc.annot, bx + bw, by, aw, bh);
		}

		if (MolUtil.notBlank(xc.mol))
		{
			let arrmol = new ArrangeMolecule(xc.mol, this.layout.measure, policy, new RenderEffects());
			arrmol.arrange();
			arrmol.squeezeInto(bx, by, bw, bh, 0);

			let drawmol = new DrawMolecule(arrmol,vg);
			drawmol.draw();
		}

		if (xc.srcIdx < 0)
		{
			let fsz = 0.5 * bh;
			vg.drawText(bx + 0.5 * bw, by + 0.5 * bh, '?', fsz, policy.data.foreground, TextAlign.Centre | TextAlign.Middle);
		}
    }
    private drawSymbolArrow(xc:ArrangeComponent):void
    {
		let bx = xc.box.x + xc.padding, by = xc.box.y + xc.padding;
		let bw = xc.box.w - 2 * xc.padding, bh = xc.box.h - 2 * xc.padding;

		if (bw > bh) 
			this.drawArrow(bx, by + 0.5 * bh, bx + bw, by + 0.5 * bh, bh, this.policy.data.foreground, this.scale * 0.05);
		else
			this.drawArrow(bx + 0.5 * bw, by, bx + 0.5 * bw, by + bh, bw, this.policy.data.foreground, this.scale * 0.05);
    }	
	private drawSymbolPlus(xc:ArrangeComponent):void
    {
		let vg = this.vg, policy = this.policy;
		let x1 = xc.box.x + xc.padding, y1 = xc.box.y + xc.padding;
		let x3 = x1 + xc.box.w - 2 * xc.padding, y3 = y1 + xc.box.h - 2 * xc.padding;
		let x2 = 0.5 * (x1 + x3), y2 = 0.5 * (y1 + y3);
		let lw = 0.2 * 0.5 * (x3 - x1 + y3 - y1);

		vg.drawLine(x1, y2, x3, y2, policy.data.foreground, lw);
		vg.drawLine(x2, y1, x2, y3, policy.data.foreground, lw);
    }
	private drawAnnotation(annot:number, bx:number, by:number, bw:number, bh:number):void
	{
		let vg = this.vg, policy = this.policy;
		let sz = bw, x2 = bx + bw, y2 = by + bh, x1 = x2 - sz, y1 = by;
		if (annot == ArrangeExperiment.COMP_ANNOT_PRIMARY) y2 = y1 + sz;
		else if (annot == ArrangeExperiment.COMP_ANNOT_WASTE) y1 = y2 - sz;
    	
    	//vg.drawRect(x1,y1,x2-x1,y2-y1,0x000000,1,NOCOLOUR);
    	
		if (annot == ArrangeExperiment.COMP_ANNOT_PRIMARY)
		{
			let cx = 0.5 * (x1 + x2), cy = 0.5 * (y1 + y2), ext = 0.25 * sz;
			let px = [cx, cx + 0.866 * ext, cx + 0.866 * ext, cx, cx - 0.866 * ext, cx - 0.866 * ext];
			let py = [cy - ext, cy - 0.5 * ext, cy + 0.5 * ext, cy + ext, cy + 0.5 * ext, cy - 0.5 * ext];
			let lw = 0.05 * this.scale;
			vg.drawLine(px[0], py[0], px[3], py[3], policy.data.foreground, lw);
			vg.drawLine(px[1], py[1], px[4], py[4], policy.data.foreground, lw);
			vg.drawLine(px[2], py[2], px[5], py[5], policy.data.foreground, lw);
			let inset = 0.1 * sz;
			vg.drawOval(x1 + 0.5 * sz, y1 + 0.5 * sz, 0.5 * sz - inset, 0.5 * sz - inset, policy.data.foreground, lw, MetaVector.NOCOLOUR);
		}
		else if (annot == ArrangeExperiment.COMP_ANNOT_WASTE)
		{
			let cx = x1 + 0.7 * sz, cy = 0.5 * (y1 + y2), quart = 0.25 * sz;
			let lw = 0.05 * this.scale;

			let px = [x1 + 0.1 * sz, cx - quart, cx, cx, cx];
			let py = [y1, y1, y1, cy - quart, cy];
			let ctrl = [false, false, true, false, false];
			vg.drawPath(px, py, ctrl, false, policy.data.foreground, lw, MetaVector.NOCOLOUR, false);

			for (let n = 0; n < 4; n++)
			{
				let y = cy + n * 0.45 * sz * (1.0 / 3), dw = (3.1 - n) * 0.1 * sz;
				vg.drawLine(cx - dw, y, cx + dw, y, policy.data.foreground, lw);
			}
		}
		else if (annot == ArrangeExperiment.COMP_ANNOT_IMPLIED)
		{
			let tw = 0.5 * sz, th = 0.75 * sz;
			let cx = x2 - 0.5 * tw, cy = y1 + 0.5 * th;
			let ty = y1 + 0.25 * th, dsz = sz * 0.1, hsz = 0.5 * dsz;
			let lw = 0.05 * this.scale, fg = policy.data.foreground;
			
			vg.drawLine(cx, y1, cx, y1 + th, fg, lw);
			vg.drawLine(x2 - tw, ty, x2, ty, fg, lw);
			vg.drawLine(x2 - tw, cy, x2, cy, fg, lw);
			vg.drawOval(x2 - tw + hsz, y1 + th - hsz, hsz, hsz, 0, 0, fg);
			vg.drawOval(x2 - hsz, y1 + th - hsz, hsz, hsz, 0, 0, fg);
		}
    }

	private drawArrow(x1:number, y1:number, x2:number, y2:number, headsz:number, colour:number, linesz:number):void
	{
		let dx = x2 - x1, dy = y2 - y1, invD = invZ(norm_xy(dx, dy));
		dx *= invD;
		dy *= invD;
		let ox = dy, oy = -dx;
		let hx = x2 - dx * headsz, hy = y2 - dy * headsz;
		let px = 
		[
			x1 + ox * 0.5 * linesz,
			hx + ox * 0.5 * linesz,
     		hx + ox * 0.5 * headsz,
     		x2,
     		hx - ox * 0.5 * headsz,
     		hx - ox * 0.5 * linesz,
			x1 - ox * 0.5 * linesz
		];
		let py = 
		[
			y1 + oy * 0.5 * linesz,
			hy + oy * 0.5 * linesz,
     		hy + oy * 0.5 * headsz,
     		y2,
     		hy - oy * 0.5 * headsz,
     		hy - oy * 0.5 * linesz,
			y1 - oy * 0.5 * linesz
		];
		this.vg.drawPoly(px, py, MetaVector.NOCOLOUR, 0, colour, true);
	}*/
}

/* EOF */ }