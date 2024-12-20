/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Molecule} from 'webmolkit/data/Molecule';
import {Box, Size} from 'webmolkit/util/Geom';
import {ArrangeMolecule} from 'webmolkit/gfx/ArrangeMolecule';
import {ArrangeMeasurement} from 'webmolkit/gfx/ArrangeMeasurement';
import {RenderPolicy} from 'webmolkit/gfx/Rendering';
import {Vec} from 'webmolkit/util/Vec';
import {MoleculeStream} from 'webmolkit/data/MoleculeStream';
import {formatDouble} from 'webmolkit/util/util';
import {OntologyTree} from 'webmolkit/data/OntologyTree';
import {SquarePacking} from './SquarePacking';
import {FontData} from 'webmolkit/gfx/FontData';
import {MixfileComponent} from './Mixfile';
import {NormMixture} from './NormMixture';
import {Mixture} from './Mixture';

/*
	Arranging a Mixfile: will create a tree layout for all of the components, according to parameters.
*/

export enum ArrangeMixtureLineSource
{
	Name,
	Quantity,
	Identifier,
	Meta,
}

export interface ArrangeMixtureLine
{
	text:string;
	col:number;
	source:ArrangeMixtureLineSource;
}

export interface ArrangeMixtureComponent
{
	origin:number[];
	content:MixfileComponent;
	parentIdx:number;

	boundary?:Box; // outer boundary (position on canvas)

	mol?:Molecule;
	molLayout?:ArrangeMolecule;
	molBox?:Box;

	nameBox?:Box;
	nameLines?:ArrangeMixtureLine[];
	fontSize?:number;

	outline?:Box; // inner boundary (surrounds molecule, names, etc.)

	isCollapsed?:boolean;
	collapseBox?:Box;
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
	public limitStructW:number;
	public limitStructH:number;
	public minBoxSize:Size = null;
	public showCollapsors = false; // if true, boxes for [+]/[-] will be created for interactive use
	public collapsedBranches:number[][] = []; // any origin specified in this list will not display its children
	public packBranches:Size = null; // if defined, makes an effort to pack branches into the box size
	public hardwrapName:number; // name width guaranteed not longer than this
	public softwrapName:number; // name wrapping at selected characters kicks in after this width
	public includeIdentifiers = true; // if switched off, identifiers won't be included in text

	// --------------------- public methods ---------------------

	// sets up the object with the mandatory information
	constructor(public mixture:Mixture, public measure:ArrangeMeasurement, public policy:RenderPolicy)
	{
		this.scale = policy.data.pointScale;
		this.nameFontSize = 0.5 * this.scale;
		this.limitStructW = this.limitStructH = this.scale * 10;
		this.hardwrapName = 12 * this.scale;
		this.softwrapName = 8 * this.scale;
	}

