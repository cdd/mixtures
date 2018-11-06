/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/sketcher/Sketcher.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/gfx/Rendering.ts'/>
///<reference path='../../../WebMolKit/src/ui/Widget.ts'/>
///<reference path='../../../WebMolKit/src/dialog/EditCompound.ts'/>

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>
///<reference path='../main/startup.ts'/>
///<reference path='../data/Mixfile.ts'/>
///<reference path='../lookup/LookupCompoundDialog.ts'/>
///<reference path='ArrangeMixture.ts'/>
///<reference path='DrawMixture.ts'/>
///<reference path='EditComponent.ts'/>

namespace Mixtures /* BOF */ {

/*
	High level widget for the editing area for a mixture.
*/

const DEFAULT_SCALE = 20;
const UNDO_SIZE = 10;

enum DragReason
{
	None,
	Any,
	Pan,
}

export class EditMixture extends wmk.Widget
{
	public callbackUpdateTitle:() => void = null;

	private mixture = new Mixture();
	private policy = wmk.RenderPolicy.defaultColourOnWhite();
	private canvasMixture:HTMLCanvasElement;
	private canvasOver:HTMLCanvasElement;

	private undoStack:Mixture[] = [];
	private redoStack:Mixture[] = [];

	private offsetX = 0;
	private offsetY = 0;
	private pointScale = DEFAULT_SCALE;
	private filthy = true; // filthy: screen is out of date, needs to be redrawn
	private dirty = false; // dirty: data has changed since last save
	private layout:ArrangeMixture = null;
	private hoverIndex = -1; // component over which the mouse is hovering
	private activeIndex = -1; // component that is currently being clicked upon
	private selectedIndex = -1; // selected component (having been previously clicked)
	private delayedSelect:number[] = null; // if set to an origin vector, will be used to rederive selectedIndex next time the layout is evaluated

	private dragReason = DragReason.None;
	private dragIndex = -1;
	private dragX = 0;
	private dragY = 0;
	private isEditing = false;

	// ------------ public methods ------------

	constructor()
	{
		super();
	}

	public render(parent:any):void
	{
		super.render(parent);

		this.content.css({'width': '100%', 'height': '100%'});
		this.content.css('background-color', '#F0F0F0');

		let canvasStyle = 'position: absolute; left: 0; top: 0; pointer-events: none;';
		this.canvasMixture = <HTMLCanvasElement>newElement(this.content, 'canvas', {'style': canvasStyle});
		this.canvasOver = <HTMLCanvasElement>newElement(this.content, 'canvas', {'style': canvasStyle});

		this.content.resize(() => this.redraw());

		// setup all the interactive events
		this.content.click((event:JQueryEventObject) => this.mouseClick(event));
		this.content.dblclick((event:JQueryEventObject) => this.mouseDoubleClick(event));
		this.content.mousedown((event:JQueryEventObject) => this.mouseDown(event));
		this.content.mouseup((event:JQueryEventObject) => this.mouseUp(event));
		this.content.mouseover((event:JQueryEventObject) => this.mouseOver(event));
		this.content.mouseout((event:JQueryEventObject) => this.mouseOut(event));
		this.content.mousemove((event:JQueryEventObject) => this.mouseMove(event));
		this.content.on('mousewheel', (event:JQueryEventObject) => this.mouseWheel(event));
		this.content.keypress((event:JQueryEventObject) => this.keyPressed(event));
		this.content.keydown((event:JQueryEventObject) => this.keyDown(event));
		this.content.keyup((event:JQueryEventObject) => this.keyUp(event));
		this.content.contextmenu((event:JQueryEventObject) => this.contextMenu(event));

		this.content.attr('tabindex', '0');
		this.content.focus();
		this.redraw(true);
	}

	// whether or not menu commands are being received; no means that it's in dialog/editing mode
	public isReceivingCommands() {return !this.isEditing;}

	// access to current state
	public getMixture():Mixture {return this.mixture;}
	public setMixture(mixture:Mixture, withAutoScale:boolean = false, withStashUndo:boolean = true):void
	{
		// NOTE: the "withAutoScale" parameter is currently not very meaningful since the modified mixture gets a re-layout
		withAutoScale = true;

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
		this.callbackUpdateTitle();
	}

	// wipes the undo & redo stacks
	public clearHistory():void
	{
		this.undoStack = [];
		this.redoStack = [];
	}

	// appends the current state to the undo-stack
	public stashUndo():void
	{
		if (this.undoStack.length == 0 && this.mixture.isEmpty()) return; // don't put empty stuff at the beginning
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
		this.redraw(true);
	}

