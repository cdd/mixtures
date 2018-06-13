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
	lineName:JQuery;
	// ...quant
	areaDescr:JQuery = null;
	areaSyn:JQuery = null;
	lineFormula:JQuery;
	lineInChI:JQuery;
	lineInChIKey:JQuery;
	lineSMILES:JQuery;
	areaIdent:JQuery;
	areaLinks:JQuery;
	
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

		body.css('padding', '0 0 0 1em');
		let vertical = $('<div></div>').appendTo(body);
		vertical.css('overflow-y', 'scroll');
		vertical.css('height', '100%');
		vertical.css('max-height', (this.parentSize[1] - 200) + 'px');
		vertical.css('padding-right', '18px');
		vertical.css('padding-bottom', '10px');

		// first batch of fields

		let grid = this.fieldGrid().appendTo(vertical);

		this.createFieldName(grid, 1, 'Name');
		this.lineName = this.createValueLine(grid, 1);
		this.lineName.val(this.component.name);

		this.createFieldName(grid, 2, 'Quantity');
		this.createValueLine(grid, 2);
			// !! subsume: ratio, quantity, units, relation...

		let btnMore = $('<button class="wmk-button wmk-button-default">More...</button>').appendTo(vertical);
		btnMore.click(() => 
		{
			btnMore.remove();

			this.createFieldName(grid, 3, 'Description');
			this.areaDescr = this.createValueMultiline(grid, 3);
			this.areaDescr.keydown((event:JQueryEventObject) => this.trapEscape(event));

			this.createFieldName(grid, 4, 'Synonyms');
			this.areaSyn = this.createValueMultiline(grid, 4);
			this.areaSyn.keydown((event:JQueryEventObject) => this.trapEscape(event));

			this.areaDescr.val(this.component.description);
			if (this.component.synonyms) this.areaSyn.val(this.component.synonyms.join('\n'));
		});
/*
	ratio?:number[]; // a ratio, specified as [numerator, denominator]
	quantity?:number | number[]; // a concentration numeric which is associated with the units below (two numbers in case of a range)
	units?:string; // units for quantity (e.g. %, mol/L, g, etc.)
	relation?:string; // optional modifier when applied to quantity (e.g. >, <, ~)
*/

		let skw = Math.min(1000, Math.max(500, this.parentSize[0] - 100));
		let skh = Math.min(800, Math.max(450, this.parentSize[1] - 300));
		let skdiv = $('<div></div>').appendTo(vertical);
		skdiv.css('width', skw + 'px');
		skdiv.css('height', skh + 'px');
		skdiv.css('margin-top', '1em');

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

		// second batch of fields

		grid = this.fieldGrid().appendTo(vertical);

		this.createFieldName(grid, 1, 'Formula');
		this.lineFormula = this.createValueLine(grid, 1);
		this.lineFormula.val(this.component.formula);

		this.createFieldName(grid, 2, 'InChI');
		this.lineInChI = this.createValueLine(grid, 2);
		this.lineInChI.val(this.component.inchi);

		this.createFieldName(grid, 3, 'InChIKey');
		this.lineInChIKey = this.createValueLine(grid, 3);
		this.lineInChIKey.val(this.component.inchiKey);

		this.createFieldName(grid, 4, 'SMILES');
		this.lineSMILES = this.createValueLine(grid, 4);
		this.lineSMILES.val(this.component.smiles);

		this.createFieldName(grid, 5, 'Identifiers');
		this.areaIdent = this.createValueMultiline(grid, 5);
		let listID:string[] = [];
		if (this.component.identifiers) for (let key in this.component.identifiers) listID.push(key + '=' + this.component.identifiers[key]);
		this.areaIdent.val(listID.join('\n'));
		
		this.createFieldName(grid, 6, 'Links');
		this.areaLinks = this.createValueMultiline(grid, 6);
		let listLinks:string[] = [];
		if (this.component.links) for (let key in this.component.links) listLinks.push(key + '=' + this.component.links[key]);
		this.areaLinks.val(listLinks.join('\n'));

		this.lineName.focus();

		// trap the escape key, for easy closing
		body.find('input,textarea').keydown((event:JQueryEventObject) => this.trapEscape(event));
	}

	private copyComponent():void
	{
		// !! this.sketcher.performCopy();
	}

	// creates a 2-column grid for field/value entry
	private fieldGrid():JQuery
	{
		let div = $('<div></div>');
		div.css('display', 'grid');
		div.css('width', '100%');
		div.css('margin', '1em 0 1em 0');
		div.css('align-items', 'center'); // would be 'baseline', but breaks with textarea
		div.css('justify-content', 'start');
		div.css('grid-row-gap', '0.5em');
		div.css('grid-template-columns', '[start field] max-content [value] 1fr [end]');
		return div;
	}

	// creates a field name for inclusion in the grid
	private createFieldName(parent:JQuery, row:number, text:string):JQuery
	{
		let div = $('<div></div>').appendTo(parent);
		div.css('grid-column', 'field');
		div.css('grid-row', row.toString());
		div.css('padding-right', '0.5em');
		div.css('font-weight', 'bold');
		div.text(text);
		return div;
	}

	// returns single/multi-line editors
	private createValueLine(parent:JQuery, row:number):JQuery
	{
		let div = $('<div></div>').appendTo(parent);
		div.css('grid-column', 'value');
		div.css('grid-row', row.toString());
		let input = $('<input></input>').appendTo(div);
		input.css('width', '100%');
		input.css('font', 'inherit');
		//...
		return input;
	}
	private createValueMultiline(parent:JQuery, row:number):JQuery
	{
		let div = $('<div></div>').appendTo(parent);
		div.css('grid-column', 'value');
		div.css('grid-row', row.toString());
		let area = $('<textarea></textarea>').appendTo(div);
		area.attr('rows', '5');
		area.css('width', '100%');
		area.css('font', 'inherit');
		//...
		return area;
	}

	// make it so that line/text entry boxes trap the escape key to close the dialog box
	private trapEscape(event:JQueryEventObject):void
	{
		if (event.keyCode == 27) 
		{
			event.preventDefault(); 
			this.close();
		}
	}
}

/* EOF */ }