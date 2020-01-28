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
///<reference path='../../../WebMolKit/src/data/MDLReader.ts'/>
///<reference path='../../../WebMolKit/src/data/MDLWriter.ts'/>
///<reference path='../../../WebMolKit/src/gfx/Rendering.ts'/>
///<reference path='../../../WebMolKit/src/ui/Widget.ts'/>
///<reference path='../../../WebMolKit/src/ui/OptionList.ts'/>
///<reference path='../../../WebMolKit/src/dialog/Dialog.ts'/>

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>
///<reference path='../startup.ts'/>
///<reference path='../main/InChI.ts'/>
///<reference path='../data/Mixfile.ts'/>

namespace Mixtures /* BOF */ {

/*
	High level widget for the editing area for a mixture.
*/

enum QuantityType
{
	Value = 'Value',
	Range = 'Range',
	Ratio = 'Ratio'
}
const RELATION_VALUES:string[] = ['=', '~', '<', '<=', '>', '>='];
const RELATION_LABELS:string[] = ['=', '~', '&lt;', '&le;', '&gt;', '&ge;'];

export class EditComponent extends wmk.Dialog
{
	//private btnClear:JQuery;
	private btnSketch:JQuery;
	private btnPaste:JQuery;
	private btnCopy:JQuery;
	private btnSave:JQuery;

	//private sketcher:wmk.Sketcher;
	private lineName:JQuery;
	private optQuantType:wmk.OptionList;
	private dropQuantRel:JQuery;
	private lineQuantVal1:JQuery;
	private lineQuantVal2:JQuery;
	private dropQuantUnits:JQuery;
	private areaDescr:JQuery = null;
	private areaSyn:JQuery = null;
	private lineFormula:JQuery;
	private lineInChI:JQuery;
	private lineSMILES:JQuery;
	private areaIdent:JQuery;
	private areaLinks:JQuery;

	private fakeTextArea:HTMLTextAreaElement = null; // for temporarily bogarting the clipboard

	private callbackSave:(source?:EditComponent) => void = null;
	private callbackSketch:(source?:EditComponent) => void = null;

	// ------------ public methods ------------

	constructor(private component:MixfileComponent, private parentSize:[number, number])
	{
		super();

		this.title = 'Edit Component';
		this.minPortionWidth = 20;
		this.maxPortionWidth = 95;
		//this.maximumWidth = parentSize[0];
		this.maximumHeight = parentSize[1];
	}

	public onSave(callback:(source?:EditComponent) => void):void
	{
		this.callbackSave = callback;
	}
	public onSketch(callback:(source?:EditComponent) => void):void
	{
		this.callbackSketch = callback;
	}

	public getComponent():MixfileComponent {return this.component;}

