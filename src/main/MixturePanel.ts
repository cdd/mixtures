/*
    Mixfile Editor & Viewing Libraries

    (c) 2017 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/sketcher/Sketcher.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/gfx/Rendering.ts'/>

///<reference path='../mixture/Mixfile.ts'/>
///<reference path='../mixture/ArrangeMixture.ts'/>
///<reference path='../mixture/DrawMixture.ts'/>
///<reference path='../mixture/EditMixture.ts'/>
///<reference path='MainPanel.ts'/>

/*
	Viewing/editing window: dedicated entirely to the sketching of a mixture.
*/

class MixturePanel extends MainPanel
{
	private filename:string = null;
	private editor = new EditMixture();
	
	// ------------ public methods ------------

	constructor(root:JQuery)
	{
		super(root);

		//let w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;

		this.editor.render(root);
	}

	public loadFile(filename:string):void
	{
		const fs = require('fs');
		fs.readFile(filename, 'utf-8', (err:any, data:string):void =>
		{
			if (err) throw err;
			
			let mixture:Mixfile;
			try {mixture = JSON.parse(data);}
			catch (e)
			{
				console.log('Invalid mixture file: ' + e + '\n' + data);
				alert('Not a valid mixture file.');
				return;
			}

			this.editor.setMixture(mixture);
			this.filename = filename;
			this.updateTitle();			
		});		
	}
	

	/*public setMolecule(mol:Molecule):void
	{
        this.sketcher.defineMolecule(mol);
	}

	public saveFile(filename:string):void
	{
		const fs = require('fs');

		let mol = this.sketcher.getMolecule();
		let content = '';
		if (filename.endsWith('.mol')) 
			content = MoleculeStream.writeMDLMOL(mol);
		else
			content = MoleculeStream.writeNative(mol);

		fs.writeFile(filename, content, (err:any):void =>
		{
			if (err) alert('Unable to save: ' + err);
		});
	}*/

	protected onResize()
	{
		super.onResize();

		let w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;
		//this.sketcher.changeSize(w, h); // force a re-layout to match the new size
	}

	public menuAction(cmd:string):void
	{
		/*if (cmd == 'new') openNewWindow('DrawPanel');
		else if (cmd == 'open') this.actionFileOpen();
		else if (cmd == 'save') this.actionFileSave();
		else if (cmd == 'saveAs') this.actionFileSaveAs();
		else if (cmd == 'undo') this.sketcher.performUndo();
		else if (cmd == 'redo') this.sketcher.performRedo();
		else if (cmd == 'cut') this.actionCopy(true);
		else if (cmd == 'copy') this.actionCopy(false);
		else if (cmd == 'paste') this.actionPaste();
		else if (cmd == 'delete') new MoleculeActivity(this.sketcher, ActivityType.Delete, {});
		else if (cmd == 'selectAll') new MoleculeActivity(this.sketcher, ActivityType.SelectAll, {});
		else if (cmd == 'zoomFull') this.sketcher.autoScale();
		else if (cmd == 'zoomIn') this.sketcher.zoom(1.25);
		else if (cmd == 'zoomOut') this.sketcher.zoom(0.8);
		else console.log('MENU:'+cmd);*/
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
				{'name': 'SketchEl Molecule', 'extensions': ['el']},
				{'name': 'MDL Molfile', 'extensions': ['mol']}
			]
		};
		dialog.showOpenDialog(params, (filenames:string[]):void =>
		{
			let inPlace = this.sketcher.getMolecule().numAtoms == 0;
			if (filenames) for (let fn of filenames) 
			{
				if (inPlace)
				{
					this.loadFile(fn);
					inPlace = false;
				}
				else openNewWindow('DrawPanel', fn);
			}
		});
	}

	private actionFileSave():void
	{
		if (!this.filename) {this.actionFileSaveAs(); return;}

		let mol = this.sketcher.getMolecule();
		if (mol.numAtoms == 0) return;

		this.saveFile(this.filename);
	}

	private actionFileSaveAs():void
	{
		const electron = require('electron');
		const dialog = electron.remote.dialog; 
		let params:any =
		{
			'title': 'Save Molecule',
			//defaultPath...
			'filters':
			[
				{'name': 'SketchEl Molecule', 'extensions': ['el']},
				{'name': 'MDL Molfile', 'extensions': ['mol']}
			]
		};
		dialog.showSaveDialog({}, (filename:string):void =>
		{
			this.saveFile(filename);
			this.filename = filename;
			this.updateTitle();
		});
	}

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
		document.title = 'Mixtures - ' + this.filename.substring(slash + 1);
	}
}