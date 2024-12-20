/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {dom, DOM} from 'webmolkit/util/dom';
import {MenuBannerCommand} from '../web/MenuBanner';
import {openNewWindow} from './startup';
import {InChI} from '../nodejs/InChI';

/*
	Base class for "main windows": an object that takes up the entire browser window document, responds to resizing, etc.
*/

export abstract class MainPanel
{
	protected inchi = new InChI();

	// ------------ public methods ------------

	constructor(public root:DOM)
	{
		dom('body').css({'overflow': 'hidden'});

		root.css({'width': '100%', 'height': document.documentElement.clientHeight + 'px'});
		window.addEventListener('resize', () => this.onResize());
		root.css({'user-select': 'none'});

		(this.root.el as any).addEventListener('menuAction', (event:any, cmd:string) => this.menuAction(cmd as MenuBannerCommand));
	}

	// stub: may be called early on to provide a source file upon which to work
	public loadFile(filename:string):void
	{
	}

	// minimum required functionality for resizing windows; override to capture
	protected onResize():void
	{
		this.root.css({'height': document.documentElement.clientHeight + 'px'});
	}

	// optionally override this to pre-empt menu actions
	public menuAction(cmd:string):void
	{
		if (cmd == MenuBannerCommand.NewMixture) openNewWindow('MixturePanel');
		else if (cmd == MenuBannerCommand.NewCollection) openNewWindow('CollectionPanel');
		else if (cmd == MenuBannerCommand.Open) this.actionFileOpen();
		else if (cmd == MenuBannerCommand.Save) this.actionFileSave();
		else if (cmd == MenuBannerCommand.SaveAs) this.actionFileSaveAs();
		else this.customMenuAction(cmd);
	}

	// override this to interpret menu non-default menu actions
	public customMenuAction(cmd:string):void
	{
		console.log('MENU:' + cmd);
	}

	// standard actions that must be implemented
	protected abstract actionFileOpen():void;
	protected abstract actionFileSave():void;
	protected abstract actionFileSaveAs():void;

	// ------------ private methods ------------

}

