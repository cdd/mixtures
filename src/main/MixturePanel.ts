/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='MenuBanner.ts'/>
///<reference path='MainPanel.ts'/>

namespace Mixtures /* BOF */ {

/*
	Viewing/editing window: dedicated entirely to the sketching of a mixture.
*/

const BANNER:MenuBannerButton[][] =
[
	[
		{'icon': 'CommandSave.svg', 'tip': 'Save', 'cmd': MenuBannerCommand.Save},
	],
	[
		{'icon': 'CommandEdit.svg', 'tip': 'Edit component', 'cmd': MenuBannerCommand.EditDetails},
		{'icon': 'CommandStructure.svg', 'tip': 'Edit structure', 'cmd': MenuBannerCommand.EditStructure},
		{'icon': 'CommandLookup.svg', 'tip': 'Lookup compound', 'cmd': MenuBannerCommand.Lookup},
		{'icon': 'CommandPicture.svg', 'tip': 'Export graphics', 'cmd': MenuBannerCommand.ExportSVG},
	],
	[
		{'icon': 'CommandAppend.svg', 'tip': 'Append component to the right', 'cmd': MenuBannerCommand.Append},
		{'icon': 'CommandPrepend.svg', 'tip': 'Prepend component to the left', 'cmd': MenuBannerCommand.Prepend},
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
		{'icon': 'CommandPaste.svg', 'tip': 'Paste', 'cmd': MenuBannerCommand.Paste},
	],
	[
		{'icon': 'CommandZoomNormal.svg', 'tip': 'Zoom full', 'cmd': MenuBannerCommand.ZoomFull},
		{'icon': 'CommandZoomIn.svg', 'tip': 'Zoom in', 'cmd': MenuBannerCommand.ZoomIn},
		{'icon': 'CommandZoomOut.svg', 'tip': 'Zoom out', 'cmd': MenuBannerCommand.ZoomOut},
	],
];

export class MixturePanel extends MainPanel
{
	private filename:string = null;
	private banner:MenuBanner;
	private editor = new EditMixture(this.proxyClip, this.proxyMenu);

	// ------------ public methods ------------

	constructor(root:DOM, private proxyClip:wmk.ClipboardProxy, private proxyMenu:wmk.MenuProxy)
	{
		super(root);

		this.banner = new MenuBanner(BANNER, (cmd:MenuBannerCommand) => this.menuAction(cmd));

		this.editor.callbackUpdateTitle = () => this.updateTitle();

		let divFlex = dom('<div/>').appendTo(root).css({'display': 'flex'});
		divFlex.css({'flex-direction': 'column', 'width': '100%', 'height': '100%'});
		let divBanner = dom('<div/>').appendTo(divFlex).css({'flex-grow': '0'});
		let divEditor = dom('<div/>').appendTo(divFlex).css({'flex-grow': '1'});

		this.banner.render(divBanner);
		this.editor.render(divEditor);

		this.banner.callbackRefocus = () => this.editor.refocus();
	}

	public setMixture(mixture:Mixture):void
	{
		this.editor.clearHistory();
		this.editor.setMixture(mixture, true, false);
		this.editor.setDirty(false);
	}

	public loadFile(filename:string):void
	{
		if (!filename)
		{
			this.editor.clearHistory();
			this.editor.setMixture(new Mixture(), true, true);
			this.updateTitle();
			this.filename = null;
			return;
		}

		const fs = require('fs');
		fs.readFile(filename, 'utf-8', (err:any, data:string):void =>
		{
			if (err) throw err;

			let mixture:Mixture;
			try {mixture = Mixture.deserialise(data);}
			catch (e)
			{
				console.log('Invalid mixture file: ' + e + '\n' + data);
				alert('Not a valid mixture file.');
				return;
			}

			mixture.mixfile.mixfileVersion = MIXFILE_VERSION; // as good a time as any to set latest version

			this.editor.clearHistory();
			this.editor.setMixture(mixture, true, false);
			this.editor.setDirty(false);
			this.filename = filename;
			this.updateTitle();
		});
	}

	public saveFile(filename:string):void
	{
		const fs = require('fs');

		let mixture = this.editor.getMixture();
		let content = mixture.serialise();

		fs.writeFile(filename, content, (err:any):void =>
		{
			if (err) alert('Unable to save: ' + err);
		});
	}

