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
///<reference path='PubChemSearch.ts'/>

namespace Mixtures /* BOF */ {

/*
	Dialog for finding a compound by name using remote webservices.
*/

export class LookupCompoundDialog extends wmk.Dialog
{
	private spanStatus:JQuery;
	private btnSearch:JQuery;
	private btnApply:JQuery;
	private vertical:JQuery;
	private searchInput:JQuery;
	private resultArea:JQuery;

	private pubchem:PubChemSearch = null;
	private resultList:PubChemSearchResult[] = [];

	private nameSelected = -1;
	private nameList:string[] = [];
	private nameDOM:JQuery[] = [];
	private molSelected = -1;
	private molList:wmk.Molecule[] = [];
	private molDOM:JQuery[] = [];

	private callbackSelect:(source?:LookupCompoundDialog) => void = null;

	// ------------ public methods ------------

	constructor(private searchText:string, private parentSize:[number, number])
	{
		super();

		if (!wmk.hasInlineCSS('mixtures-lookupcompound')) wmk.installInlineCSS('mixtures-lookupcompound', this.composeCSS());

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
		let buttons = this.buttons(), body = this.body();

		// top section

		this.spanStatus = $('<span/>').appendTo(buttons);
		buttons.append(' ');

		buttons.append(this.btnClose);

		buttons.append(' ');

		this.btnSearch = $('<button class="wmk-button wmk-button-primary">Search</button>').appendTo(buttons);
		this.btnSearch.click(() => this.runSearch());

		buttons.append(' ');

		this.btnApply = $('<button class="wmk-button wmk-button-default">Apply</button>').appendTo(buttons);
		this.btnApply.click(() => this.applyResult());
		this.btnApply.prop('disabled', true);

		// main section

		body.css('padding', '0 0 0 0.5em');
		this.vertical = $('<div/>').appendTo(body);
		this.vertical.css('overflow-y', 'scroll');
		this.vertical.css('height', '100%');
		this.vertical.css('max-height', (this.parentSize[1] - 200) + 'px');
		this.vertical.css('padding-right', '18px');
		this.vertical.css('padding-bottom', '10px');

		this.populateSearchEntry();

		this.resultArea = $('<div/>').appendTo(this.vertical);

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
	public getMolecule():wmk.Molecule
	{
		return this.molSelected < 0 ? null : this.molList[this.molSelected];
	}

	// ------------ private methods ------------

	private populateSearchEntry():void
	{
		let grid = $('<div/>').appendTo(this.vertical);
		grid.css('display', 'grid');
		grid.css('width', '100%');
		grid.css('margin', '0.5em 0 0.5em 0');
		grid.css('align-items', 'center');
		grid.css('justify-content', 'start');
		grid.css('grid-row-gap', '0.5em');
		grid.css('grid-template-columns', '[start field] max-content [value] 1fr [end]');

		let divLabel = $('<div/>').appendTo(grid);
		divLabel.css('grid-column', 'field');
		divLabel.css('grid-row', '1');
		divLabel.css('padding-right', '0.5em');
		divLabel.text('Name:');

		let divInput = $('<div/>').appendTo(grid);
		divInput.css('grid-column', 'value');
		divInput.css('grid-row', '1');
		this.searchInput = $('<input/>').appendTo(divInput);
		this.searchInput.css('width', '100%');
		this.searchInput.css('font', 'inherit');
		this.searchInput.val(this.searchText);
		this.searchInput.keydown((event:JQueryEventObject) => this.trapKeys(event));

		this.searchInput.focus();
	}

	private runSearch():void
	{
		if (this.pubchem) this.pubchem.stop();
		this.resultArea.empty();
		this.resultList = [];

		this.spanStatus.text('Searching...');

		let text = this.searchInput.val();
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

		let grid = $('<div/>').appendTo(this.resultArea);
		grid.css('display', 'grid');
		grid.css('width', '100%');
		grid.css('margin', '0.5em 0 0.5em 0');
		grid.css('align-items', 'top');
		grid.css('justify-content', 'start');
		grid.css('grid-row-gap', '0.5em');
		grid.css('grid-template-columns', '[start molecule] max-content [names] 1fr [end]');

		let divMol = $('<div/>').appendTo(grid);
		divMol.css('grid-column', 'molecule');
		divMol.css('grid-row', '1');
		divMol.css('padding-right', '0.5em');

		if (result.mol)
		{
			let policy = wmk.RenderPolicy.defaultColourOnWhite();
			let measure = new wmk.OutlineMeasurement(0, 0, policy.data.pointScale);
			let layout = new wmk.ArrangeMolecule(result.mol, measure, policy);
			layout.arrange();
			layout.squeezeInto(0, 0, 300, 300);
			let gfx = new wmk.MetaVector();
			new wmk.DrawMolecule(layout, gfx).draw();
			gfx.normalise();

			let svg = $(gfx.createSVG()).appendTo(divMol);
			svg.css('display', 'inline-block');
			svg.addClass('mixtures-lookupcompound-unselected');

			const idx = this.molList.length;
			svg.click(() => this.selectMolecule(idx));

			this.molList.push(result.mol);
			this.molDOM.push(svg);
		}
		else divMol.text('(no structure)');

		let divName = $('<div/>').appendTo(grid);
		divName.css('grid-column', 'names');
		divName.css('grid-row', '1');
		divName.css('padding-right', '0.5em');

		if (result.names.length == 0) divName.text('(no names)');
		else for (let name of result.names)
		{
			let div = $('<div/>').appendTo(divName);
			let span = $('<span/>').appendTo(div);
			span.addClass('mixtures-lookupcompound-unselected');
			span.text(name);

			const idx = this.nameList.length;
			div.click(() => this.selectName(idx));

			this.nameList.push(name);
			this.nameDOM.push(span);
		}
	}

	private finishedSearch(err:string):void
	{
		this.spanStatus.text('');

		if (err) alert('Search failed: ' + err);
		else if (this.resultList.length == 0)
		{
			this.resultArea.empty();
			this.resultArea.text('Nothing found.');
		}
	}

	private trapKeys(event:JQueryEventObject):void
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

		this.btnApply.prop('disabled', this.nameSelected < 0 && this.molSelected < 0);
	}

	private selectMolecule(idx:number):void
	{
		let prev = this.molSelected;
		if (prev == idx) idx = -1;

		if (prev >= 0) this.molDOM[prev].removeClass('mixtures-lookupcompound-selected');
		if (idx >= 0) this.molDOM[idx].addClass('mixtures-lookupcompound-selected');
		this.molSelected = idx;

		this.btnApply.prop('disabled', this.nameSelected < 0 && this.molSelected < 0);
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

/* EOF */ }