/*
    Mixfile Editor & Viewing Libraries

    (c) 2017 Collaborative Drug Discovery, Inc

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

/*
	Arranging a Mixfile: will create a tree layout for all of the components, according to parameters. 
*/

class ArrangeMixtureComponent
{
	public boundary:Box; // outer boundary (position on canvas)

	public mol:Molecule;
	public molLayout:ArrangeMolecule;
	public molBox:Box;

	public nameBox:Box;
	public nameLines:string[];
	public fontSize:number;

	constructor(public origin:number[], public content:MixfileComponent, public parentIdx:number)
	{
	}
}

class ArrangeMixture
{
	public scale:number;
	public width = 0;
	public height = 0;

	public components:ArrangeMixtureComponent[] = [];

	// parameters to influence the drawing
	public limitStructW = 0;
	public limitStructH = 0;
	// ... other stuff...

	private PADDING = 0.25;
	private VSPACE = 0.5;
	private HSPACE = 1;

	// --------------------- public methods ---------------------

	// sets up the object with the mandatory information
	constructor(public mixture:Mixture, public measure:ArrangeMeasurement, public policy:RenderPolicy)
	{
		this.scale = policy.data.pointScale;
		this.limitStructW = this.limitStructH = this.scale * 10;
	}

	// carries out the arrangement
	public arrange():void
	{
		this.createComponents();

		//console.log('COMPONENTS:'+this.components.length);
		//for (let comp of this.components) console.log('BOX:'+JSON.stringify(comp.boundary)+"/"+JSON.stringify(comp.molBox));

		this.layoutSubComponents(0);

		//console.log('POSITIONS:');
		//for (let comp of this.components) console.log('BOX:'+JSON.stringify(comp.boundary));

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
	/*public scaleComponents(modScale:number):void
	{
		if (modScale == 1) return;

		this.scale *= modScale;
		this.width *= modScale;
		this.height *= modScale;
		for (let xc of this.components)
		{
			xc.box.scaleBy(modScale);
			xc.fszText *= modScale;
			xc.fszLeft *= modScale;
			xc.padding *= modScale;
		}
	}*/
		
	// --------------------- private methods ---------------------

	// instantiate each component in the diagram (which includes pluses and arrows)
	private createComponents():void
	{
		// assemble the components into a flat hierarchy
		let examineBranch = (origin:number[], mixcomp:MixfileComponent, idx:number):void =>
		{
			let comp = new ArrangeMixtureComponent(origin, mixcomp, idx);
			let parentIdx = this.components.push(comp) - 1;
			//if (mixcomp.contents) for (let subComp of mixcomp.contents) examineBranch(subComp, parentIdx);
			if (mixcomp.contents) for (let n = 0; n < mixcomp.contents.length; n++)
			{
				let subOrigin = Vec.append(origin, n);
				examineBranch(subOrigin, mixcomp.contents[n], parentIdx);
			}
		};
		examineBranch([], this.mixture.mixfile, -1);

		let padding = this.PADDING * this.scale;

		// do the sizing for each component
		for (let comp of this.components)
		{
			let mixcomp = comp.content;

			// handle molecule, if any
			if (mixcomp.molfile) comp.mol = MoleculeStream.readMDLMOL(mixcomp.molfile);
			if (comp.mol)
			{
				comp.molLayout = new ArrangeMolecule(comp.mol, this.measure, this.policy);
				comp.molLayout.arrange();
				let bounds = comp.molLayout.determineBoundary();
				// !! check limiting size
				comp.molBox = new Box(padding, padding, Math.ceil(bounds[2] - bounds[0]), Math.ceil(bounds[3] - bounds[1]));
			}
			else comp.molBox = Box.zero();

			// handle name, or other content needing representation
			comp.nameLines = [];
			if (mixcomp.name) comp.nameLines.push(mixcomp.name);
			// (... synonyms, and linewrapping ...)
			let qline = this.formatQuantity(mixcomp);
			if (qline) comp.nameLines.push(qline);
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

			comp.nameBox = new Box(padding, padding);
			comp.fontSize = 0.5 * this.scale;
			for (let n = 0; n < comp.nameLines.length; n++)
			{
				let wad = this.measure.measureText(comp.nameLines[n], comp.fontSize);
				comp.nameBox.w = Math.max(comp.nameBox.w, wad[0]);
				comp.nameBox.h += wad[1] + (n > 0 ? wad[2] * 2 : 0);
			}
			
			comp.boundary = Box.zero();
			comp.boundary.w = Math.max(comp.molBox.w, comp.nameBox.w) + 2 * padding;
			comp.boundary.h = comp.molBox.h + comp.nameBox.h + 2 * padding;
			if (comp.molBox.notEmpty() && comp.nameBox.notEmpty()) 
			{
				comp.boundary.h += padding;
				comp.nameBox.y += comp.molBox.h + padding;
				comp.molBox.w = comp.nameBox.w = Math.max(comp.molBox.w, comp.nameBox.w);
			}
		}
	}

	// arranges all of the subcomponents for a given index, positioning them relative to the current position; returns the indices of
	// the entire branch, for subsequent touchup
	private layoutSubComponents(idx:number):number[]
	{
		let wholeBranch:number[] = [idx];
		let branchSet:number[][] = [];
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

			branchSet.push(branch);
			branchBox.push(box);

			totalWidth = Math.max(totalWidth, box.w);
			totalHeight += box.h;
		}
		if (branchSet.length == 0) return wholeBranch;

		let hspace = this.HSPACE * this.scale, vspace = this.VSPACE * this.scale;

		totalHeight += vspace * (branchSet.length - 1);

		let cbox = this.components[idx].boundary;
		let x = cbox.maxX() + hspace;
		let y = cbox.midY() - 0.5 * totalHeight;
		// !! note: not guaranteed that x is high enough to not interfere with other boxes; will need a post-check of some kind, maybe here,
		//    maybe further down the line

		for (let n = 0; n < branchSet.length; n++)
		{
			let dx = x - branchBox[n].x, dy = y - branchBox[n].y;
			for (let i of branchSet[n])
			{
				this.components[i].boundary.x += dx;
				this.components[i].boundary.y += dy;
			}
			y += branchBox[n].h + vspace;
		}

		return wholeBranch;
	}

	// turn quantity info into a readable string
	private formatQuantity(mixcomp:MixfileComponent):string
	{
		if (mixcomp.ratio)
		{
			if (mixcomp.ratio.length == 2) return mixcomp.ratio[0] + '/' + mixcomp.ratio[1];
			return null; // invalid ratio
		}

		if (mixcomp.quantity == null) return null;

		let str = '';
		if (mixcomp.relation) str += mixcomp.relation + ' ';
		if (mixcomp.quantity instanceof Array)
		{
			if (mixcomp.quantity.length == 0) return;
			str += mixcomp.quantity[0];
			if (mixcomp.quantity.length >= 2) str += ' - ' + mixcomp.quantity[1];
		}
		else str += mixcomp.quantity; // is presumed to be scalar

		if (mixcomp.units) str += ' ' + mixcomp.units;

		return str;
	}
}
