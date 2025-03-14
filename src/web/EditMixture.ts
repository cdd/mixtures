/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2025 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Widget} from 'webmolkit/ui/Widget';
import {RenderPolicy} from 'webmolkit/gfx/Rendering';
import {ClipboardProxy} from 'webmolkit/ui/ClipboardProxy';
import {MenuProxy} from 'webmolkit/ui/MenuProxy';
import {deepClone, eventCoords, newElement, pixelDensity} from 'webmolkit/util/util';
import {EditCompound} from 'webmolkit/dialog/EditCompound';
import {Vec} from 'webmolkit/util/Vec';
import {MoleculeStream} from 'webmolkit/io/MoleculeStream';
import {Molecule} from 'webmolkit/mol/Molecule';
import {EditComponent} from './EditComponent';
import {MDLMOLWriter} from 'webmolkit/io/MDLWriter';
import {MolUtil} from 'webmolkit/mol/MolUtil';
import {Box, Size} from 'webmolkit/util/Geom';
import {OutlineMeasurement} from 'webmolkit/gfx/ArrangeMeasurement';
import {MetaVector} from 'webmolkit/gfx/MetaVector';
import {CoordUtil} from 'webmolkit/mol/CoordUtil';
import {Mixture} from '../mixture/Mixture';
import {ArrangeMixture} from '../mixture/ArrangeMixture';
import {MixfileComponent} from '../mixture/Mixfile';
import {LookupCompoundDialog} from '../electron/LookupCompoundDialog';
import {InChIDelegate} from '../mixture/InChIDelegate';
import {ExtractCTABComponent} from '../mixture/ExtractCTABComponent';
import {NormMixture} from '../mixture/NormMixture';
import {DrawMixture} from '../mixture/DrawMixture';

/*
	High level widget for the editing area for a mixture.
*/

const DEFAULT_SCALE = 25;
const UNDO_SIZE = 10;

enum DragReason
{
	None,
	Any,
	Pan,
}

export class EditMixture extends Widget
{
	public callbackUpdateTitle:() => void = null;
	public callbackInteraction:() => void = null;

	public monochrome = false;

	protected mixture = new Mixture();
	protected policy:RenderPolicy = null
	protected canvasMixture:HTMLCanvasElement;
	protected canvasOver:HTMLCanvasElement;

	protected undoStack:Mixture[] = [];
	protected redoStack:Mixture[] = [];

	protected offsetX = 0;
	protected offsetY = 0;
	protected pointScale = DEFAULT_SCALE;
	protected filthy = true; // filthy: screen is out of date, needs to be redrawn
	protected dirty = false; // dirty: data has changed since last save
	protected layout:ArrangeMixture = null;
	protected collapsedBranches:number[][] = [];
	protected hoverIndex = -1; // component over which the mouse is hovering
	protected activeIndex = -1; // component that is currently being clicked upon
	protected selectedIndex = 0; // selected component (having been previously clicked)
	protected delayedSelect:number[] = null; // if set to an origin vector: to rederive selectedIndex next time the layout is evaluated

	protected dragReason = DragReason.None;
	protected dragIndex = -1;
	protected dragX = 0;
	protected dragY = 0;
	protected isEditing = false;
	protected dlgCompound:EditCompound = null;

	protected structureIntegrity:Record<string, string> = {}; // metadata key -> name for those which are sensitive to changes to structure

	// ------------ public methods ------------

	constructor(protected inchi:InChIDelegate, protected proxyClip:ClipboardProxy, protected proxyMenu:MenuProxy)
	{
		super();
	}