	protected onResize():void
	{
		super.onResize();
		this.editor.delayedRedraw();

		//let w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;
		//this.sketcher.changeSize(w, h); // force a re-layout to match the new size
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

		super.menuAction(cmd);
	}

	public customMenuAction(cmd:MenuBannerCommand):void
	{
		if (cmd == MenuBannerCommand.ExportSDF) this.actionExportSDF();
		else if (cmd == MenuBannerCommand.ExportSVG) this.actionFileExportSVG();
		else if (cmd == MenuBannerCommand.CreateMInChI) this.actionFileCreateMInChI();
		else if (cmd == MenuBannerCommand.Undo) this.editor.performUndo();
		else if (cmd == MenuBannerCommand.Redo) this.editor.performRedo();
		else if (cmd == MenuBannerCommand.Cut) this.editor.clipboardCopy(true);
		else if (cmd == MenuBannerCommand.Copy) this.editor.clipboardCopy(false);
		else if (cmd == MenuBannerCommand.CopyBranch) this.editor.clipboardCopy(false, true);
		else if (cmd == MenuBannerCommand.Paste) this.editor.clipboardPaste();
		else if (cmd == MenuBannerCommand.EditStructure) this.editor.editStructure();
		else if (cmd == MenuBannerCommand.EditDetails) this.editor.editDetails();
		else if (cmd == MenuBannerCommand.Lookup) this.editor.lookupCurrent();
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
		else super.customMenuAction(cmd);
	}

	// ------------ private methods ------------

	protected actionFileOpen():void
	{
		const electron = require('electron');
		const remote:Electron.Remote = require('@electron/remote');
		const dialog = remote.dialog;
		let params:Electron.OpenDialogOptions =
		{
			'title': 'Open Mixture',
			'properties': ['openFile'],
			'filters':
			[
				{'name': 'Mixfile', 'extensions': ['mixfile']},
				{'name': 'Mixfile Collection', 'extensions': ['json']},
			]
		};
		dialog.showOpenDialog(params).then((value) =>
		{
			if (value.canceled) return;
			let inPlace = this.editor.getMixture().isEmpty();
			for (let fn of value.filePaths)
			{
				if (inPlace && fn.endsWith('.mixfile'))
				{
					this.loadFile(fn);
					inPlace = false;
				}
				else if (fn.endsWith('.json'))
					openNewWindow('CollectionPanel', fn);
				else
					openNewWindow('MixturePanel', fn);
			}
		});
	}

	protected actionFileSave():void
	{
		if (this.editor.isBlank()) return;
		if (!this.filename) {this.actionFileSaveAs(); return;}

		this.saveFile(this.filename);
		this.editor.setDirty(false);
		this.updateTitle();
	}

	protected actionFileSaveAs():void
	{
		if (this.editor.isBlank()) return;

		const electron = require('electron');
		const remote:Electron.Remote = require('@electron/remote');
		const dialog = remote.dialog;
		let params:Electron.SaveDialogOptions =
		{
			'title': 'Save Mixfile',
			//defaultPath...
			'filters':
			[
				{'name': 'Mixfile', 'extensions': ['mixfile']}
			]
		};
		dialog.showSaveDialog(params).then((value) =>
		{
			if (value.canceled) return;
			this.saveFile(value.filePath);
			this.filename = value.filePath;
			this.editor.setDirty(false);
			this.updateTitle();
		});
	}

	private actionExportSDF():void
	{
		let mixture = this.editor.getMixture();
		if (mixture.isEmpty()) return;

		let exportSDF = new ExportSDFile();
		exportSDF.append(mixture.mixfile);
		let sdfile = exportSDF.write();

		const electron = require('electron'), fs = require('fs');
		const remote:Electron.Remote = require('@electron/remote');
		const dialog = remote.dialog;

		let defPath = this.filename;
		if (defPath)
		{
			let lastDot = defPath.lastIndexOf('.');
			if (lastDot > 0 && lastDot > defPath.lastIndexOf('/') && lastDot > defPath.lastIndexOf('\\')) defPath = defPath.substring(0, lastDot);
			defPath += '.sdf';
		}
		else defPath = undefined;

		let params:Electron.SaveDialogOptions =
		{
			'title': 'Export as SDfile',
			'defaultPath': defPath,
			'filters':
			[
				{'name': 'SDfile', 'extensions': ['sdf']}
			]
		};
		if (this.filename && this.filename.endsWith('.mixfile'))
			params.defaultPath = (this.filename.substring(0, this.filename.length - 8) + '.sdf').split(/[\/\\]/).pop();

		dialog.showSaveDialog(params).then((value) =>
		{
			if (value.canceled) return;
			fs.writeFile(value.filePath, sdfile, (err:any):void =>
			{
				if (err) alert('Unable to save: ' + err);
			});
		});
	}

