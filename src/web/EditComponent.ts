/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2025 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Dialog} from 'webmolkit/dialog/Dialog';
import {ClipboardProxy, ClipboardProxyHandler} from 'webmolkit/ui/ClipboardProxy';
import {dom, DOM} from 'webmolkit/util/dom';
import {OptionList} from 'webmolkit/ui/OptionList';
import {deepClone} from 'webmolkit/util/util';
import {installInlineCSS} from 'webmolkit/util/Theme';
import {OntologyTree} from 'webmolkit/data/OntologyTree';
import {Vec} from 'webmolkit/util/Vec';
import {Popup} from 'webmolkit/ui/Popup';
import {MoleculeStream} from 'webmolkit/io/MoleculeStream';
import {MolUtil} from 'webmolkit/mol/MolUtil';
import {Chemistry} from 'webmolkit/mol/Chemistry';
import {MixfileComponent} from '../mixture/Mixfile';
import {InChI} from '../nodejs/InChI';
import {Mixture} from '../mixture/Mixture';
import {Units} from '../mixture/Units';
import {InChIDelegate} from '../mixture/InChIDelegate';
import {KeyValueWidget} from './KeyValueWidget';
import {MetadataWidget} from '../electron/MetadataWidget';

/*
	High level widget for the editing area for a mixture.
*/

const CSS_EDITCOMPONENT = `
	*.wmk-editcomponent-input
	{
	}
	*.wmk-editcomponent-input::placeholder
	{
		font-size: 70%;
		color: #D0D0D0;
	}
	*.wmk-editcomponent-units
	{
		cursor: pointer;
	}
	*.wmk-editcomponent-units:hover
	{
		background-color: #C0C0FF;
		cursor: pointer;
	}
`;

enum QuantityType
{
	Value = 'Value',
	Range = 'Range',
	Ratio = 'Ratio'
}
const RELATION_VALUES:string[] = ['=', '~', '<', '<=', '>', '>='];
const RELATION_LABELS:string[] = ['=', '~', '&lt;', '&le;', '&gt;', '&ge;'];

export class EditComponent extends Dialog
{
	public proxyClip:ClipboardProxy = null;

	private component:MixfileComponent;

	private btnSketch:DOM;
	private btnSave:DOM;

	private lineName:DOM;
	private optQuantType:OptionList;
	private dropQuantRel:DOM;
	private lineQuantVal1:DOM;
	private lineQuantVal2:DOM;
	private lineQuantUnits:DOM;
	private btnQuantUnits:DOM;
	private areaDescr:DOM = null;
	private areaSyn:DOM = null;
	private lineFormula:DOM;
	private divWeight:DOM;
	private lineInChI:DOM;
	private lineSMILES:DOM;

	private callbackSave:(source?:EditComponent) => void = null;
	private callbackSketch:(source?:EditComponent) => void = null;

	// ------------ public methods ------------