	public render(parent:any):void
	{
		super.render(parent);

		let content = this.contentDOM;

		content.css({'width': '100%', 'height': '100%'});
		content.css({'background-color': '#F0F0F0'});
		content.css({'position': 'relative', 'outline-width': '0'});

		let canvasStyle = 'position: absolute; left: 0; top: 0; pointer-events: none;';
		this.canvasMixture = newElement(content, 'canvas', {style: canvasStyle}) as HTMLCanvasElement;
		this.canvasOver = newElement(content, 'canvas', {style: canvasStyle}) as HTMLCanvasElement;

		//content.onResize(() => this.redraw());

		// setup all the interactive events
		content.onClick((event) => this.mouseClick(event));
		content.onDblClick((event) => this.mouseDoubleClick(event));
		content.onMouseDown((event) => this.mouseDown(event));
		content.onMouseUp((event) => this.mouseUp(event));
		content.onMouseOver((event) => this.mouseOver(event));
		content.onMouseLeave((event) => this.mouseOut(event));
		content.onMouseMove((event) => this.mouseMove(event));
		// (maybe have mousewheel as an option: in Electron mode it makes some sense, but embedded
		// on a web page it' not good...)
		//content.on('mousewheel', (event:JQueryEventObject) => this.mouseWheel(event));
		content.onKeyPress((event) => this.keyPressed(event));
		content.onKeyDown((event) => this.keyDown(event));
		content.onKeyUp((event) => this.keyUp(event));
		content.onContextMenu((event) => this.contextMenu(event));

		content.attr({'id': 'mixtureEditor_main', 'tabindex': '0'});
		this.refocus();
		this.redraw(true, false);
	}

	// whether or not menu commands are being received; no means that it's in dialog/editing mode
	public isReceivingCommands():boolean {return !this.isEditing;}
	public setEditing(isEditing:boolean):void {this.isEditing = isEditing;}
	public compoundEditor():EditCompound {return this.dlgCompound;}

	// add a metadata key that can potentially stop being valid when the structure is changed
	public addStructureIntegrityKey(key:string, description:string):void
	{
		this.structureIntegrity[key] = description;
	}

	// access to current state
	public getMixture():Mixture {return this.mixture;}
	public setMixture(mixture:Mixture, withAutoScale:boolean = false, withStashUndo:boolean = true):void
	{
		// NOTE: the "withAutoScale" parameter is currently not very meaningful since the modified mixture gets a re-layout
		withAutoScale = true;

		if (this.delayedSelect == null && this.selectedIndex >= 0 && this.layout != null) this.delayedSelect = this.layout.components[this.selectedIndex].origin;

		if (withStashUndo) this.stashUndo();
		this.mixture = mixture;

		this.offsetX = 0;
		this.offsetY = 0;
		this.pointScale = this.policy.data.pointScale;
		this.filthy = true;
		this.layout = null;
		this.hoverIndex = -1;
		this.activeIndex = -1;
		this.selectedIndex = -1;
		this.redraw(withAutoScale);

		this.dirty = true;
		if (this.callbackUpdateTitle) this.callbackUpdateTitle();
	}

	// returns the selected origin indices & component, or null if nothing selected
	public getSelected():[number[], MixfileComponent]
	{
		if (this.selectedIndex < 0 || this.layout == null) return [null, null];
		let comp = this.layout.components[this.selectedIndex];
		return [comp.origin, comp.content];
	}

	public getCollapsedBranches():number[][] {return this.collapsedBranches;}

	// wipes the undo & redo stacks
	public clearHistory():void
	{
		this.undoStack = [];
		this.redoStack = [];
	}

	// appends the current state to the undo-stack
	public stashUndo():void
	{
		//if (this.undoStack.length == 0 && this.mixture.isEmpty()) return; // don't put empty stuff at the beginning
		this.undoStack.push(this.mixture.clone());
		while (this.undoStack.length > UNDO_SIZE) this.undoStack.splice(0, 1);
		this.redoStack = [];
	}

	// reports on the state of the undo/redo buffers
	public canUndo():boolean {return this.undoStack.length > 0;}
	public canRedo():boolean {return this.redoStack.length > 0;}