	private actionFileExportSVG():void
	{
		let defPath = this.filename;
		if (defPath)
		{
			let lastDot = defPath.lastIndexOf('.');
			if (lastDot > 0 && lastDot > defPath.lastIndexOf('/') && lastDot > defPath.lastIndexOf('\\')) defPath = defPath.substring(0, lastDot);
			defPath += '.svg';
		}
		else defPath = undefined;

		const electron = require('electron');
		const remote:Electron.Remote = require('@electron/remote');
		const dialog = remote.dialog;
		let params:Electron.SaveDialogOptions =
		{
			'title': 'Save SVG Diagram',
			'defaultPath': defPath,
			'filters':
			[
				{'name': 'Scalable Vector Graphics', 'extensions': ['svg']}
			]
		};
		dialog.showSaveDialog(params).then((value) =>
		{
			if (value.canceled) return;
			let policy = wmk.RenderPolicy.defaultColourOnWhite();
			let measure = new wmk.OutlineMeasurement(0, 0, policy.data.pointScale);
			let layout = new ArrangeMixture(this.editor.getMixture(), measure, policy);
			layout.collapsedBranches = this.editor.getCollapsedBranches();
			layout.arrange();

			let gfx = new wmk.MetaVector();
			new DrawMixture(layout, gfx).draw();
			gfx.normalise();
			let svg = gfx.createSVG(true);

			const fs = require('fs');
			fs.writeFile(value.filePath, svg, (err:any):void =>
			{
				if (err) alert('Unable to save: ' + err);
			});
		});
	}

	private actionFileCreateMInChI():void
	{
		if (!InChI.isAvailable())
		{
			alert('InChI executable has not been configured. Specify with --inchi parameter.');
			return;
		}

		let maker = new ExportMInChI(this.editor.getMixture().mixfile);
		let self = this;
		class MInChIDialog extends wmk.Dialog
		{
			constructor()
			{
				super();
				this.title = 'MInChI';
			}
			protected populate():void
			{
				self.proxyClip.pushHandler(new wmk.ClipboardProxyHandler());
				this.bodyDOM().setText('Calculating...');
				(async () => await this.renderResult())();
			}
			public close():void
			{
				self.proxyClip.popHandler();
				super.close();
			}
			private async renderResult():Promise<void>
			{
				await wmk.yieldDOM();
				await maker.fillInChI();
				maker.formulate();

				let body = this.bodyDOM();
				body.empty();

				let divOuter = wmk.dom('<div/>').appendTo(body);
				let pre = wmk.dom('<span/>').appendTo(divOuter).css({'font-family': 'monospace', 'padding-top': '0.5em', 'word-break': 'break-all'});
				let minchi = maker.getResult(), segment = maker.getSegment();
				for (let n = 0; n < minchi.length; n++)
				{
					let span = wmk.dom('<span/>').appendTo(pre);
					span.setText(minchi[n]);
					if (segment[n] == MInChISegment.Header) span.setCSS('background-color', '#FFC0C0');
					else if (segment[n] == MInChISegment.Component) span.setCSS('background-color', '#C0C0FF');
					else if (segment[n] == MInChISegment.Hierarchy) span.setCSS('background-color', '#E0E080');
					else if (segment[n] == MInChISegment.Concentration) span.setCSS('background-color', '#80E080');
					pre.appendHTML('<wbr/>');
				}

				let btnCopy = wmk.dom('<button class="wmk-button wmk-button-small wmk-button-default">Copy</button>').appendTo(divOuter).css({'margin-left': '0.5em'});
				btnCopy.onClick(() => self.proxyClip.setString(minchi));
			}
		}
		new MInChIDialog().open();
	}

	private updateTitle():void
	{
		if (this.filename == null) {document.title = 'Mixtures'; return;}

		let slash = Math.max(this.filename.lastIndexOf('/'), this.filename.lastIndexOf('\\'));
		let title = 'Mixtures - ' + this.filename.substring(slash + 1);
		if (this.editor.isDirty() && !this.editor.isBlank()) title += '*';
		document.title = title;
	}
}

/* EOF */ }