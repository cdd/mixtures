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

export interface MenuBannerCommand
{
	icon:string; // filename
	tip:string; // popup tooltip
	action:() => void; // upon-activate
}

export class MenuBanner
{
	private divFlex:JQuery;

	// ------------ public methods ------------

	constructor(private commands:MenuBannerCommand[][])
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
			for (let cmd of blk) divBlk.append(this.createCommand(cmd));
		}
	}
	
	// ------------ private methods ------------

	private createCommand(cmd:MenuBannerCommand):JQuery
	{
		let div = $('<div/>').css({'display': 'inline-block'});
		div.css({'width': '20px', 'height': '20px', 'margin': '2px', 'padding': '5px'});
		div.css({'border-radius': '4px'});
		$('<img/>').appendTo(div).attr({'src': 'res/img/icons/' + cmd.icon});

		div.hover(() => div.css('background-color', '#C0C0C0'), () => div.css('background-color', 'transparent'));
		div.click(cmd.action);
		wmk.addTooltip(div, escapeHTML(cmd.tip));

		return div;
	}
}

/* EOF */ }