	// actually does the undo/redo operation
	public performUndo():void
	{
		if (this.undoStack.length == 0) return;
		this.redoStack.push(this.mixture.clone());
		this.setMixture(this.undoStack.pop(), false, false);
	}
	public performRedo():void
	{
		if (this.redoStack.length == 0) return;
		this.undoStack.push(this.mixture.clone());
		this.setMixture(this.redoStack.pop(), false, false);
	}

	// need-save status
	public isDirty():boolean {return this.dirty;}
	public setDirty(dirty:boolean):void {this.dirty = dirty;}

	// returns true if the mixture content is empty
	public isBlank():boolean {return this.mixture.isEmpty();}

	// makes sure the content gets redrawn imminently; calling many times is not a performance issue
	public delayedRedraw():void
	{
		this.filthy = true;
		window.setTimeout(() => {if (this.filthy) this.redraw();}, 10);
	}

	// alter zoom level by a factor
	public zoom(scale:number):void
	{
		this.pointScale *= scale;
		this.layout = null;
		this.redraw();
	}

	// rescale to fit & recentre
	public zoomFull():void
	{
		this.layout = null;
		this.pointScale = DEFAULT_SCALE;
		this.redraw(true, true);
	}

	// rescale to fit & recentre/with a limit to the size
	public zoomNormal():void
	{
		this.layout = null;
		this.pointScale = DEFAULT_SCALE;
		this.redraw(true, false);
	}

	// select the given component index (programmatically)
	public selectComponent(idx:number):void
	{
		if (this.selectedIndex == idx) return;
		this.selectedIndex = idx;
		this.activeIndex = -1;
		this.delayedRedraw();
	}

	// convenient overload for selecting whichever numbered component matches the origin sequence
	public selectOrigin(origin:number[]):void
	{
		let complist = this.layout.components;
		for (let n = 0; n < complist.length; n++) if (Vec.equals(complist[n].origin, origin))
		{
			this.selectComponent(n);
			return;
		}
	}

