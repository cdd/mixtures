/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/sketcher/Sketcher.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/gfx/Rendering.ts'/>
///<reference path='../../../WebMolKit/src/ui/Widget.ts'/>

///<reference path='../main/startup.ts'/>
///<reference path='Mixfile.ts'/>
///<reference path='ArrangeMixture.ts'/>
///<reference path='DrawMixture.ts'/>

namespace Mixtures /* BOF */ {

/*
	High level widget for the editing area for a mixture.
*/

export class EditMixture extends wmk.Widget
{
	private mixture = new Mixture();
	private policy = wmk.RenderPolicy.defaultColourOnWhite();
	private canvasMixture:HTMLCanvasElement;
	private canvasOver:HTMLCanvasElement;

	private offsetX = 0;
	private offsetY = 0;
	private pointScale = this.policy.data.pointScale;
	private gfxMixture:wmk.MetaVector = null;
	private filthy = true;
	private layout:ArrangeMixture = null;
	private hoverIndex = -1; // component over which the mouse is hovering
	private activeIndex = -1; // component that is currently being clicked upon
	private selectedIndex = -1; // selected component (having been previously clicked)

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
		this.content.keypress((event:JQueryEventObject) => this.keyPressed(event));
		this.content.keydown((event:JQueryEventObject) => this.keyDown(event));
		this.content.keyup((event:JQueryEventObject) => this.keyUp(event));
	}

	public getMixture():Mixture {return this.mixture;}
	public setMixture(mixture:Mixture):void
	{
		this.mixture = mixture;

		// !! centre or shrink as necessary
		this.offsetX = 0;
		this.offsetY = 0;
		this.pointScale = this.policy.data.pointScale;
		this.filthy = true;
		this.layout = null;
		this.hoverIndex = -1;
		this.activeIndex = -1;
		this.selectedIndex = -1;
		this.redraw(true);
	}

	// makes sure the content gets redrawn imminently; calling many times is not a performance issue
	public delayedRedraw():void
	{
		this.filthy = true;
		window.setTimeout(() => {if (this.filthy) this.redraw();}, 10);		
	}

	// ------------ private methods ------------
	
	private redraw(rescale = false):void
	{
		if (!this.filthy) return;
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
			let measure = new wmk.OutlineMeasurement(this.offsetX, this.offsetY, this.pointScale);
			this.layout = new ArrangeMixture(this.mixture, measure, this.policy);
			this.layout.arrange();
			if (rescale) this.scaleToFit();
		}

		this.gfxMixture = new wmk.MetaVector();
		let draw = new DrawMixture(this.layout, this.gfxMixture);
		draw.hoverIndex = this.hoverIndex;
		draw.activeIndex = this.activeIndex;
		draw.selectedIndex = this.selectedIndex;
		draw.draw();
		this.gfxMixture.normalise();
		
		this.gfxMixture.renderCanvas(this.canvasMixture, true);
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

