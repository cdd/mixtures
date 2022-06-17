/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	A pure web entrypoint into the Mixfile Editor, which does not rely on Electron. It can be embedded into any regular web page.
	The presentation is different to the standalone desktop entrypoint, because it's a widget that it embedded on a page, rather than
	a whole window of its own. It doesn't get to have menus, or the right mouse button, the ability to contact 3rd party sites
	(e.g. lookup molecules) or to run command line tools (e.g. for InChI/MInChI). Other than that, though, the basic functionality is
	equivalent.
*/

const BANNER:MenuBannerButton[][] =
[
	[
		{'icon': 'CommandEdit.svg', 'tip': 'Edit component', 'cmd': MenuBannerCommand.EditDetails},
		{'icon': 'CommandStructure.svg', 'tip': 'Edit structure', 'cmd': MenuBannerCommand.EditStructure},
		{'icon': 'CommandLookup.svg', 'tip': 'Lookup compound', 'cmd': MenuBannerCommand.Lookup},
		//{'icon': 'CommandPicture.svg', 'tip': 'Export graphics', 'cmd': MenuBannerCommand.ExportSVG},
	],
	[
		{'icon': 'CommandAppend.svg', 'tip': 'Append component', 'cmd': MenuBannerCommand.Append},
		{'icon': 'CommandPrepend.svg', 'tip': 'Prepend component', 'cmd': MenuBannerCommand.Prepend},
		{'icon': 'CommandInsertBefore.svg', 'tip': 'Insert component above', 'cmd': MenuBannerCommand.InsertBefore},
		{'icon': 'CommandInsertAfter.svg', 'tip': 'Append component below', 'cmd': MenuBannerCommand.InsertAfter},
		{'icon': 'CommandDelete.svg', 'tip': 'Delete', 'cmd': MenuBannerCommand.Delete},
		{'icon': 'CommandMoveUp.svg', 'tip': 'Move Up', 'cmd': MenuBannerCommand.MoveUp},
		{'icon': 'CommandMoveDown.svg', 'tip': 'Move Down', 'cmd': MenuBannerCommand.MoveDown},
	],
	[
		{'icon': 'CommandUndo.svg', 'tip': 'Undo', 'cmd': MenuBannerCommand.Undo},
		{'icon': 'CommandRedo.svg', 'tip': 'Redo', 'cmd': MenuBannerCommand.Redo},
	],
	[
		{'icon': 'CommandCopy.svg', 'tip': 'Copy', 'cmd': MenuBannerCommand.Copy},
		{'icon': 'CommandCut.svg', 'tip': 'Cut', 'cmd': MenuBannerCommand.Cut},
	],
	[
		{'icon': 'CommandZoomNormal.svg', 'tip': 'Zoom full', 'cmd': MenuBannerCommand.ZoomFull},
		{'icon': 'CommandZoomIn.svg', 'tip': 'Zoom in', 'cmd': MenuBannerCommand.ZoomIn},
		{'icon': 'CommandZoomOut.svg', 'tip': 'Zoom out', 'cmd': MenuBannerCommand.ZoomOut},
	],
];

const CSS_WIDGET =
`
	*.mixtures-webwidget-overlay
	{
		opacity: 0;
	}
	*.mixtures-webwidget-overlay-fadein
	{
		opacity: 1;
		transition: opacity 1s;
	}
	*.mixtures-webwidget-overlay-fadeout
	{
		opacity: 0;
		transition: opacity 1s;
	}
`;

interface WebWidgetPopover
{
	anchor:MenuBannerCommand; // null = the root component; otherwise one of the icons on the menu banner
	textLines:string[]; // some number of lines to show
}

export class WebWidget extends wmk.Widget
{
	public callbackGoBack:() => void = null; // optional: gets an icon if defined
	public callbackLookup:(editor:EditMixtureWeb) => void = null; // optional: gets an icon if defined
	public callbackEditStructure:(molfile:string, callbackSuccess:(molfile:string) => void, callbackClose:() => void) => void = null;
	public callbackFreeformKey:(edit:EditMixture, event:KeyboardEvent) => void = null;

