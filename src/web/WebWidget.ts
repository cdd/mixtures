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
	/*[
		{'icon': 'CommandSave.svg', 'tip': 'Save', 'cmd': MenuBannerCommand.Save},
	],*/
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

export class WebWidget extends wmk.Widget
{
	public callbackGoBack:() => void = null; // optional: gets an icon if defined
	public callbackLookup:(editor:EditMixtureWeb) => void = null; // optional: gets an icon if defined
	public callbackEditStructure:(molfile:string, callbackSuccess:(molfile:string) => void, callbackClose:() => void) => void = null;
	public callbackFreeformKey:(edit:EditMixture, event:JQueryEventObject) => void = null;

	//public proxyClip = new wmk.ClipboardProxyWeb();
	public banner:MenuBanner;
	public editor:EditMixtureWeb = null;

	// ------------ public methods ------------

	constructor(public proxyClip?:wmk.ClipboardProxy, public proxyMenu?:wmk.MenuProxy)
	{
		super();

		if (!this.proxyClip) this.proxyClip = new wmk.ClipboardProxyWeb();
		if (!this.proxyMenu) this.proxyMenu = new wmk.MenuProxyWeb();

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

		let bannerContent = deepClone(BANNER);
		if (this.callbackGoBack)
		{
			let back:MenuBannerButton = {'icon': 'CommandBack.svg', 'tip': null/*'Back'*/, 'cmd': MenuBannerCommand.Back};
			bannerContent.unshift([back]);
		}

		let mapButton:Record<string, MenuBannerButton> = {};
		for (let list of bannerContent) for (let btn of list) mapButton[btn.cmd] = btn;

		let action = /^(Mac|iPhone|iPod|iPad)/i.test(navigator.platform) ? 'Command' : 'Ctrl';

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
						this.editor.setEditing(false);
						this.editor.refocus();
					});
			};
		}

		this.content.css({'width': width, 'height': height});
		this.content.css({'border': '1px solid black', 'display': 'flex', 'flex-direction': 'column'});

		let divMenu = $('<div style="width: 100%; flex-grow: 0;"/>').appendTo(this.content);
		let divMain = $('<div style="width: 100%; flex: 1 1 0; height: 100%; position: relative;"/>').appendTo(this.content);
		let divMainX = $('<div style="position: absolute; top: 0; right: 0; bottom: 0; left: 0;"/>').appendTo(divMain); // workaround

		this.banner.render(divMenu);
		this.editor.render(divMainX);

		this.banner.callbackRefocus = () => this.editor.refocus();
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

	// ------------ private methods ------------

	/*private actionClear():void
	{
		this.editor.setMixture(new Mixture(), true, true);
	}
	private actionSave():void
	{
		let str = this.editor.getMixture().serialise();
		this.downloadFile('mixture.mixfile', str);
	}*/
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
}

/* EOF */ }