	constructor(component:MixfileComponent, private inchi:InChIDelegate, private parentSize:[number, number], parent:DOM = null)
	{
		super(parent);

		this.component = deepClone(component);

		this.title = 'Edit Component';
		this.minPortionWidth = 20;
		this.maxPortionWidth = 95;
		//this.maximumWidth = parentSize[0];
		//this.maximumHeight = parentSize[1];

		installInlineCSS('editcomponent', CSS_EDITCOMPONENT);
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
		if (this.proxyClip) this.proxyClip.pushHandler(new ClipboardProxyHandler());

		let buttons = this.buttonsDOM(), body = this.bodyDOM();

		// top section

		if (this.callbackSketch)
		{
			this.btnSketch = dom('<button class="wmk-button wmk-button-default">Sketch</button>').appendTo(buttons);
			this.btnSketch.onClick(() => this.invokeSketcher());
		}

		buttons.appendText(' ');
		buttons.append(this.domClose); // easy way to reorder

		buttons.appendText(' ');
		this.btnSave = dom('<button class="wmk-button wmk-button-primary">Save</button>').appendTo(buttons);
		this.btnSave.onClick(() => this.saveAndClose());

		// main section

		body.css({'padding': '0 0 0 1em'});
		let vertical = dom('<div/>').appendTo(body);
		vertical.css({'overflow-y': 'scroll', 'height': '100%'});
		vertical.css({'max-height': this.parentSize[1] + 'px'});
		vertical.css({'padding-right': '18px', 'padding-bottom': '10px'});

		// first batch of fields

		let grid1 = this.fieldGrid().appendTo(vertical);

		this.createFieldName(grid1, 1, 'Name', false);
		this.lineName = this.createValueLine(grid1, 1);
		this.lineName.setValue(this.component.name);

		this.createFieldName(grid1, 2, 'Quantity', false);
		let divQuant = dom('<div/>').appendTo(grid1);
		divQuant.css({'grid-column': 'value', 'grid-row': '2'});
		this.createQuantity(divQuant);

		this.createFieldName(grid1, 3, 'Description', true);
		this.areaDescr = this.createValueMultiline(grid1, 3);

		this.createFieldName(grid1, 4, 'Synonyms', true);
		this.areaSyn = this.createValueMultiline(grid1, 4);

		this.areaDescr.setValue(this.component.description);
		if (this.component.synonyms) this.areaSyn.setValue(this.component.synonyms.join('\n'));

		// second batch of fields

		let grid2 = this.fieldGrid().appendTo(vertical);
		let row = 0;

		//this.createFieldName(grid2, ++row, 'Formula', false);
		row++;
		this.createFieldName(grid2, ++row, 'Formula', false);
		let divFormula = this.createDiv(grid2, row).css({'display': 'flex', 'align-items': 'center'});
		this.lineFormula = dom('<input/>').appendTo(divFormula).css({'flex-grow': '1', 'font': 'inherit'});
		this.lineFormula.setValue(this.component.formula);
		this.lineFormula.elInput.placeholder = this.calculateFormula();
		this.lineFormula.onInput(() => this.calculateWeight());
		this.divWeight = dom('<div/>').appendTo(divFormula).css({'flex-grow': '0'});
		this.calculateWeight();

		this.createFieldName(grid2, ++row, 'InChI', false);
		this.lineInChI = this.createValueLine(grid2, row);
		this.lineInChI.setValue(this.component.inchi);

		if (InChI.isAvailable() && this.component.molfile)
		{
			let div = this.createDiv(grid2, ++row);
			let btn = dom('<button class="wmk-button wmk-button-default">Calculate from Structure</button>').appendTo(div);
			btn.onClick(() => {this.calculateInChI().then();});
		}

		this.createFieldName(grid2, ++row, 'SMILES', false);
		this.lineSMILES = this.createValueLine(grid2, row);
		this.lineSMILES.setValue(this.component.smiles);

		this.createFieldName(grid2, ++row, 'Identifiers', true);
		let editIdentifiers = new KeyValueWidget(this.component.identifiers, (dict) =>
		{
			this.component.identifiers = dict;
		});
		editIdentifiers.render(dom('<div/>').appendTo(grid2).css({'grid-area': `${row} / value`}));

		this.createFieldName(grid2, ++row, 'Links', true);
		let editLinks = new KeyValueWidget(this.component.links, (dict) =>
		{
			this.component.links = dict;
		});
		editLinks.render(dom('<div/>').appendTo(grid2).css({'grid-area': `${row} / value`}));

		if (OntologyTree.main && OntologyTree.main.getRoots().length > 0)
		{
			this.createFieldName(grid2, ++row, 'Metadata', true);
			let editMetadata = new MetadataWidget(this.component.metadata, (metadata) =>
			{
				this.component.metadata = Vec.notBlank(metadata) ? metadata : undefined;
			});
			editMetadata.render(dom('<div/>').appendTo(grid2).css({'grid-area': `${row} / value`}));
		}

		this.lineName.grabFocus();

		for (let dom of body.findAll('input')) dom.onKeyDown((event) => this.trapEscape(event, true));
		for (let dom of body.findAll('textarea')) dom.onKeyDown((event) => this.trapEscape(event, false));
		for (let dom of body.findAll('input,textarea')) dom.elInput.spellcheck = false;
	}