	public banner:MenuBanner;
	public editor:EditMixtureWeb = null;

	private divMenu:DOM;
	private divMain:DOM;

	private initialPopovers:WebWidgetPopover[] = [];

	private isMacKeyboard:boolean;

	// ------------ public methods ------------

	constructor(public proxyClip?:wmk.ClipboardProxy, public proxyMenu?:wmk.MenuProxy)
	{
		super();

		if (!this.proxyClip) this.proxyClip = new wmk.ClipboardProxyWeb();
		if (!this.proxyMenu) this.proxyMenu = new wmk.MenuProxyWeb();

		// the 'navigator' object is being overhauled: it should have a more structured userAgentData property on most browsers; if not it
		// falls back to the older .platform property, which will trigger a deprecation warning on a browser; but for Electron context, it's OK
		let nav = navigator as any; 
		this.isMacKeyboard = nav.userAgentData ? nav.userAgentData.platform == 'macOS' : nav.platform.startsWith('Mac');

		let handler = new wmk.ClipboardProxyHandler();
		handler.copyEvent = (andCut:boolean, proxy:wmk.ClipboardProxy):boolean =>
		{
			this.menuAction(andCut ? MenuBannerCommand.Cut : MenuBannerCommand.Copy);
			return true;
		};
		handler.pasteEvent = (proxy:wmk.ClipboardProxy):boolean =>
		{
			this.menuAction(MenuBannerCommand.Paste);
			return true;
		};
		this.proxyClip.pushHandler(handler);
	}

