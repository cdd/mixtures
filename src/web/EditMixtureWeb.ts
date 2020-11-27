/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../mixture/EditMixture.ts'/>

namespace Mixtures /* BOF */ {

/*
	Modified version of the EditMixture class that replaces the default Electron desktop functionality
	with web-compatible equivalents.
*/

export class EditMixtureWeb extends EditMixture
{
	public onLookup:(editor:EditMixtureWeb) => void = null; // optional: added to context menu if defined
	public proxyStructureEditor:(mol:wmk.Molecule, onSuccess:(mol:wmk.Molecule) => void) => void = null; // optional editor replacement

	// ------------ public methods ------------

	constructor(proxyClip:wmk.ClipboardProxy, proxyMenu?:wmk.MenuProxy)
	{
		super(proxyClip, proxyMenu);
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
		let idx = this.pickComponent(x, y);

		this.selectedIndex = idx;
		this.activeIndex = -1;
		this.delayedRedraw();

		let menu:wmk.MenuProxyContext[] = [];

		if (idx >= 0)
		{
			let comp = this.layout.components[idx].content, origin = this.layout.components[idx].origin;
			let sel = ():void => this.selectComponent(idx);

			menu.push({'label': 'Edit Structure', 'click': () => {sel(); this.editStructure();}});
			menu.push({'label': 'Edit Details', 'click': () => {sel(); this.editDetails();}});
			if (this.onLookup)
			{
				menu.push({'label': 'Lookup', 'click': () => this.onLookup(this)});
			}
			menu.push({'label': 'Append', 'click': () => {sel(); this.appendToCurrent();}});
			menu.push({'label': 'Prepend', 'click': () => {sel(); this.prependBeforeCurrent();}});
			if (origin.length > 0)
			{
				menu.push({'label': 'Delete', 'click': () => {sel(); this.deleteCurrent();}});

				if (origin[origin.length - 1] > 0)
					menu.push({'label': 'Move Up', 'click': () => {sel(); this.reorderCurrent(-1);}});
				if (origin[origin.length - 1] < Vec.arrayLength(this.mixture.getParentComponent(origin).contents) - 1)
					menu.push({'label': 'Move Down', 'click': () => {sel(); this.reorderCurrent(1);}});
			}

			menu.push({'label': 'Copy', 'click': () => {sel(); this.clipboardCopy(false);}});
			if (Vec.arrayLength(comp.contents) > 0)
				menu.push({'label': 'Copy Branch', 'click': () => {sel(); this.clipboardCopy(false, true);}});
			if (origin.length > 0)
				menu.push({'label': 'Cut', 'click': () => {sel(); this.clipboardCopy(true);}});

			if (Vec.notBlank(comp.contents))
			{
				let label = this.layout.components[idx].isCollapsed ? 'Expand Branch' : 'Collapse Branch';
				menu.push({'label': label, 'click': () => this.toggleCollapsed(idx)});
			}
		}
		else
		{
			menu.push({'label': 'Zoom In', 'click': () => this.zoom(1.25)});
			menu.push({'label': 'Zoom Out', 'click': () => this.zoom(0.8)});
		}

		this.proxyMenu.openContextMenu(menu, event);
	}

	protected keyDown(event:JQueryEventObject):void
	{
		let key = event.keyCode;

		//let cmd = event.ctrlKey;
		let mod = '';
		if (event.shiftKey) mod += 'S';
		if (event.altKey) mod += 'A';
		if (/^(Mac|iPhone|iPod|iPad)/i.test(navigator.platform))
		{
			if (event.metaKey) mod += 'X';
			if (event.ctrlKey) mod += 'C';
		}
		else
		{
			if (event.ctrlKey) mod += 'X';
		}
		
		//console.log(`DOWN: ${event.key} (#${event.keyCode}) mod=${mod}`);

		if (event.key == 'Enter' && mod == 'X') this.editDetails();
		else if (event.key == 'Enter' && mod == 'S') this.editStructure();
		else if (event.key == 'l' && mod == 'X') {if (this.onLookup) this.onLookup(this);}
		else if (event.key == '/' && mod == 'X') this.appendToCurrent();
		else if (event.key == '\\' && mod == 'X') this.prependBeforeCurrent();
		else if (event.key == 'Delete' && mod == 'X') this.deleteCurrent();
		else if (event.key == 'ArrowUp' && mod == 'X') this.reorderCurrent(-1);
		else if (event.key == 'ArrowDown' && mod == 'X') this.reorderCurrent(-1);
		else if (event.key == 'z' && mod == 'X') this.performUndo();
		else if (event.key == 'Z' && mod == 'X') this.performRedo();
		else if (event.key == 'C' && mod == 'X') this.clipboardCopy(false, true);
		else
		{
			super.keyDown(event);
			return;
		}

		event.stopPropagation();
		event.preventDefault();
	}


	public editStructure():void
	{
		if (!this.proxyStructureEditor)
		{
			super.editStructure();
			return;
		}

		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);
		let mol = comp.molfile ? wmk.MoleculeStream.readUnknown(comp.molfile) : null;

		this.proxyStructureEditor(mol, (mol) =>
		{
			wmk.CoordUtil.normaliseBondDistances(mol);
			let molfile = mol && mol.numAtoms > 0 ? wmk.MoleculeStream.writeMDLMOL(mol) : undefined;
			if (!molfile) molfile = null;

			comp = deepClone(comp);
			comp.molfile = molfile;
			let modmix = this.mixture.clone();
			if (modmix.setComponent(origin, comp))
			{
				this.setMixture(modmix);
				this.selectOrigin(origin);
			}
		});
	}
}

/* EOF */ }