	// builds the dialog content
	protected populate():void
	{
		let buttons = this.buttons(), body = this.body();

		// top section

		//this.btnClear = $('<button class="wmk-button wmk-button-default">Clear</button>').appendTo(buttons);
		//this.btnClear.click(() => this.sketcher.clearMolecule());
		if (this.callbackSketch)
		{
			this.btnSketch = $('<button class="wmk-button wmk-button-default">Sketch</button>').appendTo(buttons);
			this.btnSketch.click(() => this.invokeSketcher());
		}

		/*buttons.append(' ');
		this.btnCopy = $('<button class="wmk-button wmk-button-default">Copy</button>').appendTo(buttons);
		this.btnCopy.click(() => this.copyComponent());*/

		buttons.append(' ');
		buttons.append(this.btnClose); // easy way to reorder

		buttons.append(' ');
		this.btnSave = $('<button class="wmk-button wmk-button-primary">Save</button>').appendTo(buttons);
		this.btnSave.click(() => this.saveAndClose());

		// main section

		body.css('padding', '0 0 0 1em');
		let vertical = $('<div/>').appendTo(body);
		vertical.css('overflow-y', 'scroll');
		vertical.css('height', '100%');
		vertical.css('max-height', (this.parentSize[1] - 200) + 'px');
		vertical.css('padding-right', '18px');
		vertical.css('padding-bottom', '10px');

		// first batch of fields

		let grid1 = this.fieldGrid().appendTo(vertical);

		this.createFieldName(grid1, 1, 'Name');
		this.lineName = this.createValueLine(grid1, 1);
		this.lineName.val(this.component.name);

		this.createFieldName(grid1, 2, 'Quantity');
		let divQuant = $('<div/>').appendTo(grid1);
		divQuant.css({'grid-column': 'value', 'grid-row': '2'});
		this.createQuantity(divQuant);

		this.createFieldName(grid1, 3, 'Description');
		this.areaDescr = this.createValueMultiline(grid1, 3);
		this.areaDescr.keydown((event:JQueryEventObject) => this.trapEscape(event));

		this.createFieldName(grid1, 4, 'Synonyms');
		this.areaSyn = this.createValueMultiline(grid1, 4);
		this.areaSyn.keydown((event:JQueryEventObject) => this.trapEscape(event));

		this.areaDescr.val(this.component.description);
		if (this.component.synonyms) this.areaSyn.val(this.component.synonyms.join('\n'));

		// second batch of fields

		let grid2 = this.fieldGrid().appendTo(vertical);
		let line = 0;

		this.createFieldName(grid2, ++line, 'Formula');
		this.lineFormula = this.createValueLine(grid2, line);
		this.lineFormula.val(this.component.formula);

		this.createFieldName(grid2, ++line, 'InChI');
		this.lineInChI = this.createValueLine(grid2, line);
		this.lineInChI.val(this.component.inchi);

		if (InChI.isAvailable() && this.component.molfile)
		{
			let div = this.createDiv(grid2, ++line);
			let btn = $('<button class="wmk-button wmk-button-default">Calculate from Structure</button>').appendTo(div);
			btn.click(() => this.calculateInChI().then());
		}

		this.createFieldName(grid2, ++line, 'SMILES');
		this.lineSMILES = this.createValueLine(grid2, line);
		this.lineSMILES.val(this.component.smiles);

		this.createFieldName(grid2, ++line, 'Identifiers');
		this.areaIdent = this.createValueMultiline(grid2, line);
		let listID:string[] = [];
		if (this.component.identifiers) for (let key in this.component.identifiers) listID.push(key + '=' + this.component.identifiers[key]);
		this.areaIdent.val(listID.join('\n'));

		this.createFieldName(grid2, ++line, 'Links');
		this.areaLinks = this.createValueMultiline(grid2, line);
		let listLinks:string[] = [];
		if (this.component.links) for (let key in this.component.links) listLinks.push(key + '=' + this.component.links[key]);
		this.areaLinks.val(listLinks.join('\n'));

		this.lineName.focus();

		// trap the escape key, for easy closing
		body.find('input,textarea').keydown((event:JQueryEventObject) => this.trapEscape(event));
	}

	// ------------ private methods ------------

