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

export class CollectionPanel extends MainPanel
{
	private filename:string = null;
	private collection = new MixtureCollection();
	private banner:MenuBanner;
	private divMain:JQuery;
	private policy = wmk.RenderPolicy.defaultColourOnWhite(20);

	// ------------ public methods ------------

	constructor(root:JQuery)
	{
		super(root);

		this.banner = new MenuBanner(BANNER, (cmd:MenuBannerCommand) => this.customMenuAction(cmd));

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

	protected actionFileOpen():void
	{
		// !!
	}

	protected actionFileSave():void
	{
		// !!
	}

	protected actionFileSaveAs():void
	{
		// !!
	}

	public customMenuAction(cmd:MenuBannerCommand):void
	{
		/*if (cmd == MenuBannerCommand.ExportSDF) this.actionExportSDF();
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
		else if (cmd == MenuBannerCommand.MoveUp) this.editor.reorderCurrent(-1);
		else if (cmd == MenuBannerCommand.MoveDown) this.editor.reorderCurrent(1);
		else if (cmd == MenuBannerCommand.ZoomFull) this.editor.zoomFull();
		else if (cmd == MenuBannerCommand.ZoomIn) this.editor.zoom(1.25);
		else if (cmd == MenuBannerCommand.ZoomOut) this.editor.zoom(0.8);
		else */super.customMenuAction(cmd);
	}

	// ------------ private methods ------------

	private renderMain():void
	{
		this.divMain.empty();

		// TODO: detail vs. card view

		for (let mixture of this.collection.mixtures)
		{
			let div = this.createMixture(mixture).appendTo(this.divMain);
			// .. clicky...
		}
	}

	private createMixture(mixture:Mixture):JQuery
	{
		let divOuter = $('<div/>');
		if (true) // row
			divOuter.css('display', 'block');
		else
			divOuter.css('display', 'inlineblock');

		let divInner = $('<div/>').appendTo(divOuter);
		divInner.css({'margin': '2px', 'padding': '2px', 'border-radius': '4px'});
		divInner.css({'background-color': '#E0E0E0', 'border': '1px solid #808080'});

		let measure = new wmk.OutlineMeasurement(0, 0, this.policy.data.pointScale);
		let layout = new ArrangeMixture(mixture, measure, this.policy);
		layout.arrange();

		let gfx = new wmk.MetaVector();
		let draw = new DrawMixture(layout, gfx);
		/*draw.hoverIndex = this.hoverIndex;
		draw.activeIndex = this.activeIndex;
		draw.selectedIndex = this.selectedIndex;*/
		draw.draw();

		gfx.normalise();
		/*gfx.offsetX = this.offsetX;
		gfx.offsetY = this.offsetY;*/
		let svg = $(gfx.createSVG()).appendTo(divInner);

		return divOuter;
	}

	/*private actionFileOpen():void
	{
		const electron = require('electron');
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
		});
	}

	private actionFileSave():void
	{
		if (this.editor.isBlank()) return;
		if (!this.filename) {this.actionFileSaveAs(); return;}

		this.saveFile(this.filename);
		this.editor.setDirty(false);
		this.updateTitle();
	}

	private actionFileSaveAs():void
	{
		if (this.editor.isBlank()) return;

		const electron = require('electron');
		const dialog = electron.remote.dialog;
		let params:any =
		{
			'title': 'Save Mixfile',
			//defaultPath...
			'filters':
			[
				{'name': 'Mixfile', 'extensions': ['mixfile']}
			]
		};
		dialog.showSaveDialog({}, (filename:string):void =>
		{
			this.saveFile(filename);
			this.filename = filename;
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
		// !! if (this.editor.isDirty() && !this.editor.isBlank()) title += '*';
		document.title = title;
	}

	private updateBanner():void
	{
		let isEditing = false; // !!

		this.banner.activateButtons(
		{
			[MenuBannerCommand.EditStructure]: isEditing,
			[MenuBannerCommand.Lookup]: isEditing,
			[MenuBannerCommand.ExportSVG]: isEditing,
			[MenuBannerCommand.Undo]: isEditing,
			[MenuBannerCommand.Redo]: isEditing,
			[MenuBannerCommand.ViewDetail]: !isEditing,
			[MenuBannerCommand.ViewCard]: !isEditing,
			[MenuBannerCommand.ZoomFull]: isEditing,
			[MenuBannerCommand.ZoomIn]: isEditing,
			[MenuBannerCommand.ZoomOut]: isEditing,
		});
		
	}
}

/* EOF */ }