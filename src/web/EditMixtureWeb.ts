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
///<reference path='../../../WebMolKit/src/ui/Widget.ts'/>
///<reference path='../../../WebMolKit/src/ui/ClipboardProxy.ts'/>
///<reference path='../../../WebMolKit/src/dialog/EditCompound.ts'/>

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>
///<reference path='../main/startup.ts'/>
///<reference path='../data/Mixfile.ts'/>
///<reference path='../mixture/EditMixture.ts'/>

namespace Mixtures /* BOF */ {

/*
	Modified version of the EditMixture class that replaces the default Electron desktop functionality
	with web-compatible equivalents.
*/

export class EditMixtureWeb extends EditMixture
{

	// ------------ public methods ------------

	constructor()
	{
		super();
	}

	public render(parent:any):void
	{
		super.render(parent);
	}

	// bring up the structure-editing panel, which uses the generic sketching dialog
	/*public editStructure():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);

		let mol = comp.molfile ? wmk.MoleculeStream.readUnknown(comp.molfile) : null;

		const {clipboard} = require('electron');
		let proxy = new wmk.ClipboardProxy();
		proxy.getString = ():string => clipboard.readText();
		proxy.setString = (str:string):void => clipboard.writeText(str);
		proxy.canAlwaysGet = ():boolean => true;

		this.dlgCompound = new wmk.EditCompound(mol ? mol : new wmk.Molecule());
		this.dlgCompound.onSave(() => 
		{
			let molfile = wmk.MoleculeStream.writeMDLMOL(this.dlgCompound.getMolecule());
			if (!molfile) molfile = null;

			comp = deepClone(comp);
			comp.molfile = molfile;
			let modmix = this.mixture.clone();
			if (modmix.setComponent(origin, comp)) this.setMixture(modmix);
			
			this.dlgCompound.close();
		});
		this.dlgCompound.onClose(() => 
		{
			this.isEditing = false;
			this.dlgCompound = null;
		});
		this.dlgCompound.defineClipboard(proxy);
		this.isEditing = true;
		this.dlgCompound.open();
	}*/

	// invoke the editor dialog for the current component - basically everything except the structure
	/*public editDetails():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);
		let curX = this.content.width(), curY = this.content.height();
		let dlg = new EditComponent(deepClone(comp), [curX, curY]);
		dlg.onSave(() =>
		{
			let modmix = this.mixture.clone();
			if (modmix.setComponent(origin, dlg.getComponent())) this.setMixture(modmix);
			dlg.close();
		});
		dlg.onSketch(() =>
		{
			for (let n = 0; n < this.layout.components.length; n++)
				if (Vec.equals(origin, this.layout.components[n].origin)) {this.selectedIndex = n; break;}
			this.editStructure();
		});
		dlg.onClose(() => this.isEditing = false);
		this.isEditing = true;
		dlg.open();
	}*/

	// lookup: searches for compound information based on name, prespecified or otherwise
	/*public lookupCurrent():void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		let comp = this.mixture.getComponent(origin);
		let curX = this.content.width(), curY = this.content.height();
		let dlg = new LookupCompoundDialog(comp.name, [curX, curY]);
		dlg.onSelect(() =>
		{
			let modmix = this.mixture.clone();
			comp = deepClone(modmix.getComponent(origin));
			let name = dlg.getName(), mol = dlg.getMolecule();
			if (name != null) comp.name = name;
			if (mol != null) comp.molfile = new wmk.MDLMOLWriter(mol).write();
			if (modmix.setComponent(origin, comp)) this.setMixture(modmix);
			dlg.close();
		});
		dlg.open();
	}*/

