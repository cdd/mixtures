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

namespace Mixtures /* BOF */ {

/*
	Browsing/editing a collection of mixtures.
*/

export class CollectionPanel extends MainPanel
{
	private filename:string = null;
	private banner:MenuBanner;
	//private editor = new EditMixture();
	
	// ------------ public methods ------------

	constructor(root:JQuery)
	{
		super(root);

		let menu = (cmd:string) => this.customMenuAction(cmd);
		this.banner = new MenuBanner(
			[
				[
					{'icon': 'CommandEdit.svg', 'tip': 'Edit component', 'action': () => menu('editDetails')},
					{'icon': 'CommandStructure.svg', 'tip': 'Edit structure', 'action': () => menu('editStructure')},
					{'icon': 'CommandLookup.svg', 'tip': 'Lookup compound', 'action': () => menu('lookup')},
					{'icon': 'CommandPicture.svg', 'tip': 'Export graphics', 'action': () => menu('exportSVG')},
				],
				[
					{'icon': 'CommandAppend.svg', 'tip': 'Append component', 'action': () => menu('append')},
					{'icon': 'CommandPrepend.svg', 'tip': 'Prepend component', 'action': () => menu('prepend')},
					{'icon': 'CommandDelete.svg', 'tip': 'Delete', 'action': () => menu('delete')},
					{'icon': 'CommandMoveUp.svg', 'tip': 'Move Up', 'action': () => menu('moveUp')},
					{'icon': 'CommandMoveDown.svg', 'tip': 'Move Down', 'action': () => menu('moveDown')},
				],
				[
					{'icon': 'CommandUndo.svg', 'tip': 'Undo', 'action': () => menu('undo')},
					{'icon': 'CommandRedo.svg', 'tip': 'Redo', 'action': () => menu('redo')},
				],
				[
					{'icon': 'CommandCopy.svg', 'tip': 'Copy', 'action': () => menu('copy')},
					{'icon': 'CommandCut.svg', 'tip': 'Cut', 'action': () => menu('cut')},
					{'icon': 'CommandPaste.svg', 'tip': 'Paste', 'action': () => menu('paste')},
				],
				[
					{'icon': 'CommandViewDetail.svg', 'tip': 'Detail', 'action': () => menu('!')},
					{'icon': 'CommandViewCard.svg', 'tip': 'Cards', 'action': () => menu('!')},
				],
			]);

		//this.editor.callbackUpdateTitle = () => this.updateTitle();

		let divFlex = $('<div/>').appendTo(root).css({'display': 'flex'});
		divFlex.css({'flex-direction': 'column', 'width': '100%', 'height': '100%'});
		let divBanner = $('<div/>').appendTo(divFlex).css({'flex-grow': '0'});
		let divEditor = $('<div/>').appendTo(divFlex).css({'flex-grow': '1'});

		this.banner.render(divBanner);
		//this.editor.render(divEditor);
	}

	/*public setMixture(mixture:Mixture):void
	{
		this.editor.clearHistory();
		this.editor.setMixture(mixture, true, false);
		this.editor.setDirty(false);
	}

	public loadFile(filename:string):void
	{
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

	public customMenuAction(cmd:string):void
	{
		super.customMenuAction(cmd);
	}

	// ------------ private methods ------------

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
	}

	private updateTitle():void
	{
		if (this.filename == null) {document.title = 'Mixtures'; return;}

		let slash = Math.max(this.filename.lastIndexOf('/'), this.filename.lastIndexOf('\\'));
		let title = 'Mixtures - ' + this.filename.substring(slash + 1);
		if (this.editor.isDirty() && !this.editor.isBlank()) title += '*';
		document.title = title;
	}*/
}

/* EOF */ }