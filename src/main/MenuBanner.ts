/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	A banner that goes along the top of the screen and fills up with clickable icons.
*/

export enum MenuBannerCommand
{
	NewMixture = 'newMixture',
	NewCollection = 'newCollection',
	Open = 'open',
	Save = 'save',
	SaveAs = 'saveAs',
	EditDetails = 'editDetails',
	EditStructure = 'editStructure',
	Lookup = 'lookup',
	ExportSVG = 'exportSVG',
	ExportSDF = 'exportSDF',
	CreateMInChI = 'createMInChI',
	Append = 'append',
	Prepend = 'prepend',
	InsertBefore = 'insertBefore',
	InsertAfter = 'insertAfter',
	Delete = 'delete',
	MoveUp = 'moveUp',
	MoveDown = 'moveDown',
	Undo = 'undo',
	Redo = 'redo',
	Copy = 'copy',
	CopyBranch = 'copyBranch',
	Cut = 'cut',
	Paste = 'paste',
	ZoomFull = 'zoomFull',
	ZoomIn = 'zoomIn',
	ZoomOut = 'zoomOut',
	ViewDetail = 'viewDetail',
	ViewCard = 'viewCard',
	Back = 'back',
}

export interface MenuBannerButton
{
	icon:string; // filename
	tip:string; // popup tooltip
	cmd:string;
	width?:number; // optional width override
}

export class MenuBanner
{
	public callbackRefocus:() => void = null;

	private divFlex:JQuery;
	private mapDiv:Record<string, JQuery> = {};
	private mapSVG:Record<string, JQuery> = {};
	private mapActive:Record<string, boolean> = {};
	private selected = new Set<string>();

	// ------------ public methods ------------

	constructor(private commands:MenuBannerButton[][], private onAction:(cmd:string) => void)
	{
	}

	public render(domParent:JQuery):void
	{
		domParent.empty();
		this.divFlex = $('<div/>').appendTo(domParent).css({'display': 'flex', 'width': '100%', 'height': '100%'});
		this.divFlex.css({'flex-direction': 'row', 'flex-wrap': 'nowrap', 'justify-content': 'space-around', 'align-items': 'center'});
		//this.divFlex.css({'linear-gradient': '90deg, #F0F0F0, #808080'});
		this.divFlex.css({'background': 'linear-gradient(to bottom, #FFFFFF, #C0C0C0)'});
		this.divFlex.css({'user-select': 'none' /*, 'pointer-events': 'none'*/});

		this.divFlex.click(() => {if (this.callbackRefocus) this.callbackRefocus();});

		for (let blk of this.commands)
		{
			let divBlk = $('<div/>').appendTo(this.divFlex);
			for (let btn of blk)
			{
				let [div, svg] = this.createCommand(btn);
				divBlk.append(div);
				this.mapDiv[btn.cmd] = div;
				this.mapSVG[btn.cmd] = svg;
				this.mapActive[btn.cmd] = true;
			}
		}
	}

	// switch on/off specific buttons
	public activateButtons(map:Record<string, boolean>):void
	{
		for (let cmd in map)
		{
			let active = this.mapActive[cmd] = map[cmd];
			this.mapSVG[cmd].css('opacity', active ? 1 : 0.5);
		}
	}

	// control over which button(s) are selected
	public addSelected(cmd:string):void
	{
		if (this.selected.has(cmd)) return;
		this.selected.add(cmd);
		this.mapDiv[cmd].css({'background-color': '#D0D0D0'});
	}
	public removeSelected(cmd:string):void
	{
		if (!this.selected.has(cmd)) return;
		this.selected.delete(cmd);
		this.mapDiv[cmd].css({'background-color': 'transparent'});
	}

	// ------------ private methods ------------

	private createCommand(btn:MenuBannerButton):JQuery[]
	{
		let div = $('<div/>').css({'display': 'inline-block'});
		div.attr('id', 'mixtureEditor_btn_' + btn.icon.substring(0, btn.icon.lastIndexOf('.')));
		let width = btn.width ? btn.width : 20;
		div.css({'width': `${width}px`, 'height': '20px', 'margin': '2px', 'padding': '5px'});
		div.css({'border-radius': '4px'});
		if (this.selected.has(btn.cmd)) div.css('background-color', '#D0D0D0');

		let imgURL = wmk.Theme.RESOURCE_URL + '/img/icons/' + btn.icon;
		let svg = $('<img/>').appendTo(div).attr({'src': imgURL});

		div.hover(
			() =>
			{
				let col = this.selected.has(btn.cmd) ? '#D0D0D0' : this.mapActive[btn.cmd] ? '#C0C0C0' : 'transparent';
				div.css('background-color', col);
			},
			() =>
			{
				let col = this.selected.has(btn.cmd) ? '#D0D0D0' : 'transparent';
				div.css('background-color', col);
			});
		div.click(() =>
		{
			if (!this.mapActive[btn.cmd]) return;
			this.onAction(btn.cmd);
		});
		if (btn.tip) wmk.addTooltip(div, escapeHTML(btn.tip));

		return [div, svg];
	}
}

/* EOF */ }