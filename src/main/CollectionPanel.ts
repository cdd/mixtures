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
///<reference path='../../../WebMolKit/src/sketcher/Sketcher.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/gfx/Rendering.ts'/>
///<reference path='../../../WebMolKit/src/ui/ClipboardProxy.ts'/>

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>
///<reference path='../data/Mixfile.ts'/>
///<reference path='../data/Mixture.ts'/>
///<reference path='../data/Units.ts'/>
///<reference path='../mixture/ArrangeMixture.ts'/>
///<reference path='../mixture/DrawMixture.ts'/>
///<reference path='../mixture/EditMixture.ts'/>
///<reference path='../mixture/ExportSDFile.ts'/>
///<reference path='../mixture/ExportMInChI.ts'/>
///<reference path='MainPanel.ts'/>
///<reference path='MenuBanner.ts'/>

namespace Mixtures /* BOF */ {

/*
	Browsing/editing a collection of mixtures.
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
		{'icon': 'CommandPaste.svg', 'tip': 'Paste', 'cmd': MenuBannerCommand.Paste},
	],
	[
		{'icon': 'CommandViewDetail.svg', 'tip': 'Detail', 'cmd': MenuBannerCommand.ViewDetail},
		{'icon': 'CommandViewCard.svg', 'tip': 'Cards', 'cmd': MenuBannerCommand.ViewCard},
		{'icon': 'CommandZoomNormal.svg', 'tip': 'Zoom full', 'cmd': MenuBannerCommand.ZoomFull},
		{'icon': 'CommandZoomIn.svg', 'tip': 'Zoom in', 'cmd': MenuBannerCommand.ZoomIn},
		{'icon': 'CommandZoomOut.svg', 'tip': 'Zoom out', 'cmd': MenuBannerCommand.ZoomOut},
	],
];

enum CollectionPanelView
{
	Detail,
	Card,
}

const BG_NORMAL = '#E0E0E0';
const BG_SELECTED = '#B9CBFF';

export class CollectionPanel extends MainPanel
{
	private filename:string = null;
	private collection = new MixtureCollection();
	private isDirty = false;

	private banner:MenuBanner;
	private divMain:JQuery;
	private policy = wmk.RenderPolicy.defaultColourOnWhite(20);
	private viewType = CollectionPanelView.Detail;

	private selected = -1;
	private divMixtures:JQuery[] = [];
	private editor:EditMixture = null; // when defined, refers to collection{selected}

	// ------------ public methods ------------

	constructor(root:JQuery, private proxyClip:wmk.ClipboardProxy)
	{
		super(root);

		this.banner = new MenuBanner(BANNER, (cmd:MenuBannerCommand) => this.menuAction(cmd));

		let divFlex = $('<div/>').appendTo(root).css({'display': 'flex'});
		divFlex.css({'flex-direction': 'column', 'width': '100%', 'height': '100%'});
		let divBanner = $('<div/>').appendTo(divFlex).css({'flex-grow': '0'});
		this.divMain = $('<div/>').appendTo(divFlex).css({'flex-grow': '1', 'overflow-y': 'scroll'});

		this.banner.render(divBanner);
		this.renderMain();

		this.updateBanner();
	}

	public setCollection(collection:MixtureCollection):void
	{
		/* !!
		this.editor.clearHistory();
		this.editor.setMixture(mixture, true, false);
		this.editor.setDirty(false);*/

