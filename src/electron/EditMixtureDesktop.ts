/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {ClipboardProxy} from 'webmolkit/ui/ClipboardProxy';
import {MenuProxy} from 'webmolkit/ui/MenuProxy';
import {eventCoords} from 'webmolkit/util/util';
import {Vec} from 'webmolkit/util/Vec';
import {Menu as ElectronMenu, MenuItem as ElectronMenuItem, getCurrentWindow} from '@electron/remote';
import {InChIDelegate} from '../mixture/InChIDelegate';
import {EditMixture} from '../web/EditMixture';

/*
	Specialisation of the EditMixture class that tasks advantage of desktop (Electron) capabilities.
*/

export class EditMixtureDesktop extends EditMixture
{
	constructor(inchi:InChIDelegate, proxyClip:ClipboardProxy, proxyMenu:MenuProxy)
	{
		super(inchi, proxyClip, proxyMenu);
	}

	protected contextMenu(event:MouseEvent):void
	{
		if (this.callbackInteraction) this.callbackInteraction();

		event.preventDefault();
		if (!this.isReceivingCommands()) return;

		let [x, y] = eventCoords(event, this.contentDOM);
		let idx = this.pickComponent(x, y);

		this.selectedIndex = idx;
		this.activeIndex = -1;
		this.delayedRedraw();

		let menu = new ElectronMenu();
		if (idx >= 0)
		{
			let comp = this.layout.components[idx].content, origin = this.layout.components[idx].origin;
			let sel = ():void => this.selectComponent(idx);
			menu.append(new ElectronMenuItem({label: 'Edit Structure', click: () => {sel(); this.editStructure();}}));
			menu.append(new ElectronMenuItem({label: 'Edit Details', click: () => {sel(); this.editDetails();}}));
			menu.append(new ElectronMenuItem({label: 'Lookup Name', click: () => {sel(); this.lookupCurrent();}}));
			menu.append(new ElectronMenuItem({label: 'Append', click: () => {sel(); this.appendToCurrent();}}));
			menu.append(new ElectronMenuItem({label: 'Prepend', click: () => {sel(); this.prependBeforeCurrent();}}));
			if (origin.length > 0)
			{
				menu.append(new ElectronMenuItem({label: 'Insert Before', click: () => {sel(); this.insertBeforeCurrent();}}));
				menu.append(new ElectronMenuItem({label: 'Insert After', click: () => {sel(); this.insertAfterCurrent();}}));
				menu.append(new ElectronMenuItem({label: 'Delete', click: () => {this.selectComponent(idx); this.deleteCurrent();}}));

				if (origin[origin.length - 1] > 0)
					menu.append(new ElectronMenuItem({label: 'Move Up', click: () => {sel(); this.reorderCurrent(-1);}}));
				if (origin[origin.length - 1] < Vec.arrayLength(this.mixture.getParentComponent(origin).contents) - 1)
					menu.append(new ElectronMenuItem({label: 'Move Down', click: () => {sel(); this.reorderCurrent(1);}}));
			}

			menu.append(new ElectronMenuItem({label: 'Copy', click: () => {sel(); this.clipboardCopy(false);}}));
			if (Vec.arrayLength(comp.contents) > 0)
				menu.append(new ElectronMenuItem({label: 'Copy Branch', click: () => {sel(); this.clipboardCopy(false, true);}}));
			if (origin.length > 0)
				menu.append(new ElectronMenuItem({label: 'Cut', click: () => {sel(); this.clipboardCopy(true);}}));
			menu.append(new ElectronMenuItem({label: 'Paste', click: () => {sel(); this.clipboardPaste();}}));

			if (Vec.notBlank(comp.contents))
			{
				let label = this.layout.components[idx].isCollapsed ? 'Expand Branch' : 'Collapse Branch';
				menu.append(new ElectronMenuItem({label: label, click: () => this.toggleCollapsed(idx)}));
			}
		}
		else
		{
			menu.append(new ElectronMenuItem({label: 'Zoom In', click: () => this.zoom(1.25)}));
			menu.append(new ElectronMenuItem({label: 'Zoom Out', click: () => this.zoom(0.8)}));
		}

		menu.popup({window: getCurrentWindow()});
	}

}
