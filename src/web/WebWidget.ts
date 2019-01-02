/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

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
///<reference path='../../../WebMolKit/src/ui/Widget.ts'/>
///<reference path='../../../WebMolKit/src/ui/WebMenu.ts'/>

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

export class WebWidget extends wmk.Widget
{
	private filename:string = null;
	private menu:wmk.WebMenu;
	private editor = new EditMixtureWeb();
	
	// ------------ public methods ------------

	constructor()
	{
		super();

		this.menu = new wmk.WebMenu(
		[
			{
				'label': 'File',
				'submenu': 
				[
					{'label': 'Clear', 'click': () => this.actionClear()},
					{'label': 'Save', 'click': () => this.actionSave()},
					{'label': 'Export SDF...', 'click': () => this.actionExportSDF()},
					{'label': 'Export as SVG', 'click': () => this.actionExportSVG()},
				]
			},
			{
				'label': 'Edit',
				'submenu': 
				[
					{'label': 'Edit Details', 'click': () => this.editor.editDetails()},
					{'label': 'Edit Structure', 'click': () => this.editor.editStructure()},
					{'label': 'Delete', 'click': () => this.editor.deleteCurrent()},
					{'label': 'Append', 'click': () => this.editor.appendToCurrent()},
					{'label': 'Prepend', 'click': () => this.editor.prependBeforeCurrent()},
					{'label': 'Move Up', 'click': () => this.editor.reorderCurrent(-1)},
					{'label': 'Move Down', 'click': () => this.editor.reorderCurrent(1)},
					//{'type': 'separator'},
					{'label': 'Undo', 'click': () => this.editor.performUndo()},
					{'label': 'Redo', 'click': () => this.editor.performRedo()},
					//{'type': 'separator'},
					{'label': 'Cut', 'click': () => this.editor.clipboardCopy(true)},
					{'label': 'Copy', 'click': () => this.editor.clipboardCopy(false)},
					{'label': 'Copy Branch', 'click': () => this.editor.clipboardCopy(false, true)},
					{'label': 'Paste', 'click': () => this.editor.clipboardPaste()},
				]
			},
			{
				'label': 'View',
				'submenu': 
				[
					{'label': 'Normal Size', 'click': () => this.editor.zoomFull()},
					{'label': 'Zoom In', 'click': () => this.editor.zoom(1.25)},
					{'label': 'Zoom Out', 'click': () => this.editor.zoom(0.8)},
				]
			}
		]);

		this.editor.callbackUpdateTitle = () => {};
	}

	public render(parent:any, width?:number, height?:number):void
	{
		super.render(parent);

		this.content.css({'width': width, 'height': height});
		this.content.css('border', '1px solid black');
		this.content.css('display', 'flex');
		this.content.css('flex-direction', 'column');

		let divMenu = $('<div style="width: 100%; flex-grow: 0;"></div>').appendTo(this.content);
		let divMain = $('<div style="width: 100%; flex: 1 1 0; height: 100%; position: relative;"></div>').appendTo(this.content);
		let divMainX = $('<div style="position: absolute; top: 0; right: 0; bottom: 0; left: 0;"></div>').appendTo(divMain); // workaround
		
		this.menu.render(divMenu);
		this.editor.render(divMainX);
	}

	public setMixture(mixture:Mixture):void
	{
		this.editor.clearHistory();
		this.editor.setMixture(mixture, true, false);
		this.editor.setDirty(false);
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