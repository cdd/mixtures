/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2025 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Dialog} from 'webmolkit/dialog/Dialog';
import {dom, DOM} from 'webmolkit/util/dom';
import {Molecule} from 'webmolkit/mol/Molecule';
import {hasInlineCSS, installInlineCSS} from 'webmolkit/util/Theme';
import {RenderPolicy} from 'webmolkit/gfx/Rendering';
import {OutlineMeasurement} from 'webmolkit/gfx/ArrangeMeasurement';
import {ArrangeMolecule} from 'webmolkit/gfx/ArrangeMolecule';
import {MetaVector} from 'webmolkit/gfx/MetaVector';
import {DrawMolecule} from 'webmolkit/gfx/DrawMolecule';
import {PubChemSearch, PubChemSearchResult} from './PubChemSearch';

/*
	Dialog for finding a compound by name using remote webservices.
*/

export class LookupCompoundDialog extends Dialog
{
	private spanStatus:DOM;
	private btnSearch:DOM;
	private btnApply:DOM;
	private vertical:DOM;
	private searchInput:DOM;
	private resultArea:DOM;

	private pubchem:PubChemSearch = null;
	private resultList:PubChemSearchResult[] = [];

	private nameSelected = -1;
	private nameList:string[] = [];
	private nameDOM:DOM[] = [];
	private molSelected = -1;
	private molList:Molecule[] = [];
	private molDOM:DOM[] = [];

	private callbackSelect:(source?:LookupCompoundDialog) => void = null;

	// ------------ public methods ------------

	constructor(private searchText:string, private parentSize:[number, number])
	{
		super();

		if (!hasInlineCSS('mixtures-lookupcompound')) installInlineCSS('mixtures-lookupcompound', this.composeCSS());

		this.title = 'Lookup Compound';
		this.minPortionWidth = 95;
		this.maxPortionWidth = 95;
		this.maximumHeight = parentSize[1];
	}

	public onSelect(callback:(source?:LookupCompoundDialog) => void):void
	{
		this.callbackSelect = callback;
	}

	// builds the dialog content
	protected populate():void
	{
		let buttons = this.buttonsDOM(), body = this.bodyDOM();

		// top section

		this.spanStatus = dom('<span/>').appendTo(buttons);
		buttons.appendText(' ');

		buttons.append(this.domClose);

		buttons.appendText(' ');

		this.btnSearch = dom('<button class="wmk-button wmk-button-primary">Search</button>').appendTo(buttons);
		this.btnSearch.onClick(() => this.runSearch());

		buttons.appendText(' ');

		this.btnApply = dom('<button class="wmk-button wmk-button-default">Apply</button>').appendTo(buttons);
		this.btnApply.onClick(() => this.applyResult());
		this.btnApply.elInput.disabled = true;

		// main section

		body.css({'padding': '0 0 0 0.5em'});
		this.vertical = dom('<div/>').appendTo(body);
		this.vertical.css({'overflow-y': 'scroll', 'height': '100%'});
		this.vertical.css({'max-height': (this.parentSize[1] - 200) + 'px'});
		this.vertical.css({'padding-right': '18px', 'padding-bottom': '10px'});

		this.populateSearchEntry();

		this.resultArea = dom('<div/>').appendTo(this.vertical);

		if (this.searchText) this.runSearch(); // auto-start
	}

	public close():void
	{
		if (this.pubchem) this.pubchem.stop();
		super.close();
	}

	// access to selected results: null = nothing selected
	public getName():string
	{
		return this.nameSelected < 0 ? null : this.nameList[this.nameSelected];
	}
	public getMolecule():Molecule
	{
		return this.molSelected < 0 ? null : this.molList[this.molSelected];
	}

	// ------------ private methods ------------

	private populateSearchEntry():void
	{
		let grid = dom('<div/>').appendTo(this.vertical).css({'display': 'grid'});
		grid.css({'width': '100%', 'margin': '0.5em 0 0.5em 0'});
		grid.css({'align-items': 'center', 'justify-content': 'start', 'grid-row-gap': '0.5em'});
		grid.css({'grid-template-columns': '[start field] max-content [value] 1fr [end]'});

		let divLabel = dom('<div/>').appendTo(grid).css({'grid-column': 'field', 'grid-row': '1', 'padding-right': '0.5em'});
		divLabel.setText('Name:');

		let divInput = dom('<div/>').appendTo(grid).css({'grid-column': 'value', 'grid-row': '1'});
		this.searchInput = dom('<input/>').appendTo(divInput).css({'width': '100%', 'font': 'inherit'});
		this.searchInput.setValue(this.searchText);
		this.searchInput.onKeyDown((event) => this.trapKeys(event));

		this.searchInput.grabFocus();
	}

