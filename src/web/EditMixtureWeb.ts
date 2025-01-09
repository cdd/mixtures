/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2025 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Molecule} from 'webmolkit/mol/Molecule';
import {ClipboardProxy} from 'webmolkit/ui/ClipboardProxy';
import {MenuProxy, MenuProxyContext} from 'webmolkit/ui/MenuProxy';
import {deepClone, eventCoords} from 'webmolkit/util/util';
import {Vec} from 'webmolkit/util/Vec';
import {MoleculeStream} from 'webmolkit/io/MoleculeStream';
import {CoordUtil} from 'webmolkit/mol/CoordUtil';
import {EditMixture} from './EditMixture';

/*
	Specialisation of the EditMixture class that works in a regular web environment.
*/

export class EditMixtureWeb extends EditMixture
{
	public callbackLookup:(editor:EditMixtureWeb) => void = null; // optional: added to context menu if defined
	public callbackStructureEditor:(mol:Molecule, onSuccess:(mol:Molecule) => void) => void = null; // optional editor replacement
	public callbackFreeformKey:(edit:EditMixture, event:KeyboardEvent) => void = null;

	private isMacKeyboard:boolean;

	// ------------ public methods ------------

	constructor(proxyClip:ClipboardProxy, proxyMenu?:MenuProxy)
	{
		super(null, proxyClip, proxyMenu);

		// the 'navigator' object is being overhauled: it should have a more structured userAgentData property on most browsers; if not it
		// falls back to the older .platform property, which will trigger a deprecation warning on a browser; but for Electron context, it's OK
		let nav = navigator as any;
		this.isMacKeyboard = nav.userAgentData ? nav.userAgentData.platform == 'macOS' : nav.platform.startsWith('Mac');
	}

	public render(parent:any):void
	{
		super.render(parent);
	}

	// ------------ private methods ------------

	protected contextMenu(event:MouseEvent):void
	{
		event.preventDefault();
		if (!this.isReceivingCommands()) return;

		let [x, y] = eventCoords(event, this.contentDOM);
		let idx = this.pickComponent(x, y);

		this.selectedIndex = idx;
		this.activeIndex = -1;
		this.delayedRedraw();

		let menu:MenuProxyContext[] = [];

		if (idx >= 0)
		{
			let comp = this.layout.components[idx].content, origin = this.layout.components[idx].origin;
			let sel = ():void => this.selectComponent(idx);

			menu.push({label: 'Edit Structure', click: () => {sel(); this.editStructure();}});
			menu.push({label: 'Edit Details', click: () => {sel(); this.editDetails();}});
			if (this.callbackLookup)
			{
				menu.push({label: 'Lookup', click: () => this.callbackLookup(this)});
			}
			menu.push({label: 'Append', click: () => {sel(); this.appendToCurrent();}});
			menu.push({label: 'Prepend', click: () => {sel(); this.prependBeforeCurrent();}});
			if (origin.length > 0)
			{
				menu.push({label: 'Insert Before', click: () => {sel(); this.insertBeforeCurrent();}});
				menu.push({label: 'Insert After', click: () => {sel(); this.insertAfterCurrent();}});
				menu.push({label: 'Delete', click: () => {sel(); this.deleteCurrent();}});

				if (origin[origin.length - 1] > 0)
					menu.push({label: 'Move Up', click: () => {sel(); this.reorderCurrent(-1);}});
				if (origin[origin.length - 1] < Vec.arrayLength(this.mixture.getParentComponent(origin).contents) - 1)
					menu.push({label: 'Move Down', click: () => {sel(); this.reorderCurrent(1);}});
			}

			menu.push({label: 'Copy', click: () => {sel(); this.clipboardCopy(false);}});
			if (Vec.arrayLength(comp.contents) > 0)
				menu.push({label: 'Copy Branch', click: () => {sel(); this.clipboardCopy(false, true);}});
			if (origin.length > 0)
				menu.push({label: 'Cut', click: () => {sel(); this.clipboardCopy(true);}});

			if (Vec.notBlank(comp.contents))
			{
				let label = this.layout.components[idx].isCollapsed ? 'Expand Branch' : 'Collapse Branch';
				menu.push({label: label, click: () => this.toggleCollapsed(idx)});
			}
		}
		else
		{
			menu.push({label: 'Zoom In', click: () => this.zoom(1.25)});
			menu.push({label: 'Zoom Out', click: () => this.zoom(0.8)});
		}

		this.proxyMenu.openContextMenu(menu, event);
	}

	protected keyDown(event:KeyboardEvent):void
	{
		if (!this.isReceivingCommands()) return;

		let key = event.keyCode;

		//let cmd = event.ctrlKey;
		let mod = '';
		if (event.shiftKey) mod += 'S';
		if (event.altKey) mod += 'A';
		/*if (/^(Mac|iPhone|iPod|iPad)/i.test(navigator.platform))
		{
			if (event.metaKey) mod += 'X';
			if (event.ctrlKey) mod += 'C';
		}
		else
		{
			if (event.ctrlKey) mod += 'X';
		}*/
		//if (event.ctrlKey || event.metaKey) mod += 'X';
		if (this.isMacKeyboard)
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
		else if (event.key == 'l' && mod == 'X') {if (this.callbackLookup) this.callbackLookup(this);}
		else if (event.key == '/' && mod == 'X') this.appendToCurrent();
		else if (event.key == '\\' && mod == 'X') this.prependBeforeCurrent();
		else if (event.key == ';' && mod == 'X') this.insertBeforeCurrent();
		else if (event.key == '\'' && mod == 'X') this.insertAfterCurrent();
		else if (event.key == 'Delete' && mod == 'X') this.deleteCurrent();
		else if (event.key == 'ArrowUp' && mod == 'X') this.reorderCurrent(-1);
		else if (event.key == 'ArrowDown' && mod == 'X') this.reorderCurrent(-1);
		else if (event.key == 'z' && mod == 'X') this.performUndo();
		else if (event.key == 'Z' && mod == 'X') this.performRedo();
		else if (event.key == 'C' && mod == 'X') this.clipboardCopy(false, true);
		else if (event.key == '0' && mod == 'X') this.zoomFull();
		else if (event.key == '=' && mod == 'X') this.zoom(1.25);
		else if (event.key == '-' && mod == 'X') this.zoom(0.8);
		else if (this.callbackFreeformKey && (!mod || mod == 'S') && /^[A-Za-z0-9 ]$/.test(event.key)) this.callbackFreeformKey(this, event);
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
		if (!this.callbackStructureEditor)
		{
			super.editStructure();
			return;
		}

		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);
		let mol = comp.molfile ? MoleculeStream.readUnknown(comp.molfile) : null;

		this.isEditing = true;
		this.callbackStructureEditor(mol, (mol) =>
		{
			this.isEditing = false;

			comp = deepClone(comp);
			this.checkStructureIntegrity(comp, mol);

			CoordUtil.normaliseBondDistances(mol);
			let molfile = mol && mol.numAtoms > 0 ? MoleculeStream.writeMDLMOL(mol) : undefined;
			if (!molfile) molfile = null;

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

