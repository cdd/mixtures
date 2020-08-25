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
///<reference path='../../../WebMolKit/src/util/Geom.ts'/>

///<reference path='../data/Mixture.ts'/>
///<reference path='../data/NormMixture.ts'/>

namespace Mixtures /* BOF */ {

/*
	Arranging a Mixfile: will create a tree layout for all of the components, according to parameters.
*/

export interface ArrangeMixtureComponent
{
	origin:number[];
	content:MixfileComponent;
	parentIdx:number;

	boundary?:wmk.Box; // outer boundary (position on canvas)

	mol?:wmk.Molecule;
	molLayout?:wmk.ArrangeMolecule;
	molBox?:wmk.Box;

	nameBox?:wmk.Box;
	nameLines?:string[];
	fontSize?:number;
	
	outline?:wmk.Box; // inner boundary (surrounds molecule, names, etc.)

	isCollapsed?:boolean;
	collapseBox?:wmk.Box;
}

const PADDING = 0.25;
const VSPACE = 0.5;
const HSPACE = 1;
const COLLAPSE_SIZE = 0.3;
const COLLAPSE_GAP = 0.05;

export class ArrangeMixture
{
	public norm:NormMixture = null; // optional: contents may be used for additional decoration

	public scale:number;
	public nameFontSize:number;
	public width = 0;
	public height = 0;

	public components:ArrangeMixtureComponent[] = [];

	// parameters to influence the drawing
	public limitStructW = 0;
	public limitStructH = 0;
	public showCollapsors = false; // if true, boxes for [+]/[-] will be created for interactive use
	public collapsedBranches:number[][] = []; // any origin specified in this list will not display its children

	// --------------------- public methods ---------------------

	// sets up the object with the mandatory information
	constructor(public mixture:Mixture, public measure:wmk.ArrangeMeasurement, public policy:wmk.RenderPolicy)
	{
		this.scale = policy.data.pointScale;
		this.nameFontSize = 0.5 * policy.data.pointScale;
		this.limitStructW = this.limitStructH = this.scale * 10;
	}

	// carries out the arrangement
	public arrange():void
	{
		this.createComponents();
		this.layoutSubComponents(0);

		// normalize boundaries
		let outline:wmk.Box = null;
		for (let comp of this.components)
		{
			if (outline) outline = outline.union(comp.boundary); else outline = comp.boundary;
		}

		for (let comp of this.components)
		{
			comp.boundary.x -= outline.x;
			comp.boundary.y -= outline.y;

			if (comp.molLayout)
			{
				let b1 = comp.boundary, b2 = comp.molBox;
				comp.molLayout.squeezeInto(b1.x + b2.x, b1.y + b2.y, b2.w, b2.h);
			}
		}
		this.width = outline.w;
		this.height = outline.h;
	}

	// resize the whole thing
	public scaleComponents(modScale:number):void
	{
		if (modScale == 1) return;

		this.scale *= modScale;
		this.width *= modScale;
		this.height *= modScale;
		for (let comp of this.components)
		{
			comp.boundary.scaleBy(modScale);
			if (comp.molBox)
			{
				comp.molBox.scaleBy(modScale);
				if (comp.molLayout) 
				{
					let mx = comp.boundary.x + comp.molBox.x, my = comp.boundary.y + comp.molBox.y;
					comp.molLayout.squeezeInto(mx, my, comp.molBox.w, comp.molBox.h);
				}
			}
			if (comp.nameBox) comp.nameBox.scaleBy(modScale);
			if (comp.collapseBox) comp.collapseBox.scaleBy(modScale);
			comp.fontSize *= modScale;
		}
	}

	// returns the index of the indicated origin vector, or -1 if not present
	public findComponent(origin:number[]):number
	{
		for (let n = 0; n < this.components.length; n++) if (Vec.equals(this.components[n].origin, origin)) return n;
		return -1;
	}

