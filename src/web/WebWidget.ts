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

///<reference path='../decl/node.d.ts'/>
///<reference path='../data/Mixfile.ts'/>
///<reference path='../data/Mixture.ts'/>
///<reference path='../data/Units.ts'/>
///<reference path='../mixture/ArrangeMixture.ts'/>
///<reference path='../mixture/DrawMixture.ts'/>
///<reference path='../mixture/EditMixture.ts'/>
///<reference path='../mixture/ExportSDFile.ts'/>

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
	public onGoBack:() => void = null; // optional: gets an icon if defined
	public onLookup:(editor:EditMixtureWeb) => void = null; // optional: gets an icon if defined

	public proxyClip = new wmk.ClipboardProxyWeb();
	public banner:MenuBanner;
	public editor:EditMixtureWeb = null;

	// ------------ public methods ------------

	constructor()
	{
		super();

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
		if (this.onGoBack)
		{
			let back:MenuBannerButton = {'icon': 'CommandBack.svg', 'tip': null/*'Back'*/, 'cmd': MenuBannerCommand.Back};
			bannerContent.unshift([back]);
		}
		if (!this.onLookup)
		{
			outer: for (let blk of bannerContent) for (let n = 0; n < blk.length; n++)
				if (blk[n].cmd == MenuBannerCommand.Lookup) {blk.splice(n, 1); break outer;}
		}
		this.banner = new MenuBanner(bannerContent, (cmd:MenuBannerCommand) => this.menuAction(cmd));

		this.editor = new EditMixtureWeb(this.proxyClip);
		this.editor.callbackUpdateTitle = () => {};
		this.editor.onLookup = this.onLookup;

		this.content.css({'width': width, 'height': height});
		this.content.css({'border': '1px solid black', 'display': 'flex', 'flex-direction': 'column'});

		let divMenu = $('<div style="width: 100%; flex-grow: 0;"/>').appendTo(this.content);
		let divMain = $('<div style="width: 100%; flex: 1 1 0; height: 100%; position: relative;"/>').appendTo(this.content);
		let divMainX = $('<div style="position: absolute; top: 0; right: 0; bottom: 0; left: 0;"/>').appendTo(divMain); // workaround

		this.banner.render(divMenu);
		this.editor.render(divMainX);
	}

	public isBlank():boolean
	{
		return this.editor.isBlank();
	}

	public getMixture():Mixture
	{
		return this.editor.getMixture();
	}

	public setMixture(mixture:Mixture):void
	{
		this.editor.clearHistory();
		this.editor.setMixture(mixture, true, false);
		this.editor.setDirty(false);
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
		else if (cmd == MenuBannerCommand.Lookup) this.onLookup(this.editor);
		else if (cmd == MenuBannerCommand.Delete) this.editor.deleteCurrent();
		else if (cmd == MenuBannerCommand.Append) this.editor.appendToCurrent();
		else if (cmd == MenuBannerCommand.Prepend) this.editor.prependBeforeCurrent();
		else if (cmd == MenuBannerCommand.MoveUp) this.editor.reorderCurrent(-1);
		else if (cmd == MenuBannerCommand.MoveDown) this.editor.reorderCurrent(1);
		else if (cmd == MenuBannerCommand.ZoomFull) this.editor.zoomFull();
		else if (cmd == MenuBannerCommand.ZoomIn) this.editor.zoom(1.25);
		else if (cmd == MenuBannerCommand.ZoomOut) this.editor.zoom(0.8);
		else if (cmd == MenuBannerCommand.Back) this.onGoBack();
	}

	// ------------ private methods ------------

	private actionClear():void
	{
		this.editor.setMixture(new Mixture(), true, true);
	}
	private actionSave():void
	{
		let str = this.editor.getMixture().serialise();
		this.downloadFile('mixture.mixfile', str);
	}
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