		// !! NOW, ox|oy...
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
			if (comp.boundary.contains(x, y)) return n;
		}
		return -1;
	}

	// interactivity
	private mouseClick(event:JQueryEventObject):void
	{
		this.content.focus(); // just in case it wasn't already
	}
	private mouseDoubleClick(event:JQueryEventObject):void
	{
		// (do something...)
		event.stopImmediatePropagation();
	}
	private mouseDown(event:JQueryEventObject):void
	{
		event.preventDefault();

		let [x, y] = eventCoords(event, this.content);
		let comp = this.pickComponent(x, y);
		if (comp != this.activeIndex)
		{
			this.activeIndex = comp;
			this.delayedRedraw();
		}

		/*this.clearMessage();

		this.dragType = DraggingTool.Press;
		this.opBudged = false;
		this.dragGuides = null;
		
		let xy = eventCoords(event, this.container);
		this.mouseX = xy[0];
		this.mouseY = xy[1];
		this.clickX = xy[0];
		this.clickY = xy[1];
		
		let clickObj = this.pickObject(xy[0], xy[1]);
		this.opAtom = clickObj > 0 ? clickObj : 0;
		this.opBond = clickObj < 0 ? -clickObj : 0;
		this.opShift = event.shiftKey;
		this.opCtrl = event.ctrlKey;
		this.opAlt = event.altKey;

		let tool = 'finger';
		if (this.toolView != null) tool = this.toolView.selectedButton;
		
		if (tool == 'arrow')
		{
			// special key modifiers for the arrow tool:
			//		CTRL: open context menu
			//		SHIFT: toggle selection of object [see mouseClick]
			//		ALT: enter pan-mode
			//		ALT+CTRL: enter zoom mode
			if (!this.opShift && !this.opCtrl && !this.opAlt)
			{
				this.dragType = DraggingTool.Press;
			}
			else if (!this.opShift && this.opCtrl && !this.opAlt)
			{
				// !! open context...
			}
			else if (!this.opShift && !this.opCtrl && this.opAlt)
			{
				this.dragType = DraggingTool.Pan;
			}
			else if (!this.opShift && this.opCtrl && this.opAlt)
			{
				this.dragType = DraggingTool.Zoom;
			}
		}
		else if (tool == 'rotate')
		{
			this.dragType = DraggingTool.Rotate;
			this.toolRotateIncr = this.opShift ? 0 : 15 * DEGRAD;
		}
		else if (tool == 'pan')
		{
			this.dragType = DraggingTool.Pan;
		}
		else if (tool == 'drag')
		{
			this.dragType = DraggingTool.Move;
			if (this.opAtom > 0) this.dragGuides = this.determineMoveGuide();
			this.delayedRedraw();
		}
		else if (tool == 'erasor')
		{
			this.dragType = DraggingTool.Erasor;
			this.lassoX = [xy[0]];
			this.lassoY = [xy[1]];
			this.lassoMask = [];
		}
		else if (tool == 'ringAliph')
		{
			this.dragType = DraggingTool.Ring;
			this.toolRingArom = false;
			this.toolRingFreeform = this.opShift;
		}
		else if (tool == 'ringArom')
		{
			this.dragType = DraggingTool.Ring;
			this.toolRingArom = true;
			this.toolRingFreeform = this.opShift;
		}
		else if (tool == 'atomPlus')
		{
			this.dragType = DraggingTool.Charge;
			this.toolChargeDelta = 1;
		}
		else if (tool == 'atomMinus')
		{
			this.dragType = DraggingTool.Charge;
			this.toolChargeDelta = -1;
		}
		else if (tool.startsWith('bond'))
		{
			this.dragType = DraggingTool.Bond;
			this.toolBondOrder = 1;
			this.toolBondType = Molecule.BONDTYPE_NORMAL;
			
			if (tool =='bondOrder0') this.toolBondOrder = 0;
			else if (tool =='bondOrder2') this.toolBondOrder = 2;
			else if (tool =='bondOrder3') this.toolBondOrder = 3;
			else if (tool =='bondUnknown') this.toolBondType = Molecule.BONDTYPE_UNKNOWN;
			else if (tool =='bondInclined') this.toolBondType = Molecule.BONDTYPE_INCLINED;
			else if (tool =='bondDeclined') this.toolBondType = Molecule.BONDTYPE_DECLINED;
			
			this.dragGuides = this.determineDragGuide(this.toolBondOrder);
		}
		else if (tool.startsWith('element'))
		{
			this.dragType = DraggingTool.Atom;
			this.toolAtomSymbol = tool.substring(7);
			this.dragGuides = this.determineDragGuide(1);
		}*/
	}
	private mouseUp(event:JQueryEventObject):void
	{
		if (this.activeIndex >= 0)
		{
			let [x, y] = eventCoords(event, this.content);
			let comp = this.pickComponent(x, y);
			if (comp == this.activeIndex) this.selectedIndex = comp;
			this.activeIndex = -1;
			this.delayedRedraw();
		}

		/*
		// if the mouse hasn't moved, it's a click operation
		if (!this.opBudged)
		{
			let xy = eventCoords(event, this.container);

			let clickObj = this.pickObject(xy[0], xy[1]);
			let clickAtom = clickObj > 0 ? clickObj : 0, clickBond = clickObj < 0 ? -clickObj : 0;

			//let tool = 'finger';
			//if (this.toolView != null && this.toolView.selectedButton) tool = this.toolView.selectedButton;

			if (this.dragType == DraggingTool.Press)
			{
				// special key modifiers for the arrow tool:
				//		CTRL: open context menu [see mouseDown]
				//		SHIFT: toggle selection of object
				//		ALT: enter pan-mode [see mouseDown]
				//		ALT+CTRL: enter zoom mode [see mouseDown]
			
				if (!this.opShift && !this.opCtrl && !this.opAlt)
				{
					if (clickAtom == 0 && clickBond == 0)
					{
						if (Vec.anyTrue(this.selectedMask)) this.selectedMask = null;
						else if (this.currentAtom > 0) this.currentAtom = 0;
						else if (this.currentBond > 0) this.currentBond = 0;
					}
					else if (clickAtom != this.currentAtom || clickBond != this.currentBond)
					{
						this.currentAtom = clickAtom;
						this.currentBond = clickBond;
						this.delayedRedraw();
					}
					else if (clickAtom == 0 && clickBond == 0 && this.anySelected())
					{
						this.selectedMask = null;
						this.delayedRedraw();
					}
				}
				else if (this.opShift && !this.opCtrl && !this.opAlt)
				{
					// !! toggle selected state of clickobj...
				}
			}
			....
		
		this.dragType = DraggingTool.None;
		this.lassoX = null;
		this.lassoY = null;
		this.lassoMask = null;
		this.dragGuides = null;
		this.delayedRedraw();*/
	}
	private mouseOver(event:JQueryEventObject):void
	{
		this.updateHoverCursor(event);
	}
	private mouseOut(event:JQueryEventObject):void
	{
		this.updateHoverCursor(event);
	}
	private mouseMove(event:JQueryEventObject):void
	{
		this.updateHoverCursor(event);

		/*
		if (this.dragType == DraggingTool.None) return; // mouse button isn't pressed

		let xy = eventCoords(event, this.container);
		
		}*/
	}
	private keyPressed(event:JQueryEventObject):void
	{
		//let ch = String.fromCharCode(event.keyCode || event.charCode);
		//console.log('PRESSED['+ch+'] key='+event.keyCode+' chcode='+event.charCode);
	}
	private keyDown(event:JQueryEventObject):void
	{
		/*let key = event.keyCode;
		//console.log('DOWN: key='+key);

		// special deal for the escape key: if any bank needs to be popped, consume it 
		if (key == 27)
		{
			for (let view of [this.templateView, this.commandView, this.toolView]) if (view != null && view.stackSize > 1)
			{
				view.popBank(); 
				event.preventDefault(); 
				return;
			}
		}

		// non-modifier keys that don't generate a 'pressed' event		
		if (key == 37) {} // left
		else if (key == 39) {} // right
		else if (key == 38) {} // up
		else if (key == 40) {} // down
		else if ([27, 8, 46].indexOf(key) >= 0)
		{
			if (this.toolView != null && this.toolView.topBank.claimKey(event)) {event.preventDefault(); return;}
			if (this.commandView != null && this.commandView.topBank.claimKey(event)) {event.preventDefault(); return;}
			if (this.templateView != null && this.templateView.topBank.claimKey(event)) {event.preventDefault(); return;}
		} */
		
		// !! do something interesting when modifier keys are held down?
	}
	private keyUp(event:JQueryEventObject):void
	{
		// !!
	}
	private mouseWheel(event:JQueryEventObject):void
	{
		/* !! reinstate
		let xy = eventCoords(event, this.container);
		let newScale = this.scale * (1 - event.deltaY * 0.1);
		newScale = Math.min(10, Math.max(0.1, newScale));
		let newOX = xy[0] - (newScale / this.scale) * (xy[0] - this.offsetX);
		let newOY = xy[1] - (newScale / this.scale) * (xy[1] - this.offsetY);

		this.scale = newScale;
		this.offsetX = newOX;
		this.offsetY = newOY;

		this.delayedRedraw();
		
		event.stopPropagation = true;
		*/
	}
}

/* EOF */ }