	public render(parent:any, width?:number, height?:number):void
	{
		super.render(parent);

		wmk.installInlineCSS('mixtures-webwidget', CSS_WIDGET);

		let content = this.contentDOM;
		content.el.id = 'mixtureEditorWidget';

		let bannerContent = deepClone(BANNER);
		if (this.callbackGoBack)
		{
			let back:MenuBannerButton = {'icon': 'CommandBack.svg', 'tip': null/*'Back'*/, 'cmd': MenuBannerCommand.Back};
			bannerContent.unshift([back]);
		}

		let mapButton:Record<string, MenuBannerButton> = {};
		for (let list of bannerContent) for (let btn of list) mapButton[btn.cmd] = btn;

		let action = this.isMacKeyboard ? 'Command' : 'Ctrl';

		mapButton[MenuBannerCommand.EditDetails].tip += ` (${action}+Enter)`;
		mapButton[MenuBannerCommand.EditStructure].tip += ' (Shift+Enter)';
		mapButton[MenuBannerCommand.Lookup].tip += ` (${action}+L)`;
		mapButton[MenuBannerCommand.Append].tip += ` (${action}+/)`;
		mapButton[MenuBannerCommand.Prepend].tip += ` (${action}+\\)`;
		mapButton[MenuBannerCommand.InsertBefore].tip += ` (${action}+;)`;
		mapButton[MenuBannerCommand.InsertAfter].tip += ` (${action}+')`;
		mapButton[MenuBannerCommand.Delete].tip += ` (${action}+Delete)`;
		mapButton[MenuBannerCommand.MoveUp].tip += ` (${action}+Up)`;
		mapButton[MenuBannerCommand.MoveDown].tip += ` (${action}+Down)`;
		mapButton[MenuBannerCommand.Undo].tip += ` (${action}+Z)`;
		mapButton[MenuBannerCommand.Redo].tip += ` (${action}+Shift+Z)`;
		mapButton[MenuBannerCommand.Copy].tip += ` (${action}+C)`;
		mapButton[MenuBannerCommand.Cut].tip += ` (${action}+X)`;
		mapButton[MenuBannerCommand.ZoomFull].tip += ` (${action}+0)`;
		mapButton[MenuBannerCommand.ZoomIn].tip += ` (${action}+-)`;
		mapButton[MenuBannerCommand.ZoomOut].tip += ` (${action}+=)`;

		if (!this.callbackLookup)
		{
			outer: for (let blk of bannerContent) for (let n = 0; n < blk.length; n++)
				if (blk[n].cmd == MenuBannerCommand.Lookup) {blk.splice(n, 1); break outer;}
		}
		this.banner = new MenuBanner(bannerContent, (cmd:MenuBannerCommand) => this.menuAction(cmd));

		this.editor = new EditMixtureWeb(this.proxyClip, this.proxyMenu);
		this.editor.callbackUpdateTitle = () => {};
		this.editor.callbackFreeformKey = this.callbackFreeformKey;
		this.editor.callbackLookup = this.callbackLookup;

		if (this.callbackEditStructure)
		{
			this.editor.callbackStructureEditor = (mol, callbackSuccess:(mol:wmk.Molecule) => void) =>
			{
				this.proxyClip.pushHandler(null);
				if (!mol) mol = new wmk.Molecule();
				let molfile = new wmk.MDLMOLWriter(mol).write();
				this.editor.setEditing(true);
				this.callbackEditStructure(molfile,
					(molfile:string):void =>
					{
						mol = molfile ? new wmk.MDLMOLReader(molfile).parse() : mol;
						callbackSuccess(mol);
					},
					():void =>
					{
						this.proxyClip.popHandler();
						this.editor.setEditing(false);
						this.editor.refocus();
					});
			};
		}

		if (width) content.setCSS('width', `${width}px`);
		if (height) content.setCSS('height', `${height}px`);
		content.css({'border': '1px solid black', 'display': 'grid'});
		content.css({'grid-template-rows': '[start banner] auto [editor] 1fr [end]'});

		this.divMenu = dom('<div/>').appendTo(content).css({'grid-area': 'banner / 1'});
		this.divMain = dom('<div/>').appendTo(content).css({'grid-area': 'editor / 1', 'position': 'relative'});
		let divMainX = dom('<div style="position: absolute; top: 0; right: 0; bottom: 0; left: 0;"/>').appendTo(this.divMain); // workaround

		this.banner.render(this.divMenu);
		this.editor.render(divMainX);

		this.banner.callbackRefocus = () => this.editor.refocus();

		setTimeout(() => this.displayPopovers(), 100);
	}

	public cleanup():void
	{
		this.proxyClip.popHandler();
	}

	public isBlank():boolean
	{
		return this.editor.isBlank();
	}

	public getMixture():Mixture
	{
		return this.editor.getMixture();
	}

	public setMixture(mixture:Mixture, dirty = false):void
	{
		this.editor.clearHistory();
		this.editor.setMixture(mixture, true, false);
		this.editor.setDirty(dirty);
	}

