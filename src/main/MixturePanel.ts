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
	Viewing/editing window: dedicated entirely to the sketching of a mixture.
*/

export class MixturePanel extends MainPanel
{
	private filename:string = null;
	private editor = new EditMixture();
	
	// ------------ public methods ------------

	constructor(root:JQuery)
	{
		super(root);

		//let w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;

		this.editor.callbackUpdateTitle = () => this.updateTitle();
		this.editor.render(root);
	}

	public setMixture(mixture:Mixture):void
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
	}

	public menuAction(cmd:string):void
	{
		let dlg = this.editor.compoundEditor();
		if (dlg)
		{
			if (cmd == 'cut') dlg.actionCut();
			else if (cmd == 'copy') dlg.actionCopy();
			else if (cmd == 'paste') dlg.actionPaste();
			else if (cmd == 'undo') dlg.actionUndo();
			else if (cmd == 'redo') dlg.actionRedo();
			return;
		}
		if (!this.editor.isReceivingCommands()) 
		{
			// certain common menu/shortcut commands are passed through to standard behaviour, the rest are stopped
			if (['cut', 'copy', 'paste', 'undo', 'redo'].indexOf(cmd) >= 0) document.execCommand(cmd);
			return;
		}

		if (cmd == 'new') openNewWindow('MixturePanel');
		else if (cmd == 'open') this.actionFileOpen();
		else if (cmd == 'save') this.actionFileSave();
		else if (cmd == 'saveAs') this.actionFileSaveAs();
		else if (cmd == 'exportSDF') this.actionExportSDF();
		else if (cmd == 'exportSVG') this.actionFileExportSVG();
		else if (cmd == 'createMInChI') this.actionFileCreateMInChI();
		else if (cmd == 'undo') this.editor.performUndo();
		else if (cmd == 'redo') this.editor.performRedo();
		else if (cmd == 'cut') this.editor.clipboardCopy(true);
		else if (cmd == 'copy') this.editor.clipboardCopy(false);
		else if (cmd == 'copyBranch') this.editor.clipboardCopy(false, true);
		else if (cmd == 'paste') this.editor.clipboardPaste();
		else if (cmd == 'editStructure') this.editor.editStructure();
		else if (cmd == 'editDetails') this.editor.editDetails();
		else if (cmd == 'lookup') this.editor.lookupCurrent();
		else if (cmd == 'delete') this.editor.deleteCurrent();
		else if (cmd == 'append') this.editor.appendToCurrent();
		else if (cmd == 'prepend') this.editor.prependBeforeCurrent();
		else if (cmd == 'moveUp') this.editor.reorderCurrent(-1);
		else if (cmd == 'moveDown') this.editor.reorderCurrent(1);
		else if (cmd == 'zoomFull') this.editor.zoomFull();
		else if (cmd == 'zoomIn') this.editor.zoom(1.25);
		else if (cmd == 'zoomOut') this.editor.zoom(0.8);
		else console.log('MENU:' + cmd);
	}

	// ------------ private methods ------------

	private actionFileOpen():void
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

/*
	private actionCopy(andCut:boolean):void
	{
		let input = this.sketcher.getState(), mol = input.mol;
		let mask = Vec.booleanArray(false, mol.numAtoms);
		if (Vec.anyTrue(input.selectedMask)) mask = input.selectedMask;
		else if (input.currentAtom > 0) mask[input.currentAtom - 1] = true;
		else if (input.currentBond > 0) {mask[mol.bondFrom(input.currentBond) - 1] = true; mask[mol.bondTo(input.currentBond) - 1] = true;}
		else mask = Vec.booleanArray(true, mol.numAtoms);
		
		let copyMol = Vec.allTrue(mask) ? mol.clone() : MolUtil.subgraphWithAttachments(mol, mask);

		if (andCut)
		{
			this.sketcher.clearSubject();
			this.setMolecule(MolUtil.subgraphMask(mol, Vec.notMask(mask)));
		}

		const {clipboard} = require('electron');
		clipboard.writeText(copyMol.toString());

		this.sketcher.showMessage('Molecule with ' + copyMol.numAtoms + ' atom' + (copyMol.numAtoms == 1 ? '' : 's') + ' copied to clipboard.');
	}

	private actionPaste():void
	{
		const {clipboard} = require('electron');
		let content = clipboard.readText();
		if (!content) {alert('Clipboard has no text on it.'); return;}
		try
		{
			let mol = MoleculeStream.readUnknown(content);
			this.sketcher.pasteMolecule(mol);
		}
		catch (ex) {alert('Clipboard does not contain a recognisable molecule.'); return;}
	}*/

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