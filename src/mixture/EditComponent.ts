/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

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
///<reference path='../../../WebMolKit/src/ui/Widget.ts'/>

///<reference path='../main/startup.ts'/>
///<reference path='../data/Mixfile.ts'/>

namespace Mixtures /* BOF */ {

/*
	High level widget for the editing area for a mixture.
*/
	
export class EditComponent extends wmk.Dialog
{
	btnClear:JQuery;
	btnPaste:JQuery;
	btnCopy:JQuery;
	btnSave:JQuery;
	sketcher:wmk.Sketcher;
	
	fakeTextArea:HTMLTextAreaElement = null; // for temporarily bogarting the clipboard
	
	public callbackSave:(source?:EditComponent) => void = null;
		
	constructor(private component:MixfileComponent, private parentSize:[number, number])
	{
		super();
		
		this.title = 'Edit Component';
		this.minPortionWidth = 20;
		this.maxPortionWidth = 95;
		//this.maximumWidth = parentSize[0];
		this.maximumHeight = parentSize[1];
	}

	public onSave(callback:(source?:EditComponent) => void)
	{
		this.callbackSave = callback;
	}

	public getComponent():MixfileComponent {return this.component;}

	// builds the dialog content
	protected populate():void
	{
		let buttons = this.buttons(), body = this.body();
	
		// top section

        this.btnClear = $('<button class="wmk-button wmk-button-default">Clear</button>').appendTo(buttons);
		this.btnClear.click(() => this.sketcher.clearMolecule());

		buttons.append(' ');
        this.btnCopy = $('<button class="wmk-button wmk-button-default">Copy</button>').appendTo(buttons);
		this.btnCopy.click(() => this.copyComponent());

		buttons.append(' ');
		buttons.append(this.btnClose); // easy way to reorder
		
		buttons.append(' ');
        this.btnSave = $('<button class="wmk-button wmk-button-primary">Save</button>').appendTo(buttons);
		this.btnSave.click(() => {if (this.callbackSave) this.callbackSave(this);});
		
		// main section

		let vertical = $('<div></div>').appendTo(body);
		vertical.css('overflow-y', 'scroll');
		vertical.css('height', '100%');
		vertical.css('max-height', (this.parentSize[1] - 200) + 'px');
		vertical.css('padding-right', '18px');
		vertical.css('padding-bottom', '10px');

		let lineName = $('<p></p>').appendTo(vertical);;
		lineName.append('Name: ');

		let skw = Math.min(1000, Math.max(500, this.parentSize[0] - 100));
		let skh = Math.min(800, Math.max(450, this.parentSize[1] - 300));
		let skdiv = $('<div></div>').appendTo(vertical);
		skdiv.css('width', skw + 'px');
		skdiv.css('height', skh + 'px');

		this.sketcher = new wmk.Sketcher();
		this.sketcher.lowerCommandBank = true;
		this.sketcher.lowerTemplateBank = true;
		this.sketcher.setSize(skw, skh);
		if (this.component.molfile)
		{
			try 
			{
				let mol = new wmk.MDLMOLReader(this.component.molfile).parse();
				if (mol) this.sketcher.defineMolecule(mol);
			}
			catch (e) {}
		}
		this.sketcher.setup(() => this.sketcher.render(skdiv));
	}

	private copyComponent():void
	{
		// !! this.sketcher.performCopy();
	}
}

/* EOF */ }