	public menuAction(cmd:MenuBannerCommand):void
	{
		if (this.editor.callbackInteraction) this.editor.callbackInteraction();

		let dlg = this.editor.compoundEditor();
		if (dlg)
		{
			if (cmd == MenuBannerCommand.Cut) dlg.actionCut();
			else if (cmd == MenuBannerCommand.Copy) dlg.actionCopy();
			else if (cmd == MenuBannerCommand.Paste) dlg.actionPaste();
			else if (cmd == MenuBannerCommand.Undo) dlg.actionUndo();
			else if (cmd == MenuBannerCommand.Redo) dlg.actionRedo();
			return;
		}
		if (!this.editor.isReceivingCommands())
		{
			// certain common menu/shortcut commands are passed through to standard behaviour, the rest are stopped
			if ([MenuBannerCommand.Cut, MenuBannerCommand.Copy, MenuBannerCommand.Paste,
				 MenuBannerCommand.Undo, MenuBannerCommand.Redo].indexOf(cmd) >= 0) document.execCommand(cmd);
			return;
		}

		if (cmd == MenuBannerCommand.ExportSDF) this.actionExportSDF();
		//else if (cmd == MenuBannerCommand.ExportSVG) this.actionFileExportSVG();
		//else if (cmd == MenuBannerCommand.CreateMInChI) this.actionFileCreateMInChI();
		else if (cmd == MenuBannerCommand.Undo) this.editor.performUndo();
		else if (cmd == MenuBannerCommand.Redo) this.editor.performRedo();
		else if (cmd == MenuBannerCommand.Cut) this.editor.clipboardCopy(true);
		else if (cmd == MenuBannerCommand.Copy) this.editor.clipboardCopy(false);
		else if (cmd == MenuBannerCommand.CopyBranch) this.editor.clipboardCopy(false, true);
		else if (cmd == MenuBannerCommand.Paste) this.editor.clipboardPaste();
		else if (cmd == MenuBannerCommand.EditStructure) this.editor.editStructure();
		else if (cmd == MenuBannerCommand.EditDetails) this.editor.editDetails();
		else if (cmd == MenuBannerCommand.Lookup) this.callbackLookup(this.editor);
		else if (cmd == MenuBannerCommand.Delete) this.editor.deleteCurrent();
		else if (cmd == MenuBannerCommand.Append) this.editor.appendToCurrent();
		else if (cmd == MenuBannerCommand.Prepend) this.editor.prependBeforeCurrent();
		else if (cmd == MenuBannerCommand.InsertBefore) this.editor.insertBeforeCurrent();
		else if (cmd == MenuBannerCommand.InsertAfter) this.editor.insertAfterCurrent();
		else if (cmd == MenuBannerCommand.MoveUp) this.editor.reorderCurrent(-1);
		else if (cmd == MenuBannerCommand.MoveDown) this.editor.reorderCurrent(1);
		else if (cmd == MenuBannerCommand.ZoomFull) this.editor.zoomFull();
		else if (cmd == MenuBannerCommand.ZoomIn) this.editor.zoom(1.25);
		else if (cmd == MenuBannerCommand.ZoomOut) this.editor.zoom(0.8);
		else if (cmd == MenuBannerCommand.Back) this.callbackGoBack();
	}

	// specify a popup that should be displayed at the beginning of the session
	public addInitialPopover(anchor:MenuBannerCommand, textLines:string[]):void
	{
		this.initialPopovers.push({anchor, textLines});
	}

	// ------------ private methods ------------

	private actionExportSDF():void
	{
		let mixture = this.editor.getMixture();
		if (mixture.isEmpty()) return;

		let exportSDF = new ExportSDFile();
		exportSDF.append(mixture.mixfile);
		let sdfile = exportSDF.write();

		this.downloadFile('mixture.sdf', sdfile);
	}
	private actionExportSVG():void
	{
		let policy = wmk.RenderPolicy.defaultColourOnWhite();
		let measure = new wmk.OutlineMeasurement(0, 0, policy.data.pointScale);
		let layout = new ArrangeMixture(this.editor.getMixture(), measure, policy);
		layout.arrange();

		let gfx = new wmk.MetaVector();
		new DrawMixture(layout, gfx).draw();
		gfx.normalise();
		let svg = gfx.createSVG();

		this.downloadFile('mixture.svg', svg);
	}