	// assuming that something is different, refreshes the current component information and closes
	private saveAndClose():void
	{
		let nullifyBlank = (str:string):string => str === '' ? null : str;
		let splitLines = (str:string):string[] =>
		{
			let lines = str.split('\n').filter((line) => line.length > 0);
			return lines.length > 0 ? lines : null;
		};
		let splitKeys = (str:string):Record<string, any> =>
		{
			let dict:Record<string, any> = null;
			for (let line of str.split('\n'))
			{
				let eq = line.indexOf('=');
				if (eq < 0) continue;
				if (dict == null) dict = {};
				dict[line.substring(0, eq)] = line.substring(eq + 1);
			}
			return dict;
		};

		this.component.name = nullifyBlank(this.lineName.val());

		let qtype = this.optQuantType.getSelectedValue();
		[this.component.ratio, this.component.quantity, this.component.error] = [null, null, null];
		let strQuant1 = this.lineQuantVal1.val().trim(), strQuant2 = this.lineQuantVal2.val().trim();
		if (qtype == QuantityType.Value)
		{
			if (strQuant1) this.component.quantity = parseFloat(strQuant1);
			if (strQuant2) this.component.error = parseFloat(strQuant2);
		}
		else if (qtype == QuantityType.Range)
		{
			this.component.quantity = [parseFloat(strQuant1), parseFloat(strQuant2)];
			this.component.relation = null;
		}
		else if (qtype == QuantityType.Ratio)
		{
			this.component.ratio = [parseFloat(strQuant1), parseFloat(strQuant2)];
			this.component.relation = null;
			this.component.units = null;
		}

		if (this.areaDescr) this.component.description = nullifyBlank(this.areaDescr.val());

		this.component.synonyms = splitLines(this.areaSyn.val());

		this.component.formula = nullifyBlank(this.lineFormula.val());
		this.component.inchi = nullifyBlank(this.lineInChI.val());
		this.component.smiles = nullifyBlank(this.lineSMILES.val());

		this.component.identifiers = splitKeys(this.areaIdent.val());
		this.component.links = splitKeys(this.areaLinks.val());

		// remove explicit nulls, for clarity
		//Object.keys(this.component).forEach((key:string) => {if ((<any>this.component)[key] == null) delete (<any>this.component)[key];});

		//console.log(JSON.stringify(this.component));
		this.callbackSave(this);
	}

	// change to sketch mode: close this dialog, save everything, then tell the parent to sketch instead
	private invokeSketcher():void
	{
		this.saveAndClose();
		this.callbackSketch(this);
	}

	// creates a 2-column grid for field/value entry
	private fieldGrid():JQuery
	{
		let div = $('<div/>').css({'display': 'grid', 'width': '100%', 'margin': '1em 0 1em 0'});
		div.css('align-items', 'center'); // would be 'baseline', but breaks with textarea
		div.css('justify-content', 'start');
		div.css('grid-row-gap', '0.5em');
		div.css('grid-template-columns', '[start field] max-content [value] 1fr [end]');
		return div;
	}

	// creates a field name for inclusion in the grid
	private createFieldName(parent:JQuery, row:number, text:string):JQuery
	{
		let div = $('<div/>').appendTo(parent);
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
		let div = $('<div/>').appendTo(parent);
		div.css('grid-column', 'value');
		div.css('grid-row', row.toString());
		let input = $('<input/>').appendTo(div);
		input.css({'width': '100%', 'font': 'inherit'});
		//...
		return input;
	}
	private createValueMultiline(parent:JQuery, row:number):JQuery
	{
		let div = $('<div/>').appendTo(parent);
		div.css('grid-column', 'value');
		div.css('grid-row', row.toString());
		let area = $('<textarea/>').appendTo(div);
		area.attr('rows', '5');
		area.css('width', '100%');
		area.css('font', 'inherit');
		//...
		return area;
	}