		this.collection = collection;
		this.renderMain();
	}

	public loadFile(filename:string):void
	{
		const fs = require('fs');
		fs.readFile(filename, 'utf-8', (err:any, data:string):void =>
		{
			if (err) throw err;

			let collection:MixtureCollection;
			try {collection = MixtureCollection.deserialise(data);}
			catch (e)
			{
				console.log('Invalid mixture collection file: ' + e + '\n' + data);
				alert('Not a valid mixture collection file.');
				return;
			}

			this.setCollection(collection);
			this.filename = filename;
			this.isDirty = false;
			this.updateTitle();
		});
	}

	/*public saveFile(filename:string):void
	{
		const fs = require('fs');

		let mixture = this.editor.getMixture();
		let content = mixture.serialise();

		fs.writeFile(filename, content, (err:any):void =>
		{
			if (err) alert('Unable to save: ' + err);
		});
	}

	protected onResize()
	{
		super.onResize();
		this.editor.delayedRedraw();

		//let w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;
		//this.sketcher.changeSize(w, h); // force a re-layout to match the new size
	}*/

	public menuAction(cmd:MenuBannerCommand):void
	{
		if (this.editor)
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
		}

		super.menuAction(cmd);
	}

	public customMenuAction(cmd:MenuBannerCommand):void
	{
		if (this.editor)
		{
			/* !! if (cmd == MenuBannerCommand.ExportSDF) this.actionExportSDF();
			else if (cmd == MenuBannerCommand.ExportSVG) this.actionFileExportSVG();
			else if (cmd == MenuBannerCommand.CreateMInChI) this.actionFileCreateMInChI();
			else*/ if (cmd == MenuBannerCommand.Undo) this.editor.performUndo();
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
			else if (cmd == MenuBannerCommand.MoveUp) this.editor.reorderCurrent(-1);
			else if (cmd == MenuBannerCommand.MoveDown) this.editor.reorderCurrent(1);
			else if (cmd == MenuBannerCommand.ZoomFull) this.editor.zoomFull();
			else if (cmd == MenuBannerCommand.ZoomIn) this.editor.zoom(1.25);
			else if (cmd == MenuBannerCommand.ZoomOut) this.editor.zoom(0.8);
			else super.customMenuAction(cmd);		
		}
		else
		{
			/*if (cmd == MenuBannerCommand.ExportSDF) this.actionExportSDF();
			else if (cmd == MenuBannerCommand.ExportSVG) this.actionFileExportSVG();
			else if (cmd == MenuBannerCommand.CreateMInChI) this.actionFileCreateMInChI();
			else*/ if (cmd == MenuBannerCommand.Cut) this.clipboardCopy(true);
			else if (cmd == MenuBannerCommand.Copy) this.clipboardCopy(false);
			else if (cmd == MenuBannerCommand.Paste) this.clipboardPaste();
			else if (cmd == MenuBannerCommand.EditDetails) this.editMixture();
			else if (cmd == MenuBannerCommand.Delete) this.deleteMixture();
			else if (cmd == MenuBannerCommand.Append) this.appendMixture();
			else if (cmd == MenuBannerCommand.Prepend) this.prependMixture();
			else if (cmd == MenuBannerCommand.MoveUp) this.reorderCurrent(-1);
			else if (cmd == MenuBannerCommand.MoveDown) this.reorderCurrent(1);
			else if (cmd == MenuBannerCommand.ZoomFull) this.zoomScale();
			else if (cmd == MenuBannerCommand.ZoomIn) this.zoomScale(1.25);
			else if (cmd == MenuBannerCommand.ZoomOut) this.zoomScale(0.8);
			else if (cmd == MenuBannerCommand.ViewDetail) this.changeView(cmd);
			else if (cmd == MenuBannerCommand.ViewCard) this.changeView(cmd);
			else super.customMenuAction(cmd);
		}
	}

	// ------------ private methods ------------

	private renderMain():void
	{
		this.divMain.empty();
		this.selected = -1;
		this.divMixtures = [];

		let divContent = $('<div/>').appendTo(this.divMain);

		if (this.viewType == CollectionPanelView.Card)
		{
			divContent.css({'display': 'flex', 'flex-wrap': 'wrap'});
			divContent.css({'justify-content': 'flex-start', 'align-items': 'flex-start'});
		}

		for (let n = 0; n < this.collection.count; n++)
		{
			let div = this.createMixture(this.collection.getMixture(n)).appendTo(divContent);
			div.click(() => this.changeSelection(n));
			div.dblclick(() => this.editMixture());
			this.divMixtures.push(div);
		}
	}

	private createMixture(mixture:Mixture):JQuery
	{
		let divOuter = $('<div/>');
		if (this.viewType == CollectionPanelView.Detail)
		{
			divOuter.css('display', 'block');
		}
		else // == CollectionPanelView.Card
		{
			divOuter.css('display', 'inline-block');
		}

		let divInner = $('<div/>').appendTo(divOuter);
		divInner.css({'margin': '2px', 'padding': '2px', 'border-radius': '4px'});
		divInner.css({'background-color': BG_NORMAL, 'border': '1px solid #808080'});

		let measure = new wmk.OutlineMeasurement(0, 0, this.policy.data.pointScale);
		let layout = new ArrangeMixture(mixture, measure, this.policy);
		layout.arrange();

		let gfx = new wmk.MetaVector();
		let draw = new DrawMixture(layout, gfx);
		draw.draw();

		gfx.normalise();
		let svg = $(gfx.createSVG()).appendTo(divInner);

		return divInner;
	}

	private changeView(cmd:MenuBannerCommand):void
	{
		if (cmd == MenuBannerCommand.ViewDetail) this.viewType = CollectionPanelView.Detail;
		else if (cmd == MenuBannerCommand.ViewCard) this.viewType = CollectionPanelView.Card;
		this.renderMain();
	}

	private changeSelection(idx:number):void
	{
		if (this.selected >= 0) this.divMixtures[this.selected].css({'background-color': BG_NORMAL});
		this.selected = idx;
		if (idx >= 0) this.divMixtures[idx].css({'background-color': BG_SELECTED});
	}

	protected actionFileOpen():void
	{
		/*const electron = require('electron');
		const dialog = electron.remote.dialog;
		let params:any =
		{
			'title': 'Open Molecule',
			'properties': ['openFile'],
			'filters':
			[
				{'name': 'Mixfile', 'extensions': ['mixfile']}
			]
		};
		dialog.showOpenDialog(params, (filenames:string[]):void =>
		{
			let inPlace = this.editor.getMixture().isEmpty();
			if (filenames) for (let fn of filenames)
			{
				if (inPlace)
				{
					this.loadFile(fn);
					inPlace = false;
				}
				else openNewWindow('MixturePanel', fn);
			}
		});*/
	}

	protected actionFileSave():void
	{
		if (this.editor)
		{
			this.stopEdit();
			return;
		}

		if (!this.filename) {this.actionFileSaveAs(); return;}

		this.saveFile(this.filename);
		this.isDirty = false;
		this.updateTitle();
	}

	protected actionFileSaveAs():void
	{
		const electron = require('electron');
		const dialog = electron.remote.dialog;
		let params:any =
		{
			'title': 'Save Mixfile Collection',
			//defaultPath...
			'filters':
			[
				{'name': 'Mixfile Collection', 'extensions': ['json']}
			]
		};
		dialog.showSaveDialog({}, (filename:string):void =>
		{
			if (!filename) return;
			this.saveFile(filename);
			this.filename = filename;
			this.isDirty = false;
			this.updateTitle();
		});
	}

	public saveFile(filename:string):void
	{
		let content = this.collection.serialise();

		const fs = require('fs');
		fs.writeFile(filename, content, (err:any):void =>
		{
			if (err) alert('Unable to save: ' + err);
		});
	}

	/*private actionExportSDF():void
	{
		let mixture = this.editor.getMixture();
		if (mixture.isEmpty()) return;

		let exportSDF = new ExportSDFile();
		exportSDF.append(mixture.mixfile);
		let sdfile = exportSDF.write();

		const electron = require('electron'), fs = require('fs');
		const dialog = electron.remote.dialog;

		let params:any =
		{
			'title': 'Export as SDfile',
			'filters':
			[
				{'name': 'SDfile', 'extensions': ['sdf']}
			]
		};
		if (this.filename && this.filename.endsWith('.mixfile'))
			params.defaultPath = (this.filename.substring(0, this.filename.length - 8) + '.sdf').split(/[\/\\]/).pop();

		dialog.showSaveDialog(params, (filename:string):void =>
		{
			fs.writeFile(filename, sdfile, (err:any):void =>
			{
				if (err) alert('Unable to save: ' + err);
			});
		});
	}

	private actionFileExportSVG():void
	{
		const electron = require('electron');
		const dialog = electron.remote.dialog;
		let params:any =
		{
			'title': 'Save Molecule',
			//defaultPath...
			'filters':
			[
				{'name': 'Scalable Vector Graphics', 'extensions': ['svg']}
			]
		};
		dialog.showSaveDialog(params, (filename:string):void =>
		{
			let policy = wmk.RenderPolicy.defaultColourOnWhite();
			let measure = new wmk.OutlineMeasurement(0, 0, policy.data.pointScale);
			let layout = new ArrangeMixture(this.editor.getMixture(), measure, policy);
			layout.arrange();

			let gfx = new wmk.MetaVector();
			new DrawMixture(layout, gfx).draw();
			gfx.normalise();
			let svg = gfx.createSVG();

			const fs = require('fs');
			fs.writeFile(filename, svg, (err:any):void =>
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

		// NOTE: display/copy is temporary; replace this with a better way to view overall metadata for the whole mixture

		let creator = new ExportMInChI(this.editor.getMixture().mixfile);
		creator.fillInChI();
		creator.formulate();
		let minchi = creator.getResult();
		alert('Generated MInChI identifier:\n' + minchi);
		let clipboard = require('electron').clipboard;
		clipboard.writeText(minchi);
	}*/

	private updateTitle():void
	{
		if (this.filename == null) {document.title = 'Mixture Collection'; return;}

		let slash = Math.max(this.filename.lastIndexOf('/'), this.filename.lastIndexOf('\\'));
		let title = 'Mixture Collection - ' + this.filename.substring(slash + 1);
		if (this.isDirty) title += '*';
		document.title = title;
	}

	private updateBanner():void
	{
		let isEditing = this.editor != null;

		this.banner.activateButtons(
		{
			[MenuBannerCommand.EditStructure]: isEditing,
			[MenuBannerCommand.Lookup]: isEditing,
			[MenuBannerCommand.ExportSVG]: isEditing,
			[MenuBannerCommand.Undo]: isEditing,
			[MenuBannerCommand.Redo]: isEditing,
			[MenuBannerCommand.ViewDetail]: !isEditing,
			[MenuBannerCommand.ViewCard]: !isEditing,
		});
	}

	private scrollToIndex(idx:number):void
	{
		if (idx < 0) return;
		let div = this.divMixtures[idx];
		this.divMain[0].scrollTop = div.offset().top - this.divMain.offset().top + this.divMain[0].scrollTop;
	}

	private editMixture():void
	{
		if (this.selected < 0) return;

		this.editor = new EditMixture(this.proxyClip);

		this.divMain.empty();
		this.editor.render(this.divMain);

		this.editor.setMixture(this.collection.getMixture(this.selected));
		this.editor.setDirty(false);
		this.updateBanner();
	}

	private stopEdit():void
	{
		if (!this.editor) return;

		let idx = this.selected;
		if (this.editor.isDirty())
		{
			this.collection.setMixture(idx, this.editor.getMixture());
			this.isDirty = true;
		}

		this.editor = null;
		this.renderMain();
		this.changeSelection(idx);
		this.scrollToIndex(idx);
		this.updateBanner();
		this.updateTitle();
	}

	private clipboardCopy(withCut:boolean):void
	{
		let idx = this.selected;
		if (idx < 0 || this.editor) return;

		let str = this.collection.getMixture(idx).serialise();
		this.proxyClip.setString(str);

		if (withCut)
		{
			this.collection.deleteMixture(idx);
			this.isDirty = true;

			let top = this.divMain[0].scrollTop;
			this.renderMain();
			this.divMain[0].scrollTop = top;
			this.updateBanner();
			this.updateTitle();	
		}
	}

	private clipboardPaste():void
	{
		let mixture = Mixture.deserialise(this.proxyClip.getString());
		if (!mixture)
		{
			alert('No mixture on clipboard.');
			return;
		}
		this.appendMixture(mixture);
	}

	private deleteMixture():void
	{
		let idx = this.selected;
		if (idx < 0 || this.editor) return;
		this.collection.deleteMixture(idx);
		this.renderMain();
		if (idx < this.collection.count) this.scrollToIndex(idx);

		this.isDirty = true;
		this.updateTitle();
	}

	private appendMixture(mixture?:Mixture):void
	{
		if (!mixture) mixture = new Mixture();

		if (this.editor) return;
		let idx:number;
		if (this.selected < 0)
		{
			idx = this.collection.appendMixture(mixture);
		}
		else
		{
			idx = this.selected + 1;
			this.collection.insertMixture(idx, mixture);
		}
		this.renderMain();
		this.changeSelection(idx);
		this.scrollToIndex(idx);

		this.isDirty = true;
		this.updateTitle();
	}

	private prependMixture():void
	{
		if (this.editor) return;
		let idx = Math.max(0, this.selected);
		this.collection.insertMixture(idx, new Mixture());
		let top = this.divMain[0].scrollTop;
		this.renderMain();
		this.changeSelection(idx);
		this.divMain[0].scrollTop = top;

		this.isDirty = true;
		this.updateTitle();
	}

	private reorderCurrent(dir:number):void
	{
		let idx = this.selected;
		if (idx < 0 || idx + dir < 0 || idx + dir >= this.collection.count || this.editor) return;
		this.collection.swapMixtures(idx, idx + dir);
		let top = this.divMain[0].scrollTop;
		this.renderMain();
		this.changeSelection(idx + dir);
		this.divMain[0].scrollTop = top;

		this.isDirty = true;
		this.updateTitle();
	}

	// alter zoom level by a factor, or reset (null)
	public zoomScale(scale?:number):void
	{
		// TODO
	}
}

/* EOF */ }