	private downloadFile(fn:string, content:string):void
	{
		let a = window.document.createElement('a');
		a.href = window.URL.createObjectURL(new Blob([content], {'type': 'application/octet-stream'}));
		a.download = fn;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	private displayPopovers():void
	{
		if (!this.editor.getMixture().isEmpty() || !this.contentDOM) return;

		wmk.FontData.main.initNativeFont();

		let divCover = dom('<div/>').appendTo(this.contentDOM).css({'grid-area': 'start / 1 / end / 1', 'pointer-events': 'none', 'z-index': '1000'}).class('mixtures-webwidget-overlay');
		setTimeout(() => 
		{
			if (divCover) divCover.addClass('mixtures-webwidget-overlay-fadein');
		}, 200);

		for (let popover of this.initialPopovers)
		{
			let box:wmk.Box;
			if (popover.anchor)
			{
				box = this.banner.iconPosition(popover.anchor);
				box.x += this.divMenu.elHTML.offsetLeft;
				box.y += this.divMenu.elHTML.offsetTop;
			}
			else
			{
				box = this.editor.getComponentPosition([]);
				box.x += this.divMain.elHTML.offsetLeft;
				box.y += this.divMain.elHTML.offsetTop;
			}
			this.renderPopover(divCover, box, popover.textLines);
		}

		let removeCover = ():void =>
		{
			if (!divCover) return;
			let div = divCover;
			divCover = null;

			div.addClass('mixtures-webwidget-overlay-fadeout');
			setTimeout(() => div.remove(), 1100);
		};

		this.editor.callbackInteraction = removeCover;
	}

	private renderPopover(parent:DOM, avoidBox:wmk.Box, textLines:string[]):void
	{
		const FONT = 'sans-serif', FSZ = 15;

		let outerW = parent.width(), outerH = parent.height();

		let textW = 0, ascent = 0, descent = 0;
		for (let line of textLines)
		{
			let wad = wmk.FontData.measureTextNative(line, FONT, FSZ);
			textW = Math.max(textW, wad[0]);
			[ascent, descent] = [wad[1], wad[2]];
		}
		const BETW = 3;
		let lineH = ascent + descent + BETW, textH = lineH * textLines.length - BETW - descent;

		const PADDING = 6, NIPPLEW = 5, NIPPLEH = 10, ROUND = 4;

		let totalW = textW + 2 * PADDING, totalH = textH + 2 * PADDING + NIPPLEH;

		let box = new wmk.Box(avoidBox.midX() - 0.5 * totalW, avoidBox.maxY() + 2, totalW, totalH);
		box.x = Math.min(outerW - totalW, Math.max(0, box.x));

		let div = dom('<div/>').appendTo(parent).css({'position': 'absolute'});
		div.setBoundaryPixels(box.x, box.y, box.w, box.h);

		let gfx = new wmk.MetaVector();
		gfx.setSize(totalW, totalH);

		let nx = avoidBox.midX() - box.x;
		let x1 = 0.5, x2 = ROUND, x3 = nx - NIPPLEW, x4 = nx, x5 = nx + NIPPLEW, x6 = box.w - ROUND, x7 = box.w - 0.5;
		let y1 = 0.5, y2 = NIPPLEH, y3 = NIPPLEH + ROUND, y4 = box.h - ROUND, y5 = box.h - 0.5;
		let ptlist:[number, number, boolean][] =
		[
			[x4, y1, false],
			[x3, y2, false],
			[x2, y2, false],
			[x1, y2, true],
			[x1, y3, false],
			[x1, y4, false],
			[x1, y5, true],
			[x2, y5, false],
			[x6, y5, false],
			[x7, y5, true],
			[x7, y4, false],
			[x7, y3, false],
			[x7, y2, true],
			[x6, y2, false],
			[x5, y2, false],
		];
		gfx.drawPath(ptlist.map((pt) => pt[0]), ptlist.map((pt) => pt[1]), ptlist.map((pt) => pt[2]), true, 0x000000, 1, 0xC0E0FF, false);

		for (let n = 0; n < textLines.length; n++)
		{
			let x = PADDING, y = NIPPLEH + PADDING + lineH * n + ascent;
			gfx.drawTextNative(x, y, textLines[n], FONT, FSZ, 0x000000);
		}
		dom(gfx.createSVG()).appendTo(div).css({'pointer-events': 'none', 'display': 'block'});
	}
}

/* EOF */ }