	// select the given component index (programmatically)
	public selectComponent(comp:number):void
	{
		if (this.selectedIndex == comp) return;
		this.selectedIndex = comp;
		this.activeIndex = -1;
		this.delayedRedraw();
	}

	// bring up the structure-editing panel, which uses the generic sketching dialog
	public editStructure():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);

		let mol = comp.molfile ? wmk.MoleculeStream.readUnknown(comp.molfile) : null;

		let dlg = new wmk.EditCompound(mol ? mol : new wmk.Molecule());
		dlg.onSave(() => 
		{
			let molfile = wmk.MoleculeStream.writeMDLMOL(dlg.getMolecule());
			if (!molfile) molfile = null;

			comp = deepClone(comp);
			comp.molfile = molfile;
			let modmix = this.mixture.clone();
			if (modmix.setComponent(origin, comp)) this.setMixture(modmix);
			
			dlg.close();
		});
		dlg.onClose(() => this.isEditing = false);
		this.isEditing = true;
		dlg.open();
	}

	// invoke the editor dialog for the current component - basically everything except the structure
	public editDetails():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);
		let curX = this.content.width(), curY = this.content.height();
		let dlg = new EditComponent(deepClone(comp), [curX, curY]);
		dlg.onSave(() =>
		{
			let modmix = this.mixture.clone();
			if (modmix.setComponent(origin, dlg.getComponent())) this.setMixture(modmix);
			dlg.close();
		});
		dlg.onSketch(() =>
		{
			for (let n = 0; n < this.layout.components.length; n++)
				if (Vec.equals(origin, this.layout.components[n].origin)) {this.selectedIndex = n; break;}
			this.editStructure();
		});
		dlg.onClose(() => this.isEditing = false);
		this.isEditing = true;
		dlg.open();
	}

	// lookup: searches for compound information based on name, prespecified or otherwise
	public lookupCurrent():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);
		let curX = this.content.width(), curY = this.content.height();
		let dlg = new LookupCompoundDialog(comp.name, [curX, curY]);
		dlg.onSelect(() =>
		{
			let modmix = this.mixture.clone();
			comp = deepClone(modmix.getComponent(origin));
			let name = dlg.getName(), mol = dlg.getMolecule();
			if (name != null) comp.name = name;
			if (mol != null) comp.molfile = new wmk.MDLMOLWriter(mol).write();
			if (modmix.setComponent(origin, comp)) this.setMixture(modmix);
			dlg.close();
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
		//let [parent, idx] = Mixture.splitOrigin(origin);
		//modmix.getComponent(parent).contents.splice(idx, 1);
		modmix.deleteComponent(origin);
		this.delayedSelect = null;
		//this.delayedSelect = parent;
		this.setMixture(modmix);
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
		delete (<any>comp).mixfileVersion;
		if (!wholeBranch) comp.contents = [];
		let str = Mixture.serialiseComponent(comp);

		let clipboard = require('electron').clipboard;
		clipboard.writeText(str);

		if (origin.length > 0 && andCut) this.deleteCurrent();
	}

	// paste from clipboard, if possible
	public clipboardPaste():void
	{
		let clipboard = require('electron').clipboard;

		let str = clipboard.readText();
		let json:any = null;
		try {json = JSON.parse(str);}
		catch (e) {} // silent failure

		let origin:number[] = [];
		if (this.selectedIndex >= 0) origin = this.layout.components[this.selectedIndex].origin;

		if (!json) 
		{
			let mol = wmk.MoleculeStream.readUnknown(str);
			if (wmk.MolUtil.notBlank(mol))
			{
				let modmix = this.mixture.clone();
				let comp = modmix.getComponent(origin);
				if (comp)
				{
					comp.molfile = new wmk.MDLMOLWriter(mol).write();
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
		//json.contents = []; // (should we allow whole branches? -- yes!)


		let modmix = this.mixture.clone();
		let comp = modmix.getComponent(origin);
		if (!comp.contents) comp.contents = [];
		comp.contents.push(json);
		this.delayedSelect = Vec.concat(origin, [comp.contents.length - 1]);
		this.setMixture(modmix);
	}

	// ------------ private methods ------------
	
	private redraw(rescale = false):void
	{
		this.filthy = false;

		let width = this.content.width(), height = this.content.height();
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
			let measure = new wmk.OutlineMeasurement(0, 0, this.pointScale);
			let policy = new wmk.RenderPolicy(deepClone(this.policy.data));
			policy.data.pointScale = this.pointScale;
			this.layout = new ArrangeMixture(this.mixture, measure, policy);
			this.layout.arrange();
			if (rescale) this.scaleToFit();
		}

		if (this.delayedSelect)
		{
			for (let n = 0; n < this.layout.components.length; n++) 
				if (Vec.equals(this.delayedSelect, this.layout.components[n].origin)) {this.selectedIndex = n; break;}
			this.delayedSelect = null;
		}

		let gfx = new wmk.MetaVector();
		let draw = new DrawMixture(this.layout, gfx);
		draw.hoverIndex = this.hoverIndex;
		draw.activeIndex = this.activeIndex;
		draw.selectedIndex = this.selectedIndex;
		draw.draw();

		gfx.normalise();
		gfx.offsetX = this.offsetX;
		gfx.offsetY = this.offsetY;
		gfx.renderCanvas(this.canvasMixture, true);
	}

	// assuming that layout is already defined, modifies the offset/scale so that 
	private scaleToFit():void
	{
		let width = this.content.width(), height = this.content.height(), pad = 4;
		if (this.layout.width > width - pad || this.layout.height > height - pad)
		{
			let scale = Math.min((width - pad) / this.layout.width, (height - pad) / this.layout.height);
			this.pointScale *= scale;
			this.layout.scaleComponents(scale);
		}
		this.offsetX = 0.5 * (width - this.layout.width);
		this.offsetY = 0.5 * (height - this.layout.height);
	}

	// mouse has moved: see if we need to update the hover
	private updateHoverCursor(event:JQueryEventObject):void
	{
		let [x, y] = eventCoords(event, this.content);
		let comp = this.activeIndex >= 0 ? -1 : this.pickComponent(x, y);
		if (comp != this.hoverIndex)
		{
			this.hoverIndex = comp;
			this.delayedRedraw();
		}
	}

	// finds the index of a component at a given position, or -1 if none
	private pickComponent(x:number, y:number):number
	{
		if (!this.layout) return -1;
		for (let n = 0; n < this.layout.components.length; n++)
		{
			let comp = this.layout.components[n];
			if (comp.boundary.contains(x - this.offsetX, y - this.offsetY)) return n;
		}
		return -1;
	}

	// cursor key wandering
	private navigateDirection(dir:string):void
	{
		let newIndex = -1;
		if (this.selectedIndex < 0) newIndex = 0;
		else
		{
			let origin = this.layout.components[this.selectedIndex].origin.slice(0);
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

		if (newIndex >= 0 && newIndex < this.layout.components.length) this.selectComponent(newIndex);
	}

	// interactivity
	private mouseClick(event:JQueryEventObject):void
	{
		this.content.focus(); // just in case it wasn't already
	}
	private mouseDoubleClick(event:JQueryEventObject):void
	{
		event.stopImmediatePropagation();

		let [x, y] = eventCoords(event, this.content);
		let comp = this.pickComponent(x, y);
		if (comp >= 0)
		{
			this.hoverIndex = -1;
			this.activeIndex = -1;
			this.selectedIndex = comp;
			this.delayedRedraw();
			this.editDetails();
		}
	}
	private mouseDown(event:JQueryEventObject):void
	{
		event.preventDefault();

		let [x, y] = eventCoords(event, this.content);
		let comp = this.pickComponent(x, y);

		this.dragReason = DragReason.Any;
		this.dragIndex = comp;
		this.dragX = x;
		this.dragY = y;

		if (comp != this.activeIndex)
		{
			this.activeIndex = comp;
			this.delayedRedraw();
		}
	}
	private mouseUp(event:JQueryEventObject):void
	{
		let [x, y] = eventCoords(event, this.content);
		let comp = this.pickComponent(x, y);
		if (comp == this.activeIndex) this.selectedIndex = comp;
		this.activeIndex = -1;
		this.delayedRedraw();

		this.dragReason = DragReason.None;
	}
	private mouseOver(event:JQueryEventObject):void
	{
		this.updateHoverCursor(event);
	}
	private mouseOut(event:JQueryEventObject):void
	{
		this.updateHoverCursor(event);
		this.dragReason = DragReason.None;
	}
	private mouseMove(event:JQueryEventObject):void
	{
		this.updateHoverCursor(event);

		if (this.dragReason == DragReason.Any && this.dragIndex < 0)
		{
			this.dragReason = DragReason.Pan;
		}

		if (this.dragReason == DragReason.Pan)
		{
			let [x, y] = eventCoords(event, this.content);
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
	private keyPressed(event:JQueryEventObject):void
	{
		//let ch = String.fromCharCode(event.keyCode || event.charCode);
		//console.log('PRESSED['+ch+'] key='+event.keyCode+' chcode='+event.charCode);
	}
	private keyDown(event:JQueryEventObject):void
	{
		let key = event.keyCode;
		//console.log('DOWN: key='+key);

		if (key == 27) {} // escape	
		if (key == 37) this.navigateDirection('left');
		else if (key == 39) this.navigateDirection('right');
		else if (key == 38) this.navigateDirection('up');
		else if (key == 40) this.navigateDirection('down');
	}
	private keyUp(event:JQueryEventObject):void
	{
		// !!
	}
	private mouseWheel(event:JQueryEventObject):void
	{
		let orig = event.originalEvent as WheelEvent;
		let [x, y] = eventCoords(event, this.content);
		const FRACT = 0.25 * 0.25;
		let scale = 1 + Math.abs(orig.wheelDelta) * (FRACT / 120); // one "notch" on a wheel mouse is worth 120 units
		if (orig.wheelDelta < 0) scale = 1.0 / scale;

		let newScale = this.pointScale * scale;
		this.offsetX = x - (newScale / this.pointScale) * (x - this.offsetX);
		this.offsetY = y - (newScale / this.pointScale) * (y - this.offsetY);
		//if (this.layout) this.layout.scaleComponents(newScale / this.pointScale);
		this.pointScale = newScale;

		this.layout = null;
		this.delayedRedraw();
		event.preventDefault();
	}
	private contextMenu(event:JQueryEventObject):void
	{
		event.preventDefault();

		let comp = this.pickComponent(event.clientX, event.clientY);
		
		let electron = require('electron');
		let menu = new electron.remote.Menu();
		if (comp >= 0)
		{
			let compObj = this.layout.components[comp].content, origin = this.layout.components[comp].origin;
			menu.append(new electron.remote.MenuItem({'label': 'Edit Structure', 'click': () => {this.selectComponent(comp); this.editStructure();}}));
			menu.append(new electron.remote.MenuItem({'label': 'Edit Details', 'click': () => {this.selectComponent(comp); this.editDetails();}}));
			menu.append(new electron.remote.MenuItem({'label': 'Lookup Name', 'click': () => {this.selectComponent(comp); this.lookupCurrent();}}));
			menu.append(new electron.remote.MenuItem({'label': 'Append', 'click': () => {this.selectComponent(comp); this.appendToCurrent();}}));
			if (origin.length > 0)
			{
				menu.append(new electron.remote.MenuItem({'label': 'Prepend', 'click': () => {this.selectComponent(comp); this.prependBeforeCurrent();}}));
				menu.append(new electron.remote.MenuItem({'label': 'Delete', 'click': () => {this.selectComponent(comp); this.deleteCurrent();}}));

				if (origin[origin.length - 1] > 0)
					menu.append(new electron.remote.MenuItem({'label': 'Move Up', 'click': () => {this.selectComponent(comp); this.reorderCurrent(-1);}}));
				if (origin[origin.length - 1] < Vec.arrayLength(this.mixture.getParentComponent(origin).contents) - 1)
					menu.append(new electron.remote.MenuItem({'label': 'Move Down', 'click': () => {this.selectComponent(comp); this.reorderCurrent(1);}}));
			}

			menu.append(new electron.remote.MenuItem({'label': 'Copy', 'click': () => {this.selectComponent(comp); this.clipboardCopy(false);}}));
			if (Vec.arrayLength(compObj.contents) > 0)
				menu.append(new electron.remote.MenuItem({'label': 'Copy Branch', 'click': () => {this.selectComponent(comp); this.clipboardCopy(false, true);}}));
			if (origin.length > 0)
				menu.append(new electron.remote.MenuItem({'label': 'Cut', 'click': () => {this.selectComponent(comp); this.clipboardCopy(true);}}));
			menu.append(new electron.remote.MenuItem({'label': 'Paste', 'click': () => {this.selectComponent(comp); this.clipboardPaste();}}));
		}
		else
		{
			menu.append(new electron.remote.MenuItem({'label': 'Zoom In', 'click': () => this.zoom(1.25)}));
			menu.append(new electron.remote.MenuItem({'label': 'Zoom Out', 'click': () => this.zoom(0.8)}));
		}

		menu.popup(electron.remote.getCurrentWindow());
	}
}

/* EOF */ }