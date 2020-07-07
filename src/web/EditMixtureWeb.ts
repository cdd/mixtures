/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery/index.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/sketcher/Sketcher.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/gfx/Rendering.ts'/>
///<reference path='../../../WebMolKit/src/ui/Widget.ts'/>
///<reference path='../../../WebMolKit/src/ui/ClipboardProxy.ts'/>
///<reference path='../../../WebMolKit/src/ui/MenuProxy.ts'/>
///<reference path='../../../WebMolKit/src/ui/Popup.ts'/>
///<reference path='../../../WebMolKit/src/dialog/EditCompound.ts'/>

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>
///<reference path='../startup.ts'/>
///<reference path='../data/Mixfile.ts'/>
///<reference path='../mixture/EditMixture.ts'/>

namespace Mixtures /* BOF */ {

/*
	Modified version of the EditMixture class that replaces the default Electron desktop functionality
	with web-compatible equivalents.
*/

export class EditMixtureWeb extends EditMixture
{
	public onLookup:(editor:EditMixtureWeb) => void = null; // optional: added to context menu if defined

	// ------------ public methods ------------

	constructor(proxyClip:wmk.ClipboardProxy)
	{
		super(proxyClip);
	}

	public render(parent:any):void
	{
		super.render(parent);
	}

	// ------------ private methods ------------
	
	protected contextMenu(event:JQueryEventObject):void
	{
		event.preventDefault();

		let [x, y] = eventCoords(event, this.content);
		let comp = this.pickComponent(x, y);

		this.selectedIndex = comp;
		this.activeIndex = -1;
		this.delayedRedraw();

		let menu:wmk.MenuProxyContext[] = [];

		if (comp >= 0)
		{
			let compObj = this.layout.components[comp].content, origin = this.layout.components[comp].origin;
			menu.push({'label': 'Edit Structure', 'click': () => {this.selectComponent(comp); this.editStructure();}});
			menu.push({'label': 'Edit Details', 'click': () => {this.selectComponent(comp); this.editDetails();}});
			if (this.onLookup)
			{
				menu.push({'label': 'Lookup', 'click': () => this.onLookup(this)});
			}
			menu.push({'label': 'Append', 'click': () => {this.selectComponent(comp); this.appendToCurrent();}});
			if (origin.length > 0)
			{
				menu.push({'label': 'Prepend', 'click': () => {this.selectComponent(comp); this.prependBeforeCurrent();}});
				menu.push({'label': 'Delete', 'click': () => {this.selectComponent(comp); this.deleteCurrent();}});

				if (origin[origin.length - 1] > 0)
					menu.push({'label': 'Move Up', 'click': () => {this.selectComponent(comp); this.reorderCurrent(-1);}});
				if (origin[origin.length - 1] < Vec.arrayLength(this.mixture.getParentComponent(origin).contents) - 1)
					menu.push({'label': 'Move Down', 'click': () => {this.selectComponent(comp); this.reorderCurrent(1);}});
			}

			menu.push({'label': 'Copy', 'click': () => {this.selectComponent(comp); this.clipboardCopy(false);}});
			if (Vec.arrayLength(compObj.contents) > 0)
				menu.push({'label': 'Copy Branch', 'click': () => {this.selectComponent(comp); this.clipboardCopy(false, true);}});
			if (origin.length > 0)
				menu.push({'label': 'Cut', 'click': () => {this.selectComponent(comp); this.clipboardCopy(true);}});
		}
		else
		{
			menu.push({'label': 'Zoom In', 'click': () => this.zoom(1.25)});
			menu.push({'label': 'Zoom Out', 'click': () => this.zoom(0.8)});
		}

		let divCursor = $('<div/>').appendTo(this.content).css({'position': 'absolute'});
		wmk.setBoundaryPixels(divCursor, x - 5, y - 5, 10, 10);
		let popup = new wmk.Popup(divCursor);
 		popup.callbackPopulate = () =>
		{
			for (let menuItem of menu)
			{
				let div = $('<div/>').appendTo(popup.body());
				div.text(menuItem.label);
				div.hover(() => div.css({'background-color': '#D0D0D0'}), () => div.css({'background-color': 'transparent'}));
				div.css({'cursor': 'pointer'});
				div.click(() => 
				{
					popup.close();
					menuItem.click();
				});
			}
		};
		popup.callbackClose = () => divCursor.remove();
		popup.open();
	}
}

/* EOF */ }