	public close():void
	{
		if (this.proxyClip) this.proxyClip.popHandler();
		super.close();
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

		this.component.name = nullifyBlank(this.lineName.getValue());

		let qtype = this.optQuantType.getSelectedValue();
		[this.component.ratio, this.component.quantity, this.component.error] = [null, null, null];
		let strQuant1 = this.lineQuantVal1.getValue().trim(), strQuant2 = this.lineQuantVal2.getValue().trim();
		if (qtype == QuantityType.Value)
		{
			if (strQuant1) this.component.quantity = parseFloat(strQuant1);
			if (strQuant2) this.component.error = parseFloat(strQuant2);
			this.component.units = this.lineQuantUnits.getValue().trim();
		}
		else if (qtype == QuantityType.Range)
		{
			this.component.quantity = [parseFloat(strQuant1), parseFloat(strQuant2)];
			this.component.relation = null;
			this.component.units = this.lineQuantUnits.getValue().trim();
		}
		else if (qtype == QuantityType.Ratio)
		{
			this.component.ratio = [parseFloat(strQuant1), parseFloat(strQuant2)];
			this.component.relation = null;
			this.component.units = null;
		}

		if (!Mixture.hasQuantity(this.component))
		{
			this.component.quantity = null;
			this.component.error = null;
			this.component.ratio = null;
			this.component.units = null;
			this.component.relation = null;
		}

		if (this.areaDescr) this.component.description = nullifyBlank(this.areaDescr.getValue());

		this.component.synonyms = splitLines(this.areaSyn.getValue());

		this.component.formula = nullifyBlank(this.lineFormula.getValue());
		this.component.inchi = nullifyBlank(this.lineInChI.getValue());
		this.component.smiles = nullifyBlank(this.lineSMILES.getValue());

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
	private fieldGrid():DOM
	{
		let div = dom('<div/>').css({'display': 'grid', 'width': '100%', 'margin': '1em 0 1em 0'});
		div.css({'align-items': 'center'}); // would be 'baseline', but breaks with textarea
		div.css({'justify-content': 'start', 'grid-row-gap': '0.5em'});
		div.css({'grid-template-columns': '[start field] max-content [value] 1fr [end]'});
		return div;
	}

	// creates a field name for inclusion in the grid
	private createFieldName(parent:DOM, row:number, text:string, topAlign:boolean):DOM
	{
		let div = dom('<div/>').appendTo(parent);
		div.css({'grid-column': 'field', 'grid-row': row.toString(), 'align-self': topAlign ? 'baseline' : 'center'});
		if (topAlign) div.css({'padding-top': '0.2em'}); // baseline fudge
		div.css({'padding-right': '0.5em', 'font-weight': 'bold'});
		div.setText(text);
		return div;
	}

	// returns single/multi-line editors
	private createValueLine(parent:DOM, row:number):DOM
	{
		let div = dom('<div/>').appendTo(parent).css({'grid-area': `${row} / value`});
		let input = dom('<input/>').appendTo(div);
		input.css({'width': 'calc(100% - 4px)', 'padding': '0', 'font': 'inherit'});
		return input;
	}
	private createValueMultiline(parent:DOM, row:number):DOM
	{
		let div = dom('<div/>').appendTo(parent).css({'grid-area': `${row} / value`});
		let area = dom('<textarea/>').appendTo(div);
		area.attr({'rows': '5'});
		area.css({'width': 'calc(100% - 4px)', 'padding': '0', 'font': 'inherit'});
		return area;
	}

	private createDiv(parent:DOM, row:number):DOM
	{
		let div = dom('<div/>').appendTo(parent);
		div.css({'grid-column': 'value', 'grid-row': row.toString()});
		return div;
	}

	// make it so that line/text entry boxes trap the escape key to close the dialog box
	private trapEscape(event:KeyboardEvent, andEnter:boolean):void
	{
		if (event.keyCode == 27)
		{
			event.preventDefault();
			event.stopPropagation();
			this.close();
		}
		else if (andEnter && event.keyCode == 13)
		{
			if (this.interpretQuantString()) return;
			event.preventDefault();
			event.stopPropagation();
			this.saveAndClose();
		}
	}

	// creates the quantity data entry objects, which are somewhat fiddly and multistate
	private createQuantity(parent:DOM):void
	{
		let flex = dom('<div/>').appendTo(parent);
		flex.css({'display': 'flex', 'align-items': 'center'});
		let box = ():DOM => dom('<div style="padding-left: 0.5em;"/>').appendTo(flex);

		this.optQuantType = new OptionList([QuantityType.Value, QuantityType.Range, QuantityType.Ratio]);
		this.optQuantType.render(flex);

		this.dropQuantRel = this.makeDropdownGroup(box(), this.component.relation, RELATION_VALUES, RELATION_LABELS,
									(value:string, label:string) => {this.component.relation = value;});

		this.lineQuantVal1 = dom('<input/>').appendTo(box()).class('wmk-editcomponent-input');
		this.lineQuantVal1.attr({'size': '10'});
		this.lineQuantVal1.onChange(() => this.interpretQuantString());

		let spanGap = dom('<span/>').appendTo(flex).css({'padding': '0 0.5em 0 0.5em'});

		this.lineQuantVal2 = dom('<input/>').appendTo(box()).class('wmk-editcomponent-input');
		this.lineQuantVal2.attr({'size': '10'});

		let qubox = box();
		this.lineQuantUnits = dom('<input/>').appendTo(qubox).class('wmk-editcomponent-input');
		this.lineQuantUnits.attr({'size': '10', 'placeholder': 'units'});
		this.btnQuantUnits = dom('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(qubox).css({'margin-left': '0.2em'});
		this.btnQuantUnits.setText('\u{25BC}');
		this.btnQuantUnits.onClick(() => this.selectDropUnits());

		let changeToValue = ():void =>
		{
			this.dropQuantRel.setCSS('display', 'block');
			spanGap.setHTML('&plusmn;');
			this.lineQuantUnits.setCSS('display', 'inline-block');
			this.btnQuantUnits.setCSS('display', 'inline-block');
		};
		let changeToRange = ():void =>
		{
			this.dropQuantRel.setCSS('display', 'none');
			spanGap.setHTML('to');
			this.lineQuantUnits.setCSS('display', 'inline-block');
			this.btnQuantUnits.setCSS('display', 'inline-block');
		};
		let changeToRatio = ():void =>
		{
			this.dropQuantRel.setCSS('display', 'none');
			spanGap.setHTML('/');
			this.lineQuantUnits.setCSS('display', 'none');
			this.btnQuantUnits.setCSS('display', 'none');
		};

		if (this.component.ratio != null)
		{
			this.optQuantType.setSelectedValue(QuantityType.Ratio);
			if (this.component.ratio)
			{
				let [numer, denom] = this.component.ratio;
				this.lineQuantVal1.setValue(numer.toString());
				this.lineQuantVal2.setValue(denom.toString());
			}
			changeToRatio();
		}
		else if (Array.isArray(this.component.quantity))
		{
			this.optQuantType.setSelectedValue(QuantityType.Range);
			let [low, high] = this.component.quantity;
			if (low != null) this.lineQuantVal1.setValue(low.toString());
			if (high != null) this.lineQuantVal2.setValue(high.toString());
			this.lineQuantUnits.setValue(this.component.units);
			changeToRange();
		}
		else
		{
			this.optQuantType.setSelectedValue(QuantityType.Value);
			if (this.component.quantity != null) this.lineQuantVal1.setValue(this.component.quantity.toString());
			if (this.component.error != null) this.lineQuantVal2.setValue(this.component.error.toString());
			this.lineQuantUnits.setValue(this.component.units);
			changeToValue();
		}

		this.optQuantType.callbackSelect = (idx:number) =>
		{
			if (idx == 0) changeToValue();
			else if (idx == 1) changeToRange();
			else if (idx == 2) changeToRatio();
		};
	}

	// creates a dropdown list with a prescribed list of choices; the first one will be selected if current matches nothing
	private makeDropdownGroup(parent:DOM, current:string, values:string[], labels:string[], changeFunc:(value:string, label:string) => void):DOM
	{
		let drop = dom('<select/>').appendTo(parent);
		drop.css({'height': '2.3em'});
		for (let n = 0; n < values.length; n++)
		{
			let opt = dom('<option/>').appendTo(drop);
			opt.setAttr('value', n.toString());
			opt.setHTML(labels[n]);
			if (current == values[n] || current == labels[n]) opt.setAttr('selected', 'true');
		}
		drop.onChange(() => {let idx = parseInt(drop.getValue()); changeFunc(values[idx], labels[idx]);});
		return drop;
	}

	private selectDropUnits():void
	{
		let popup = new Popup(this.btnQuantUnits);
		popup.callbackPopulate = () =>
		{
			let body = popup.bodyDOM();
			for (let label of Units.commonNames())
			{
				let div = dom('<div/>').appendTo(body).class('wmk-editcomponent-units');
				div.setText(label);
				div.onClick(() =>
				{
					this.lineQuantUnits.setValue(label);
					popup.close();
				});
			}
		};
		popup.open();
	}

	// special deal: when typing in extended content to the regular value entry box, optionally break up strings that contain
	// a more complete description, e.g. quantity *and* units; returns true if it did something interesting
	private interpretQuantString():boolean
	{
		let qstr = this.lineQuantVal1.getValue().trim();

		// scrape out any "relation" properties from the beginning first of all
		let rel = '';
		for (let pfx of RELATION_VALUES) if (qstr.startsWith(pfx) && pfx.length > rel.length) rel = pfx;
		if (rel) qstr = qstr.substring(rel.length);
		else if (qstr.startsWith('\u{2264}')) [rel, qstr] = ['<=', qstr.substring(1)];
		else if (qstr.startsWith('\u{2265}')) [rel, qstr] = ['>=', qstr.substring(1)];

		// scrape off units from the end
		let units = '';
		for (let [name, uri] of Object.entries(Units.NAME_TO_URI))
		{
			let regname = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // regexify the unit name
			let regex = new RegExp(`^(.*[\\d\\s\)])(${regname})$`);
			let match = regex.exec(qstr);
			if (!match) continue;
			qstr = match[1];
			units = Units.URI_TO_NAME[uri];
			break;
		}

		let isNum = (str:string):boolean =>
		{
			if (str.startsWith('.')) str = '0' + str;
			if (!/^-?[0-9]+\.?[0-9eE]*$/.test(str)) return false;
			return !isNaN(parseFloat(str));
		};

		qstr = qstr.trim();
		let qtype:QuantityType = null;
		let qnum1 = '', qnum2 = '';
		let match = /^([0-9\-\.eE]+)-([0-9\-\.eE]+)$/.exec(qstr); // A-B
		if (match)
		{
			[qtype, qnum1, qnum2] = [QuantityType.Range, match[1], match[2]];
			if (!isNum(qnum1) || !isNum(qnum2) || !units) return false;
		}
		else if (match = /^([0-9\-\.eE]+)\.\.([0-9\-\.eE]+)$/.exec(qstr)) // A..B
		{
			[qtype, qnum1, qnum2] = [QuantityType.Range, match[1], match[2]];
			if (!isNum(qnum1) || !isNum(qnum2) || !units) return false;
		}
		else if (match = /^([0-9\-\.eE]+)\(([0-9\-\.eE]+)\)$/.exec(qstr)) // A(B)
		{
			[qtype, qnum1, qnum2] = [QuantityType.Value, match[1], match[2]];
			if (!isNum(qnum1) || !isNum(qnum2) || !units) return false;
		}
		else if (match = /^([0-9\-\.eE]+)\:([0-9\-\.eE]+)$/.exec(qstr)) // A:B
		{
			[qtype, qnum1, qnum2] = [QuantityType.Ratio, match[1], match[2]];
			if (!isNum(qnum1) || !isNum(qnum2)) return false;
		}
		else if (match = /^([0-9\-\.eE]+)\/([0-9\-\.eE]+)$/.exec(qstr)) // A/B
		{
			[qtype, qnum1, qnum2] = [QuantityType.Ratio, match[1], match[2]];
			if (!isNum(qnum1) || !isNum(qnum2)) return false;
		}
		else
		{
			if (!isNum(qstr) || !units) return false;
			[qtype, qnum1] = [QuantityType.Value, qstr];
		}

		this.optQuantType.setSelectedValue(qtype);
		this.dropQuantRel.setValue(Math.max(0, RELATION_VALUES.indexOf(rel)).toString());
		this.lineQuantVal1.setValue(qnum1);
		this.lineQuantVal2.setValue(qnum2);
		this.lineQuantUnits.setValue(units);
		this.component.units = units;
		return true;
	}

	// uses the structure (if any) to calculate the InChI, and fill in the field value
	private async calculateInChI():Promise<void>
	{
		if (!InChI.isAvailable()) return;
		//let mol = this.sketcher.getMolecule();
		let mol = MoleculeStream.readUnknown(this.component.molfile);
		if (MolUtil.isBlank(mol))
		{
			//alert('Draw a molecule first, then calculate the InChI.');
			return;
		}

		try
		{
			let {inchi} = await this.inchi.generate(mol);
			this.lineInChI.setValue(inchi);
		}
		catch (ex) {alert('InChI generation failed: ' + ex);}
	}

	// if there is a structure, calculate MF
	private calculateFormula():string
	{
		if (!this.component.molfile) return '';
		let mol = MoleculeStream.readUnknown(this.component.molfile);
		if (MolUtil.isBlank(mol)) return '';
		for (let n = mol.numAtoms; n >= 1; n--) if (mol.atomicNumber(n) == 0) mol.deleteAtomAndBonds(n);
		return MolUtil.molecularFormula(mol);
	}

	// derive from MF field, if any
	private calculateWeight():void
	{
		let mw = 0;

		let mf = this.lineFormula.getValue();
		if (!mf) mf = this.lineFormula.elInput.placeholder;

		while (mf)
		{
			let match = mf.match(/^([A-Z][a-z]?)(\d*)(.*?)$/);
			if (!match) {mw = 0; break;}
			let atno = Chemistry.ELEMENTS.indexOf(match[1]);
			if (atno <= 0) {mw = 0; break;}
			let num = 1;
			if (match[2])
			{
				num = parseInt(match[2]);
				if (num <= 0) {mw = 0; break;}
			}
			mw += Chemistry.NATURAL_ATOMIC_WEIGHTS[atno] * num;
			mf = match[3];
		}

		if (mw > 0)
		{
			this.divWeight.css({'padding-left': '0.5em'});
			this.divWeight.setText(mw.toFixed(3) + ' g/mol');
		}
		else
		{
			this.divWeight.css({'padding-left': '0'});
			this.divWeight.setText('');
		}
	}
}