	// copy current to clipboard, and optionally excise it
	/*public clipboardCopy(andCut:boolean, wholeBranch:boolean = false):void
	{
		if (this.selectedIndex < 0) return;
		let origin = this.layout.components[this.selectedIndex].origin;
		
		let comp = deepClone(this.mixture.getComponent(origin));
		delete (<any>comp).mixfileVersion;
		if (!wholeBranch) comp.contents = [];
		let str = Mixture.serialiseComponent(comp);

		let clipboard = require('electron').clipboard;
		clipboard.writeText(str);

		if (origin.length > 0 && andCut) this.deleteCurrent();
	}

	// paste from clipboard, if possible
	public clipboardPaste():void
	{
		let clipboard = require('electron').clipboard;

		let str = clipboard.readText();
		let json:any = null;
		try {json = JSON.parse(str);}
		catch (e) {} // silent failure

		let origin:number[] = [];
		if (this.selectedIndex >= 0) origin = this.layout.components[this.selectedIndex].origin;

		if (!json) 
		{
			let mol = wmk.MoleculeStream.readUnknown(str);
			if (wmk.MolUtil.notBlank(mol))
			{
				let modmix = this.mixture.clone();
				let comp = modmix.getComponent(origin);
				if (comp)
				{
					comp.molfile = new wmk.MDLMOLWriter(mol).write();
					this.setMixture(modmix);
				}
			}
			else alert('Clipboard does not contain a mixture component.');
			return;
		}
		if (!json.name && !json.molfile && !json.quantity && Vec.isBlank(json.contents))
		{
			alert('Clipboard content is either not a component, or has no interesting content.');
			return;
		}
		//json.contents = []; // (should we allow whole branches? -- yes!)

		// special deal when pasting into nothing: just replace it
		if (this.selectedIndex < 0 && this.mixture.isEmpty())
		{
			let modmix = new Mixture(json);
			this.delayedSelect = [];
			this.setMixture(modmix);
			return;
		}

		// append to or replace some piece, preferably selected
		let modmix = this.mixture.clone();
		let comp = modmix.getComponent(origin);
		if (Mixture.isComponentEmpty(comp))
		{
			Object.keys(comp).forEach((key:string) => delete (<any>comp)[key]);
			Object.keys(json).forEach((key:string) => (<any>comp)[key] = json[key]);
			this.delayedSelect = origin;
		}
		else // append
		{
			if (!comp.contents) comp.contents = [];
			comp.contents.push(json);
			this.delayedSelect = Vec.concat(origin, [comp.contents.length - 1]);
		}
		this.setMixture(modmix);
	}*/

	// ------------ private methods ------------
	
	protected contextMenu(event:JQueryEventObject):void
	{
		/*
		event.preventDefault();

		let comp = this.pickComponent(event.clientX, event.clientY);
		
		let electron = require('electron');
		let menu = new electron.remote.Menu();
		if (comp >= 0)
		{
			let compObj = this.layout.components[comp].content, origin = this.layout.components[comp].origin;
			menu.append(new electron.remote.MenuItem({'label': 'Edit Structure', 'click': () => {this.selectComponent(comp); this.editStructure();}}));
			menu.append(new electron.remote.MenuItem({'label': 'Edit Details', 'click': () => {this.selectComponent(comp); this.editDetails();}}));
			menu.append(new electron.remote.MenuItem({'label': 'Lookup Name', 'click': () => {this.selectComponent(comp); this.lookupCurrent();}}));
			menu.append(new electron.remote.MenuItem({'label': 'Append', 'click': () => {this.selectComponent(comp); this.appendToCurrent();}}));
			if (origin.length > 0)
			{
				menu.append(new electron.remote.MenuItem({'label': 'Prepend', 'click': () => {this.selectComponent(comp); this.prependBeforeCurrent();}}));
				menu.append(new electron.remote.MenuItem({'label': 'Delete', 'click': () => {this.selectComponent(comp); this.deleteCurrent();}}));

				if (origin[origin.length - 1] > 0)
					menu.append(new electron.remote.MenuItem({'label': 'Move Up', 'click': () => {this.selectComponent(comp); this.reorderCurrent(-1);}}));
				if (origin[origin.length - 1] < Vec.arrayLength(this.mixture.getParentComponent(origin).contents) - 1)
					menu.append(new electron.remote.MenuItem({'label': 'Move Down', 'click': () => {this.selectComponent(comp); this.reorderCurrent(1);}}));
			}

			menu.append(new electron.remote.MenuItem({'label': 'Copy', 'click': () => {this.selectComponent(comp); this.clipboardCopy(false);}}));
			if (Vec.arrayLength(compObj.contents) > 0)
				menu.append(new electron.remote.MenuItem({'label': 'Copy Branch', 'click': () => {this.selectComponent(comp); this.clipboardCopy(false, true);}}));
			if (origin.length > 0)
				menu.append(new electron.remote.MenuItem({'label': 'Cut', 'click': () => {this.selectComponent(comp); this.clipboardCopy(true);}}));
			menu.append(new electron.remote.MenuItem({'label': 'Paste', 'click': () => {this.selectComponent(comp); this.clipboardPaste();}}));
		}
		else
		{
			menu.append(new electron.remote.MenuItem({'label': 'Zoom In', 'click': () => this.zoom(1.25)}));
			menu.append(new electron.remote.MenuItem({'label': 'Zoom Out', 'click': () => this.zoom(0.8)}));
		}

		menu.popup(electron.remote.getCurrentWindow());
		*/
	}
}

/* EOF */ }