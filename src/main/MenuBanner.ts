/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>

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
}

export interface MenuBannerButton
{
	icon:string; // filename
	tip:string; // popup tooltip
	cmd:MenuBannerCommand;
}

export class MenuBanner
{
	private divFlex:JQuery;
	private mapSVG:Record<string, JQuery> = {};
	private mapActive:Record<string, boolean> = {};

	// ------------ public methods ------------

	constructor(private commands:MenuBannerButton[][], private onAction:(cmd:MenuBannerCommand) => void)
	{
	}

	public render(domParent:JQuery):void
	{
		domParent.empty();
		this.divFlex = $('<div/>').appendTo(domParent).css({'display': 'flex', 'width': '100%', 'height': '100%'});
		this.divFlex.css({'flex-direction': 'row', 'flex-wrap': 'nowrap', 'justify-content': 'space-around', 'align-items': 'center'});
		//this.divFlex.css({'linear-gradient': '90deg, #F0F0F0, #808080'});
		this.divFlex.css({'background': 'linear-gradient(to bottom, #FFFFFF, #C0C0C0)'});

		for (let blk of this.commands)
		{
			let divBlk = $('<div/>').appendTo(this.divFlex);
			for (let btn of blk)
			{
				let [div, svg] = this.createCommand(btn);
				divBlk.append(div);
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

	// ------------ private methods ------------

	private createCommand(btn:MenuBannerButton):JQuery[]
	{
		let div = $('<div/>').css({'display': 'inline-block'});
		div.css({'width': '20px', 'height': '20px', 'margin': '2px', 'padding': '5px'});
		div.css({'border-radius': '4px'});
		let svg = $('<img/>').appendTo(div).attr({'src': 'res/img/icons/' + btn.icon});

		div.hover(() => div.css('background-color', this.mapActive[btn.cmd] ? '#C0C0C0' : 'transparent'),
				  () => div.css('background-color', 'transparent'));
		div.click(() =>
		{
			if (!this.mapActive[btn.cmd]) return;
			this.onAction(btn.cmd);
		});
		wmk.addTooltip(div, escapeHTML(btn.tip));

		return [div, svg];
	}
}

/* EOF */ }