	private runSearch():void
	{
		if (this.pubchem) this.pubchem.stop();
		this.resultArea.empty();
		this.resultList = [];

		this.spanStatus.setText('Searching...');

		let text = this.searchInput.getValue();
		if (!text) return;
		this.pubchem = new PubChemSearch(text,
			(result:PubChemSearchResult):void => this.gotResult(result),
			(err:string):void => this.finishedSearch(err));
		this.pubchem.start();
	}

	private applyResult():void
	{
		this.callbackSelect(this);
		this.close();
	}

	private gotResult(result:PubChemSearchResult):void
	{
		this.resultList.push(result);

		let grid = dom('<div/>').appendTo(this.resultArea).css({'display': 'grid'});
		grid.css({'width': '100%', 'margin': '0.5em 0 0.5em 0', 'align-items': 'top', 'justify-content': 'start'});
		grid.css({'grid-row-gap': '0.5em'});
		grid.css({'grid-template-columns': '[start molecule] max-content [names] 1fr [end]'});

		let divMol = dom('<div/>').appendTo(grid).css({'grid-column': 'molecule', 'grid-row': '1', 'padding-right': '0.5em'});

		if (result.mol)
		{
			let policy = RenderPolicy.defaultColourOnWhite();
			let measure = new OutlineMeasurement(0, 0, policy.data.pointScale);
			let layout = new ArrangeMolecule(result.mol, measure, policy);
			layout.arrange();
			layout.squeezeInto(0, 0, 300, 300);
			let gfx = new MetaVector();
			new DrawMolecule(layout, gfx).draw();
			gfx.normalise();

			let svg = dom(gfx.createSVG()).appendTo(divMol).css({'display': 'inline-block'});
			svg.addClass('mixtures-lookupcompound-unselected');

			const idx = this.molList.length;
			svg.onClick(() => this.selectMolecule(idx));

			this.molList.push(result.mol);
			this.molDOM.push(svg);
		}
		else divMol.setText('(no structure)');

		let divName = dom('<div/>').appendTo(grid).css({'grid-column': 'names', 'grid-row': '1', 'padding-right': '0.5em'});

		if (result.names.length == 0) divName.setText('(no names)');
		else for (let name of result.names)
		{
			let div = dom('<div/>').appendTo(divName);
			let span = dom('<span/>').appendTo(div);
			span.addClass('mixtures-lookupcompound-unselected');
			span.setText(name);

			const idx = this.nameList.length;
			div.onClick(() => this.selectName(idx));

			this.nameList.push(name);
			this.nameDOM.push(span);
		}
	}

	private finishedSearch(err:string):void
	{
		this.spanStatus.setText('');

		if (err) alert('Search failed: ' + err);
		else if (this.resultList.length == 0)
		{
			this.resultArea.empty();
			this.resultArea.setText('Nothing found.');
		}
	}

	private trapKeys(event:KeyboardEvent):void
	{
		if (event.keyCode == 27)
		{
			event.preventDefault();
			this.close();
		}
		else if (event.keyCode == 13)
		{
			event.preventDefault();
			this.runSearch();
		}
	}

	private selectName(idx:number):void
	{
		let prev = this.nameSelected;
		if (prev == idx) idx = -1;

		if (prev >= 0) this.nameDOM[prev].removeClass('mixtures-lookupcompound-selected');
		if (idx >= 0) this.nameDOM[idx].addClass('mixtures-lookupcompound-selected');
		this.nameSelected = idx;

		this.btnApply.elInput.disabled = this.nameSelected < 0 && this.molSelected < 0;
	}

	private selectMolecule(idx:number):void
	{
		let prev = this.molSelected;
		if (prev == idx) idx = -1;

		if (prev >= 0) this.molDOM[prev].removeClass('mixtures-lookupcompound-selected');
		if (idx >= 0) this.molDOM[idx].addClass('mixtures-lookupcompound-selected');
		this.molSelected = idx;

		this.btnApply.elInput.disabled = this.nameSelected < 0 && this.molSelected < 0;
	}

	// one-time instantiation of necessary styles
	private composeCSS():string
	{
		return `
			.mixtures-lookupcompound-unselected
			{
				cursor: pointer;
				background-color: transparent;
				border: 1px solid transparent;
				padding: 3px;
				border-radius: 4px;
			}
			.mixtures-lookupcompound-selected
			{
				cursor: default;
				background-color: #E0E0E0;
				border: 1px solid #808080;
			}
		`;
	}
}