	// turn quantity info into a readable string
	public static formatQuantity(mixcomp:MixfileComponent):string
	{
		let prec = (val:number):string =>
		{
			if (val > 10000) return Math.round(val).toString();
			let str = val.toPrecision(6);
			if (str.indexOf('e') >= 0 || str.indexOf('.') < 0) return str;
			while (true)
			{
				if (str.endsWith('0')) str = str.substring(0, str.length - 1);
				else if (str.endsWith('.')) {str = str.substring(0, str.length - 1); break;}
				else break;
			}
			return str;
		};

		if (mixcomp.ratio)
		{
			if (mixcomp.ratio.length == 2) return prec(mixcomp.ratio[0]) + '/' + prec(mixcomp.ratio[1]);
			return null; // invalid ratio
		}

		if (mixcomp.quantity == null) return null;

		let str = '';
		if (mixcomp.relation)
		{
			let rel = mixcomp.relation;
			if (rel == '>=') rel = '\u{2265}'; else if (rel == '<=') rel = '\u{2264}';
			str += rel /*+ ' '*/;
		}
		if (mixcomp.quantity instanceof Array)
		{
			if (mixcomp.quantity.length == 0) return;
			str += prec(mixcomp.quantity[0]);
			if (mixcomp.quantity.length >= 2) str += ' - ' + prec(mixcomp.quantity[1]);
		}
		else
		{
			str += prec(mixcomp.quantity); // is presumed to be scalar
			if (mixcomp.error)
			{
				// TODO: match the significant figures more carefully
				str += ' \u{00B1} ' + prec(mixcomp.error);
			}
		}

		if (mixcomp.units)
		{
			if (!mixcomp.units.startsWith('%')) str += ' ';
			str += mixcomp.units;
		}

		return str;
	}

	// if the component has a "standardised" quantity, format and return
	private formatNormQuantity(origin:number[]):string
	{
		if (!this.norm) return;
		let note = this.norm.findNote(origin);
		if (!note || !note.concQuantity) return;

		let comp:MixfileComponent =
		{
			'quantity': note.concQuantity,
			'error': note.concError,
			'units': note.concUnits,
			'relation': note.concRelation,
		};
		return ArrangeMixture.formatQuantity(comp);
	}

	// --------------------- private methods ---------------------