	// bring up the structure-editing panel, which uses the generic sketching dialog
	public editStructure():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);

		let mol = comp.molfile ? MoleculeStream.readUnknown(comp.molfile) : null;

		this.dlgCompound = new EditCompound(mol ? mol : new Molecule(), this.contentDOM);
		this.dlgCompound.onSave(() =>
		{
			let mol = this.dlgCompound.getMolecule();
			comp = deepClone(comp);
			this.checkStructureIntegrity(comp, mol);

			let molfile = MoleculeStream.writeMDLMOL(mol);
			if (!molfile) molfile = null;

			comp.molfile = molfile;
			let modmix = this.mixture.clone();
			if (modmix.setComponent(origin, comp))
			{
				this.setMixture(modmix);
				this.selectOrigin(origin);
			}

			this.dlgCompound.close();
		});
		this.dlgCompound.onClose(() =>
		{
			this.isEditing = false;
			this.dlgCompound = null;
			this.refocus();
		});
		this.dlgCompound.defineClipboard(this.proxyClip);
		this.dlgCompound.defineContext(this.proxyMenu);
		this.isEditing = true;
		this.dlgCompound.open();
	}

	// invoke the editor dialog for the current component - basically everything except the structure
	public editDetails():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);

		let w = window.innerWidth * 0.8, h = window.innerHeight * 0.8;

		let dlg = new EditComponent(deepClone(comp), this.inchi, [w, h], this.contentDOM);
		dlg.proxyClip = this.proxyClip;
		dlg.onSave(() =>
		{
			let modmix = this.mixture.clone();
			if (modmix.setComponent(origin, dlg.getComponent()))
			{
				this.setMixture(modmix);
				this.selectOrigin(origin);
			}
			dlg.close();
		});
		dlg.onSketch(() =>
		{
			this.selectOrigin(origin);
			this.editStructure();
		});
		dlg.onClose(() =>
		{
			this.isEditing = false;
			this.refocus();
		});
		this.isEditing = true;
		dlg.open();
	}

	// lookup: searches for compound information based on name, prespecified or otherwise
	public lookupCurrent():void
	{
		if (this.selectedIndex < 0) return;

		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);
		let curX = this.contentDOM.width(), curY = this.contentDOM.height();
		let dlg = new LookupCompoundDialog(comp.name, [curX, curY]);
		dlg.onSelect(() =>
		{
			let modmix = this.mixture.clone();
			comp = deepClone(modmix.getComponent(origin));
			let name = dlg.getName(), mol = dlg.getMolecule();
			if (name != null) comp.name = name;
			if (mol != null) comp.molfile = new MDLMOLWriter(mol).write();
			if (modmix.setComponent(origin, comp))
			{
				this.setMixture(modmix);
				this.selectOrigin(origin);
			}
			dlg.close();
		});
		dlg.onClose(() =>
		{
			this.isEditing = false;
			this.refocus();
		});
		dlg.open();
	}

	// deletes selected component, if any
	public deleteCurrent():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		if (origin.length == 0) return;

		let modmix = this.mixture.clone();
		modmix.deleteComponent(origin);
		this.delayedSelect = null;
		this.setMixture(modmix);

		origin = origin.slice(0);
		if (modmix.getComponent(origin)) {}
		else if (Vec.last(origin) > 0) origin[origin.length - 1]--;
		else origin.pop();
		this.selectOrigin(origin);
	}

	// append a new sub-item to the end of the current component's list
	public appendToCurrent():void
	{
		if (this.selectedIndex < 0) return;

		let origin = this.layout.components[this.selectedIndex].origin;
		let modmix = this.mixture.clone();
		let comp = modmix.getComponent(origin);
		if (!comp.contents) comp.contents = [];
		comp.contents.push({});
		this.delayedSelect = Vec.concat(origin, [comp.contents.length - 1]);
		this.setMixture(modmix);
	}

	// inserts an empty component before the current one
	public prependBeforeCurrent():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let modmix = this.mixture.clone();
		modmix.prependBefore(origin, {});
		this.delayedSelect = origin;
		this.setMixture(modmix);
	}

	// insert above/below the current component
	public insertBeforeCurrent():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		if (Vec.isBlank(origin)) return;
		let modmix = this.mixture.clone();
		let pos = origin.pop();
		let parent = modmix.getComponent(origin);
		parent.contents.splice(pos, 0, {});
		origin.push(pos);
		this.delayedSelect = origin;
		this.setMixture(modmix);
	}
	public insertAfterCurrent():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		if (Vec.isBlank(origin)) return;
		let modmix = this.mixture.clone();
		let pos = origin.pop();
		let parent = modmix.getComponent(origin);
		parent.contents.splice(pos + 1, 0, {});
		origin.push(pos + 1);
		this.delayedSelect = origin;
		this.setMixture(modmix);
	}

	// move the current component up or down the hierarchy
	public reorderCurrent(dir:number):void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		if (origin.length == 0) return;

		let modmix = this.mixture.clone();
		let [parent, idx] = Mixture.splitOrigin(origin);
		let comp = modmix.getComponent(parent);
		if (idx + dir < 0 || idx + dir >= comp.contents.length) return;
		Vec.swap(comp.contents, idx, idx + dir);
		this.delayedSelect = Vec.concat(parent, [idx + dir]);
		this.setMixture(modmix);
	}

	// copy current to clipboard, and optionally excise it
	public clipboardCopy(andCut:boolean, wholeBranch:boolean = false):void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;

		let comp = deepClone(this.mixture.getComponent(origin));
		delete (comp as any).mixfileVersion;
		if (!wholeBranch) comp.contents = [];
		let str = Mixture.serialiseComponent(comp);

		/*let clipboard = require('electron').clipboard;
		clipboard.writeText(str);*/
		this.proxyClip.setString(str);

		if (origin.length > 0 && andCut) this.deleteCurrent();
	}

	// paste from clipboard, if possible
	public clipboardPaste():void
	{
		/*let clipboard = require('electron').clipboard;
		let str = clipboard.readText();*/
		let str = this.proxyClip.getString();

		let json:any = null;
		try {json = JSON.parse(str);}
		catch (e) {} // silent failure

		let origin:number[] = [];
		if (this.selectedIndex >= 0) origin = this.layout.components[this.selectedIndex].origin;

		// see if it's a Molfile CTAB that has enumeration flags set (stays null if nothing component-ish)
		if (!json) json = new ExtractCTABComponent(str).extract();

		// see if it's just a regular singular molecule
		if (!json)
		{
			let mol = MoleculeStream.readUnknown(str);
			if (MolUtil.notBlank(mol))
			{
				let modmix = this.mixture.clone();
				let comp = modmix.getComponent(origin);
				if (comp)
				{
					comp.molfile = new MDLMOLWriter(mol).write();
					this.setMixture(modmix);
				}
			}
			else alert('Clipboard does not contain a mixture component.');
			return;
		}

		if (!json.name && !json.molfile && !json.quantity && Vec.isBlank(json.contents))
		{
			alert('Clipboard content is either not a component, or has no interesting content.');
			return;
		}

		// special deal when pasting into nothing: just replace it
		if (this.selectedIndex < 0 && this.mixture.isEmpty())
		{
			let modmix = new Mixture(json);
			this.delayedSelect = [];
			this.setMixture(modmix);
			return;
		}

		// append to or replace some piece, preferably selected
		let modmix = this.mixture.clone();
		let comp = modmix.getComponent(origin);
		if (Mixture.isComponentEmpty(comp))
		{
			Object.keys(comp).forEach((key:string) => delete (comp as any)[key]);
			Object.keys(json).forEach((key:string) => (comp as any)[key] = json[key]);
			this.delayedSelect = origin;
		}
		else // append
		{
			if (!comp.contents) comp.contents = [];
			comp.contents.push(json);
			this.delayedSelect = Vec.concat(origin, [comp.contents.length - 1]);
		}
		this.setMixture(modmix);
	}

	// call this anytime the focus could have wandered
	public refocus():void
	{
		this.contentDOM.grabFocus();
	}

	// return the layout around onscreen for an indicated component
	public getComponentPosition(origin:number[]):Box
	{
		for (let comp of this.layout.components) if (Vec.equals(origin, comp.origin))
		{
			let box = comp.boundary.clone();
			box.x += this.offsetX;
			box.y += this.offsetY;
			return box;
		}
		return null;
	}

	// ------------ private methods ------------

	protected redraw(rescale = false, fit = false):void
	{
		this.filthy = false;

		let width = this.contentDOM.width(), height = this.contentDOM.height();
		let density = pixelDensity();

		for (let canvas of [this.canvasMixture, this.canvasOver])
		{
			canvas.width = width * density;
			canvas.height = height * density;
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';
		}

		if (!this.layout)
		{
			let measure = new OutlineMeasurement(0, 0, this.pointScale);
			this.policy = this.monochrome ? RenderPolicy.defaultBlackOnWhite(this.pointScale) : RenderPolicy.defaultColourOnWhite(this.pointScale);
			this.layout = new ArrangeMixture(this.mixture, measure, this.policy);
			this.layout.showCollapsors = true;
			this.layout.collapsedBranches = this.collapsedBranches;
			this.layout.packBranches = new Size(0.8 * this.contentDOM.width(), 0.8 * this.contentDOM.height());
			this.layout.norm = new NormMixture(this.mixture);
			this.layout.norm.analyse();
			this.layout.arrange();
			if (rescale) this.scaleToFit(fit);
		}

		if (this.delayedSelect)
		{
			for (let n = 0; n < this.layout.components.length; n++) if (Vec.equals(this.delayedSelect, this.layout.components[n].origin))
			{
				this.selectedIndex = n;
				this.ensureComponentVisible(n);
				break;
			}
			this.delayedSelect = null;
		}

		let gfx = new MetaVector();
		let draw = new DrawMixture(this.layout, gfx);
		draw.hoverIndex = this.hoverIndex;
		draw.activeIndex = this.activeIndex;
		draw.selectedIndex = this.selectedIndex;
		draw.draw();

		gfx.offsetX = this.offsetX;
		gfx.offsetY = this.offsetY;
		gfx.setSize(width, height);
		gfx.renderCanvas(this.canvasMixture, true);
	}

	// assuming that layout is already defined, modifies the offset/scale so that
	protected scaleToFit(mustFit:boolean):void
	{
		let width = this.contentDOM.width(), height = this.contentDOM.height(), pad = 4;
		if (mustFit)
		{
			if (this.layout.width > width - pad || this.layout.height > height - pad)
			{
				let scale = Math.min((width - pad) / this.layout.width, (height - pad) / this.layout.height);
				this.pointScale *= scale;
				this.layout.scaleComponents(scale);
			}
			this.offsetX = 0.5 * (width - this.layout.width);
			this.offsetY = 0.5 * (height - this.layout.height);
		}
		else
		{
			this.offsetX = Math.max(pad, 0.5 * (width - this.layout.width));
			this.offsetY = 0.5 * (height - this.layout.height);
		}
	}

	// make sure the indicated component is fully visible onscreen
	private ensureComponentVisible(idx:number):void
	{
		let width = this.contentDOM.width(), height = this.contentDOM.height(), pad = 4;
		let comp = this.layout.components[idx];
		let box = comp.boundary.withOffsetBy(this.offsetX, this.offsetY);

		if (box.minX() < pad) this.offsetX -= box.minX() - pad;
		else if (box.maxX() > width - pad) this.offsetX += width - pad - box.maxX();

		if (box.minY() < pad) this.offsetY -= box.minY() - pad;
		else if (box.maxY() > height - pad) this.offsetY += height - pad - box.maxY();
	}

	// mouse has moved: see if we need to update the hover
	protected updateHoverCursor(event:MouseEvent):void
	{
		let [x, y] = eventCoords(event, this.contentDOM);
		let idx = this.activeIndex >= 0 ? -1 : this.pickComponent(x, y);
		if (idx != this.hoverIndex)
		{
			this.hoverIndex = idx;
			this.delayedRedraw();
		}
	}

	// finds the index of a component at a given position, or -1 if none
	protected pickComponent(x:number, y:number):number
	{
		let pick = this.pickComponentSection(x, y);
		return pick == null || pick[1] ? -1 : pick[0];
	}

	// more detailed pick: nothing = null, something = [compidx, collapsebox]
	protected pickComponentSection(x:number, y:number):[number, boolean]
	{
		if (!this.layout) return null;
		for (let n = 0; n < this.layout.components.length; n++)
		{
			let comp = this.layout.components[n];
			let ux = x - this.offsetX - comp.boundary.x, uy = y - this.offsetY - comp.boundary.y;
			if (comp.outline.contains(ux, uy)) return [n, false];
			if (comp.collapseBox && comp.collapseBox.contains(ux, uy)) return [n, true];
		}
		return null;
	}

	// cursor key wandering
	protected navigateDirection(dir:string):void
	{
		let newIndex = -1;
		if (this.selectedIndex < 0) newIndex = 0;
		else
		{
			let origin = this.layout.components[this.selectedIndex].origin.slice(0);

			if (dir == 'tab')
			{
				if (Vec.isBlank(origin))
				{
					let comp = this.mixture.getComponent(origin);
					if (Vec.isBlank(comp.contents))
					{
						this.delayedSelect = [0];
						this.appendToCurrent();
						return;
					}
					dir = 'right';
				}
				else
				{
					let parent = this.mixture.getComponent(origin.slice(0, origin.length - 1)), pos = Vec.last(origin);
					if (pos == parent.contents.length - 1)
					{
						this.insertAfterCurrent();
						return;
					}
					dir = 'down';
				}
			}

			if (dir == 'left')
			{
				if (origin.length == 0) return;
				origin.pop();
				newIndex = this.layout.findComponent(origin);
			}
			else if (dir == 'right')
			{
				origin.push(0);
				newIndex = this.layout.findComponent(origin);
			}
			else if (dir == 'up')
			{
				if (origin.length == 0 || origin[origin.length - 1] == 0) return;
				origin[origin.length - 1]--;
				newIndex = this.layout.findComponent(origin);
			}
			else if (dir == 'down')
			{
				if (origin.length == 0) return;
				origin[origin.length - 1]++;
				newIndex = this.layout.findComponent(origin);
			}
		}

		if (newIndex >= 0 && newIndex < this.layout.components.length)
		{
			this.delayedSelect = this.layout.components[newIndex].origin;
			this.delayedRedraw();
		}
	}

	// collapses or un-collapses the indicated position
	protected toggleCollapsed(idx:number):void
	{
		let origin = this.layout.components[idx].origin;
		let got = false;
		for (let n = 0; n < this.collapsedBranches.length; n++) if (Vec.equals(origin, this.collapsedBranches[n]))
		{
			this.collapsedBranches.splice(n, 1);
			got = true;
			break;
		}
		if (!got) this.collapsedBranches.push(origin);
		this.layout = null;
		this.redraw();
	}

	// interactivity
	protected mouseClick(event:MouseEvent):void
	{
		if (this.isEditing) return;

		if (event.ctrlKey)
		{
			event.preventDefault();
			return;
		}

		let [x, y] = eventCoords(event, this.contentDOM);
		let picked = this.pickComponentSection(x, y);
		if (picked && picked[1]) this.toggleCollapsed(picked[0]);
	}
	protected mouseDoubleClick(event:MouseEvent):void
	{
		if (this.isEditing) return;

		event.stopImmediatePropagation();

		let [x, y] = eventCoords(event, this.contentDOM);
		let idx = this.pickComponent(x, y);
		if (idx >= 0)
		{
			this.hoverIndex = -1;
			this.activeIndex = -1;
			this.selectedIndex = idx;
			this.delayedRedraw();
			this.editDetails();
		}
	}
	protected mouseDown(event:MouseEvent):void
	{
		if (this.isEditing) return;

		if (this.callbackInteraction) this.callbackInteraction();
		//event.preventDefault();

		if (event.which != 1) return;
		if (event.ctrlKey)
		{
			//this.contextMenu(event);
			event.preventDefault();
			return;
		}

		let [x, y] = eventCoords(event, this.contentDOM);
		let idx = this.pickComponent(x, y);

		this.dragReason = DragReason.Any;
		this.dragIndex = idx;
		this.dragX = x;
		this.dragY = y;

		if (idx != this.activeIndex)
		{
			this.activeIndex = idx;
			this.delayedRedraw();
		}
	}
	protected mouseUp(event:MouseEvent):void
	{
		if (this.isEditing) return;

		if (event.ctrlKey)
		{
			event.preventDefault();
			return;
		}

		if (this.dragReason != DragReason.Pan)
		{
			let [x, y] = eventCoords(event, this.contentDOM);
			let idx = this.pickComponent(x, y);
			if (idx == this.activeIndex) this.selectedIndex = idx;
			this.activeIndex = -1;
			this.delayedRedraw();
		}

		this.dragReason = DragReason.None;
	}
	protected mouseOver(event:MouseEvent):void
	{
		if (this.isEditing) return;

		this.updateHoverCursor(event);
	}
	protected mouseOut(event:MouseEvent):void
	{
		if (this.isEditing) return;

		this.updateHoverCursor(event);
		this.dragReason = DragReason.None;
	}
	protected mouseMove(event:MouseEvent):void
	{
		if (this.isEditing) return;

		this.updateHoverCursor(event);

		if (this.dragReason == DragReason.Any && this.dragIndex < 0)
		{
			this.dragReason = DragReason.Pan;
		}

		if (this.dragReason == DragReason.Pan)
		{
			let [x, y] = eventCoords(event, this.contentDOM);
			let dx = x - this.dragX, dy = y - this.dragY;
			if (dx != 0 && dy != 0)
			{
				this.offsetX += dx;
				this.offsetY += dy;
				this.delayedRedraw();
				[this.dragX, this.dragY] = [x, y];
			}
		}
	}
	protected keyPressed(event:KeyboardEvent):void
	{
		//let ch = String.fromCharCode(event.keyCode || event.charCode);
		//console.log('PRESSED['+ch+'] key='+event.keyCode+' chcode='+event.charCode);
	}
	protected keyDown(event:KeyboardEvent):void
	{
		if (this.isEditing) return;

		if (this.callbackInteraction) this.callbackInteraction();

		if (!this.isReceivingCommands()) return;

		let key = event.key;
		//console.log('DOWN: key='+key);

		if (!event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey)
		{
			if (key == 'Enter')
			{
				if (this.selectedIndex >= 0) this.editDetails();
			}
			else if (key == 'Escape') {} // escape
			else if (key == 'ArrowLeft') this.navigateDirection('left');
			else if (key == 'ArrowRight') this.navigateDirection('right');
			else if (key == 'ArrowUp') this.navigateDirection('up');
			else if (key == 'ArrowDown') this.navigateDirection('down');
			else if (key == 'Tab') this.navigateDirection('tab');
			else return;

			event.preventDefault();
			event.stopPropagation();
		}
	}
	protected keyUp(event:KeyboardEvent):void
	{
		// !!
	}
	protected mouseWheel(event:WheelEvent):void
	{
		if (this.callbackInteraction) this.callbackInteraction();

		let [x, y] = eventCoords(event, this.contentDOM);
		let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
		let scale = 1 + Math.abs(delta) * 0.05;
		if (delta < 0) scale = 1.0 / scale;

		let newScale = this.pointScale * scale;
		this.offsetX = x - (newScale / this.pointScale) * (x - this.offsetX);
		this.offsetY = y - (newScale / this.pointScale) * (y - this.offsetY);
		//if (this.layout) this.layout.scaleComponents(newScale / this.pointScale);
		this.pointScale = newScale;

		this.layout = null;
		this.delayedRedraw();
		event.preventDefault();
	}
	protected contextMenu(event:MouseEvent):void
	{
		// nop
	}

	// given that the structure may have changed, see if any metadata is potentially invalidated - and ask the user; the component parameter
	// may be modified
	protected checkStructureIntegrity(comp:MixfileComponent, newMol:Molecule):void
	{
		let integKeys = Object.keys(this.structureIntegrity).filter((key) => (comp.identifiers && comp.identifiers[key]) || (comp.links && comp.links[key]));
		if (integKeys.length == 0) return;

		let oldMol = comp.molfile ? MoleculeStream.readUnknown(comp.molfile) : null;
		if (MolUtil.isBlank(oldMol) && MolUtil.isBlank(newMol)) return;
		if (oldMol && newMol && CoordUtil.sketchMappable(oldMol, newMol)) return;

		let msg = MolUtil.isBlank(newMol) ? 'Structure has been removed.' : 'Structure has changed.';
		msg += `\nThe following reference${integKeys.length == 1 ? '' : 's'} may have become stale:`;
		for (let key of integKeys) msg += '\n    ' + this.structureIntegrity[key];
		msg += integKeys.length == 1 ? '\nRemove this reference?' : '\nRemove these references?';
		if (!confirm(msg)) return;

		for (let key of integKeys)
		{
			if (comp.identifiers) delete comp.identifiers[key];
			if (comp.links) delete comp.links[key];
		}
	}
}