	// carries out the arrangement
	public arrange():void
	{
		this.createComponents();
		this.layoutSubComponents(0);
		this.contractComponents();

		// normalize boundaries
		let outline:Box = null;
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
			comp.outline.scaleBy(modScale);
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
			if (val == null) return '';
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
		if (mixcomp.relation && mixcomp.relation != '=')
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
			quantity: note.concQuantity,
			error: note.concError,
			units: note.concUnits,
			relation: note.concRelation,
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
			let comp:ArrangeMixtureComponent = {origin: origin, content: mixcomp, parentIdx: idx};
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
		for (let [idx, comp] of this.components.entries())
		{
			let mixcomp = comp.content;

			// handle molecule, if any
			if (mixcomp.molfile) comp.mol = MoleculeStream.readUnknown(mixcomp.molfile);
			if (comp.mol)
			{
				comp.molLayout = new ArrangeMolecule(comp.mol, this.measure, this.policy);
				comp.molLayout.arrange();
				comp.molLayout.squeezeInto(0, 0, this.limitStructW, this.limitStructH);
				let bounds = comp.molLayout.determineBoundary();
				comp.molBox = new Box(padding, padding, Math.ceil(bounds[2] - bounds[0]), Math.ceil(bounds[3] - bounds[1]));
			}
			else comp.molBox = Box.zero();

			// handle name, or other content needing representation
			comp.nameLines = [];
			if (mixcomp.name) this.wrapSplitName(comp.nameLines, mixcomp.name, 0x000000, ArrangeMixtureLineSource.Name);

			// (... synonyms, and linewrapping ...)
			let qline = ArrangeMixture.formatQuantity(mixcomp);
			if (qline) comp.nameLines.push({text: qline, col: 0x000000, source: ArrangeMixtureLineSource.Quantity});

			qline = this.formatNormQuantity(comp.origin);
			if (qline) comp.nameLines.push({text: `(${qline})`, col: 0x808080, source: ArrangeMixtureLineSource.Quantity});

			if (this.includeIdentifiers && mixcomp.identifiers) for (let key in mixcomp.identifiers)
			{
				let line = key + ' ';
				let val = mixcomp.identifiers[key];
				if (val instanceof Array)
				{
					for (let n = 0; n < val.length; n++) line += (n == 0 ? '' : ', ') + val[n];
				}
				else line += val;
				comp.nameLines.push({text: this.truncateEllipsis(line), col: 0x42007E, source: ArrangeMixtureLineSource.Identifier});
			}
			if (mixcomp.metadata) for (let meta of mixcomp.metadata)
			{
				let metaString = (m:string | number):string =>
				{
					if (typeof m == 'number') return formatDouble(m, 4);
					if (!OntologyTree.main) return m;
					let branch = OntologyTree.main.getBranch(m);
					if (Vec.notBlank(branch)) return branch[0].label;
					return m;
				};
				let bits:string[] = [];
				if (Array.isArray(meta)) bits = meta.map((m) => metaString(m)); else bits = [metaString(meta as string | number)];
				comp.nameLines.push({text: bits.join(' '), col: 0x002B88, source: ArrangeMixtureLineSource.Meta});
			}

			comp.nameBox = new Box(padding, padding);
			comp.fontSize = this.nameFontSize;
			for (let n = 0; n < comp.nameLines.length; n++)
			{
				let wad = this.measure.measureText(comp.nameLines[n].text, comp.fontSize);
				comp.nameBox.w = Math.max(comp.nameBox.w, wad[0]);
				comp.nameBox.h += wad[1] + (n > 0 ? wad[2] * 2 : 0);
			}

			comp.outline = Box.zero();
			comp.outline.w = Math.max(comp.molBox.w, comp.nameBox.w) + 2 * padding;
			comp.outline.h = comp.molBox.h + comp.nameBox.h + 2 * padding;
			if (comp.molBox.notEmpty() && comp.nameBox.notEmpty())
			{
				comp.outline.h += padding;
				comp.nameBox.y += comp.molBox.h + padding;
				comp.molBox.w = comp.nameBox.w = Math.max(comp.molBox.w, comp.nameBox.w);
			}

			if (this.minBoxSize)
			{
				let minsz = this.minBoxSize;
				let dw = minsz.w - comp.outline.w, dh = minsz.h - comp.outline.h;
				if (dw > 0)
				{
					comp.outline.w += dw;
					comp.molBox.w += dw;
				}
				if (dh > 0)
				{
					comp.outline.h += dh;
					comp.molBox.h += dh;
					comp.nameBox.y += dh;
				}
			}

			comp.boundary = comp.outline.clone();

			if ((this.showCollapsors || comp.isCollapsed) && Vec.notBlank(comp.content.contents))
			{
				let gap = COLLAPSE_GAP * this.scale, wh = COLLAPSE_SIZE * this.scale;
				comp.collapseBox = new Box(comp.boundary.maxX() + gap, comp.boundary.midY() - 0.5 * wh, wh, wh);
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
		let branchBox:Box[] = [];

		let totalWidth = 0, totalHeight = 0;

		for (let n = idx + 1; n < this.components.length; n++)
		{
			let comp = this.components[n];
			if (comp.parentIdx != idx) continue;

			let branch = this.layoutSubComponents(n);
			if (branch.length == 0) continue;

			let box:Box = null;
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

		// special case: may try to pack the boxes into a smaller area rather than vertically on top of each other
		if (this.packBranches && branchBlock.length > 2 && totalHeight > this.packBranches.h)
		{
			let packSize = this.packBranches.clone();
			for (let box of branchBox) packSize.h = Math.max(packSize.h, box.h); // if a sub-box is bigger than overall, no need to limit it further

			let sq = new SquarePacking(packSize, branchBox, /*hspace*/ vspace, vspace);
			if (sq.pack())
			{
				let y = cbox.midY() - 0.5 * sq.outline.h;
				for (let n = 0; n < branchBlock.length; n++)
				{
					let box = sq.layout[n];
					let dx = x - branchBox[n].x + box.x, dy = y - branchBox[n].y + box.y;
					for (let i of branchBlock[n])
					{
						this.components[i].boundary.x += dx;
						this.components[i].boundary.y += dy;
					}
				}
				return wholeBranch;
			}
		}

		// !! note: not guaranteed that x is high enough to not interfere with other boxes; will need a post-check of some kind, maybe here,
		//    maybe further down the line

		let y = cbox.midY() - 0.5 * totalHeight;
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

	// component layout is done, but may be able to "reel in" some of the branches to make it smaller
	private contractComponents():void
	{
		let allChildren:number[][] = [];
		for (let n = 0; n < this.components.length; n++) 
		{
			allChildren.push([]);
			for (let idx = this.components[n].parentIdx; idx >= 0; idx = this.components[idx].parentIdx) allChildren[idx].push(n);
		}

		let hspace = HSPACE * this.scale, padding = PADDING * this.scale;

		while (true)
		{
			let anything = false;

			for (let n = 1; n < allChildren.length; n++)
			{
				let pidx = this.components[n].parentIdx;
				let boundX = this.components[pidx].boundary.maxX() + hspace;
				let dx = this.components[n].boundary.minX() - boundX; // how far to move to the left
				if (dx < 1) continue; // no room to contract

				let idxInside = [n, ...allChildren[n]];
				let idxOutside = Vec.identity0(allChildren.length).filter((idx) => !idxInside.includes(idx));

				for (let i of idxInside)
				{
					let box1 = this.components[i].boundary.withGrow(padding, padding);
					for (let j of idxOutside)
					{
						let box2 = this.components[j].boundary;
						if (box2.minX() > box1.maxX()) continue;
						if (box1.minY() > box2.maxY() || box1.maxY() < box2.minY()) continue;

						dx = Math.min(dx, box1.minX() - box2.maxX());
					}
				}

				if (dx > 1)
				{
					for (let n of idxInside) this.components[n].boundary.x -= dx;
					anything = true;
				}
			}

			if (!anything) break;
		}
	}

	// if the given string is longer than the soft/hard limit, looks to break it up into smaller pieces; each of them is
	// appended to the list parameter
	private wrapSplitName(list:ArrangeMixtureLine[], text:string, col:number, source:ArrangeMixtureLineSource):void
	{
		if (!text) return;
		let xpos = FontData.measureWidths(text, this.nameFontSize);
		if (Vec.last(xpos) <= this.softwrapName)
		{
			list.push({text, col, source});
			return;
		}

		let p = 0;
		for (; xpos[p] < this.softwrapName; p++) {}
		for (; xpos[p] < this.hardwrapName; p++)
		{
			let ch = text.charAt(p);
			if (' ,;-/'.includes(ch))
			{
				p++;
				break;
			}
		}

		list.push({text: text.substring(0, p).trim(), col, source});
		this.wrapSplitName(list, text.substring(p).trim(), col, source);
	}

	// if the line is longer than the hard wrap limit, just truncate with ellipsis
	private truncateEllipsis(txt:string):string
	{
		let xpos = FontData.measureWidths(txt, this.nameFontSize);
		if (Vec.last(xpos) <= this.hardwrapName) return txt;
		let ellipsis = '...', ellw = FontData.measureText(ellipsis, this.nameFontSize)[0];
		let keep = 1;
		for (; keep < txt.length; keep++) if (xpos[keep] + ellw > this.hardwrapName) break;
		return txt.substring(0, keep) + ellipsis;
	}
}