	// instantiate each component in the diagram (which includes pluses and arrows)
	private createComponents():void
	{
		// assemble the components into a flat hierarchy
		let examineBranch = (origin:number[], mixcomp:MixfileComponent, idx:number):void =>
		{
			let comp:ArrangeMixtureComponent = {'origin': origin, 'content': mixcomp, 'parentIdx': idx};
			let parentIdx = this.components.push(comp) - 1;

			// see if it's been indicated as collapsed
			comp.isCollapsed = false;
			for (let origin of this.collapsedBranches) if (Vec.equals(origin, comp.origin)) comp.isCollapsed = true;

			if (mixcomp.contents && !comp.isCollapsed) for (let n = 0; n < mixcomp.contents.length; n++)
			{
				let subOrigin = Vec.append(origin, n);
				examineBranch(subOrigin, mixcomp.contents[n], parentIdx);
			}
		};
		examineBranch([], this.mixture.mixfile, -1);

		let padding = PADDING * this.scale;

		// do the sizing for each component
		for (let comp of this.components)
		{
			let mixcomp = comp.content;

			// handle molecule, if any
			if (mixcomp.molfile) comp.mol = wmk.MoleculeStream.readUnknown(mixcomp.molfile);
			if (comp.mol)
			{
				comp.molLayout = new wmk.ArrangeMolecule(comp.mol, this.measure, this.policy);
				comp.molLayout.arrange();
				comp.molLayout.squeezeInto(0, 0, this.limitStructW, this.limitStructH);
				let bounds = comp.molLayout.determineBoundary();
				comp.molBox = new wmk.Box(padding, padding, Math.ceil(bounds[2] - bounds[0]), Math.ceil(bounds[3] - bounds[1]));
			}
			else comp.molBox = wmk.Box.zero();

			// handle name, or other content needing representation
			comp.nameLines = [];
			if (mixcomp.name) comp.nameLines.push(mixcomp.name);
			// (... synonyms, and linewrapping ...)
			let qline = ArrangeMixture.formatQuantity(mixcomp);
			if (qline) comp.nameLines.push(qline);

			qline = this.formatNormQuantity(comp.origin);
			if (qline) comp.nameLines.push(`(${qline})`);

			if (mixcomp.identifiers) for (let key in mixcomp.identifiers)
			{
				let line = key + ' ';
				let val = mixcomp.identifiers[key];
				if (val instanceof Array)
				{
					for (let n = 0; n < val.length; n++) line += (n == 0 ? '' : ', ') + val[n];
				}
				else line += val;
				comp.nameLines.push(line);
			}

			comp.nameBox = new wmk.Box(padding, padding);
			comp.fontSize = this.nameFontSize;
			for (let n = 0; n < comp.nameLines.length; n++)
			{
				let wad = this.measure.measureText(comp.nameLines[n], comp.fontSize);
				comp.nameBox.w = Math.max(comp.nameBox.w, wad[0]);
				comp.nameBox.h += wad[1] + (n > 0 ? wad[2] * 2 : 0);
			}

			comp.outline = wmk.Box.zero();
			comp.outline.w = Math.max(comp.molBox.w, comp.nameBox.w) + 2 * padding;
			comp.outline.h = comp.molBox.h + comp.nameBox.h + 2 * padding;
			if (comp.molBox.notEmpty() && comp.nameBox.notEmpty())
			{
				comp.outline.h += padding;
				comp.nameBox.y += comp.molBox.h + padding;
				comp.molBox.w = comp.nameBox.w = Math.max(comp.molBox.w, comp.nameBox.w);
			}

			comp.boundary = comp.outline.clone();

			if ((this.showCollapsors || comp.isCollapsed) && Vec.notBlank(comp.content.contents))
			{
				let gap = COLLAPSE_GAP * this.scale, wh = COLLAPSE_SIZE * this.scale;
				comp.collapseBox = new wmk.Box(comp.boundary.maxX() + gap, comp.boundary.midY() - 0.5 * wh, wh, wh);
				comp.boundary.w += gap + wh;
			}
		}
	}

	// arranges all of the subcomponents for a given index, positioning them relative to the current position; returns the indices of
	// the entire branch, for subsequent touchup
	private layoutSubComponents(idx:number):number[]
	{
		let wholeBranch:number[] = [idx];
		let branchBlock:number[][] = [];
		let branchBox:wmk.Box[] = [];

		let totalWidth = 0, totalHeight = 0;

		for (let n = idx + 1; n < this.components.length; n++)
		{
			let comp = this.components[n];
			if (comp.parentIdx != idx) continue;

			let branch = this.layoutSubComponents(n);
			if (branch.length == 0) continue;

			let box:wmk.Box = null;
			for (let i of branch)
			{
				wholeBranch.push(i);
				let bound = this.components[i].boundary;
				if (box) box = box.union(bound); else box = bound;
			}

			branchBlock.push(branch);
			branchBox.push(box);

			totalWidth = Math.max(totalWidth, box.w);
			totalHeight += box.h;
		}
		if (branchBlock.length == 0) return wholeBranch;

		let hspace = HSPACE * this.scale, vspace = VSPACE * this.scale;

		totalHeight += vspace * (branchBlock.length - 1);

		let cbox = this.components[idx].boundary;
		let x = cbox.maxX() + hspace;
		let y = cbox.midY() - 0.5 * totalHeight;
		// !! note: not guaranteed that x is high enough to not interfere with other boxes; will need a post-check of some kind, maybe here,
		//    maybe further down the line

		for (let n = 0; n < branchBlock.length; n++)
		{
			let dx = x - branchBox[n].x, dy = y - branchBox[n].y;
			for (let i of branchBlock[n])
			{
				this.components[i].boundary.x += dx;
				this.components[i].boundary.y += dy;
			}
			y += branchBox[n].h + vspace;
		}

		return wholeBranch;
	}
}

/* EOF */ }