	private createDiv(parent:JQuery, row:number):JQuery
	{
		let div = $('<div/>').appendTo(parent);
		div.css('grid-column', 'value');
		div.css('grid-row', row.toString());
		return div;
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

	// creates the quantity data entry objects, which are somewhat fiddly and multistate
	private createQuantity(parent:JQuery):void
	{
		let flex = $('<div/>').appendTo(parent);
		flex.css('display', 'flex');
		flex.css('align-items', 'center');
		let box = ():JQuery => $('<div style="padding-left: 0.5em;"/>').appendTo(flex);

		this.optQuantType = new wmk.OptionList([QuantityType.Value, QuantityType.Range, QuantityType.Ratio]);
		this.optQuantType.render(flex);

		this.dropQuantRel = this.makeDropdownGroup(box(), this.component.relation, RELATION_VALUES, RELATION_LABELS,
									(value:string, label:string) => {this.component.relation = value;});

		this.lineQuantVal1 = $('<input/>').appendTo(box());
		this.lineQuantVal1.attr('size', '10');
		this.lineQuantVal1.css('font', 'inherit');

		let spanGap = $('<span/>').appendTo(flex);
		spanGap.css('padding', '0 0.5em 0 0.5em');

		this.lineQuantVal2 = $('<input/>').appendTo(box());
		this.lineQuantVal2.attr('size', '10');
		this.lineQuantVal2.css('font', 'inherit');

		let unitValues = Vec.prepend(Units.standardList(), ''), unitLabels = Vec.prepend(Units.commonNames(), '');
		this.dropQuantUnits = this.makeDropdownGroup(box(), this.component.units, unitValues, unitLabels,
									(value:string, label:string) => {this.component.units = label;});

		let changeToValue = ():void =>
		{
			this.dropQuantRel.css('display', 'block');
			spanGap.html('&plusmn;');
			this.dropQuantUnits.css('display', 'block');
		};
		let changeToRange = ():void =>
		{
			this.dropQuantRel.css('display', 'none');
			spanGap.html('to');
			this.dropQuantUnits.css('display', 'block');
		};
		let changeToRatio = ():void =>
		{
			this.dropQuantRel.css('display', 'none');
			spanGap.html('/');
			this.dropQuantUnits.css('display', 'none');
		};

		if (this.component.ratio != null)
		{
			this.optQuantType.setSelectedValue(QuantityType.Ratio);
			if (this.component.ratio)
			{
				let [numer, denom] = this.component.ratio;
				this.lineQuantVal1.val(numer.toString());
				this.lineQuantVal2.val(denom.toString());
			}
			changeToRatio();
		}
		else if (Array.isArray(this.component.quantity))
		{
			this.optQuantType.setSelectedValue(QuantityType.Range);
			let [low, high] = this.component.quantity;
			if (low != null) this.lineQuantVal1.val(low.toString());
			if (high != null) this.lineQuantVal2.val(high.toString());
			changeToRange();
		}
		else
		{
			this.optQuantType.setSelectedValue(QuantityType.Value);
			if (this.component.quantity != null) this.lineQuantVal1.val(this.component.quantity.toString());
			if (this.component.error != null) this.lineQuantVal2.val(this.component.error.toString());
			changeToValue();
		}

		this.optQuantType.callbackSelect = (idx:number) => {if (idx == 0) changeToValue(); else if (idx == 1) changeToRange(); else if (idx == 2) changeToRatio();};
	}

	// creates a dropdown list with a prescribed list of choices; the first one will be selected if current matches nothing
	private makeDropdownGroup(parent:JQuery, current:string, values:string[], labels:string[], changeFunc:(value:string, label:string) => void):JQuery
	{
		let drop = $('<select/>').appendTo(parent);
		drop.css('height', '2.3em');
		for (let n = 0; n < values.length; n++)
		{
			let opt = $('<option/>').appendTo(drop);
			opt.attr('value', n.toString());
			opt.html(labels[n]);
			if (current == values[n] || current == labels[n]) opt.attr('selected', true);
		}
		drop.change(() => {let idx = parseInt(drop.val()); changeFunc(values[idx], labels[idx]);});
		return drop;
	}

	// uses the structure (if any) to calculate the InChI, and fill in the field value
	private async calculateInChI():Promise<void>
	{
		if (!InChI.isAvailable()) return;
		//let mol = this.sketcher.getMolecule();
		let mol = wmk.MoleculeStream.readUnknown(this.component.molfile);
		if (wmk.MolUtil.isBlank(mol))
		{
			//alert('Draw a molecule first, then calculate the InChI.');
			return;
		}

		try
		{
			let inchi = await InChI.makeInChI(mol);
			this.lineInChI.val(inchi);
		}
		catch (ex) {alert('InChI generation failed: ' + ex);}
	}
}

/* EOF */ }