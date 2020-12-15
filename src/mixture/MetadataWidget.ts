/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2020 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	Widget for editing a list of metadata items.
*/

const CSS_METADATAWIDGET = `
	*.wmk-metadataitem:hover
	{
		background-color: #C0C0FF;
		cursor: pointer;
	}
`;

interface MetadataWidgetLine
{
	datum:MixfileMetadatum;
	/*key:string;
	value:string;
	inputKey?:JQuery;
	inputValue?:JQuery;*/
}

export class MetadataWidget extends wmk.Widget
{
	private lines:MetadataWidgetLine[] = [];

	private divGrid:JQuery;

	// ------------ public methods ------------

	constructor(metadata:MixfileMetadatum[], private callbackChange:(metadata:MixfileMetadatum[]) => void)
	{
		super();

		if (metadata) for (let datum of metadata) this.lines.push({'datum': datum});

		if (!wmk.hasInlineCSS('metadatawidget')) wmk.installInlineCSS('metadatawidget', CSS_METADATAWIDGET);
	}

	public render(parent:any):void
	{
		super.render(parent);

		this.divGrid = $('<div/>').appendTo(this.content).css({'display': 'grid', 'width': '100%', 'margin': '0'});
		this.divGrid.css({'align-items': 'baseline', 'justify-content': 'start'});
		this.divGrid.css({'grid-row-gap': '0.5em', 'grid-column-gap': '0.5em'});
		this.divGrid.css('grid-template-columns', '[start content] 1fr [button] auto [end]');

		this.rebuildGrid();
	}

	// ------------ private methods ------------

	private rebuildGrid():void
	{
		this.divGrid.empty();

		let renderTerm = (parent:JQuery, item:number | string, line:MetadataWidgetLine, idx:number):void =>
		{
			let div = $('<div/>').appendTo(parent);
			div.css({'padding': '0.2em', 'margin-right': '0.5em'});
			if (typeof item == 'string')
			{
				div.css({'background-color': idx == 0 ? '#D0D0D0' : '#D0D0FF', 'border-radius': '3px'});
				let branch = wmk.OntologyTree.main.getBranch(item);
				if (Vec.notBlank(branch))
				{
					div.text(branch[0].label);
					wmk.addTooltip(div, escapeHTML(branch[0].uri), null, 1000);
				}
				else div.text(item);
			}
			else // number (or null, which is a pre-number)
			{
				let input = $('<input type="number"/>').appendTo(div).css({'width': '5em', 'padding': '0', 'font': 'inherit'});
				if (item != null)
				{
					input.css('width', Math.max(5, item.toString().length) + 'em');
					input.val(item.toString());
				}
				input.on('input', () =>
				{
					let num = parseFloat(input.val().toString());
					if (!isNaN(num)) (line.datum as number[])[idx] = num;
				});
			}
		};

		let row = 0;

		for (let n = 0; n < this.lines.length; n++)
		{
			let line = this.lines[n];

			row++;
			let divContent = $('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / content`});
			let divButton = $('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / button`});

			divContent.css({'display': 'flex', 'flex-wrap': 'wrap', 'justify-content': 'flex-start', 'align-items': 'baseline'});
			if (Array.isArray(line.datum))
			{
				for (let i = 0; i < line.datum.length; i++)
				{
					let item = line.datum[i];
					renderTerm(divContent, item, line, i);
				}

				if (line.datum.length > 1)
				{
					let btnBack = $('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divContent);
					btnBack.text('\u{21E6}');
					btnBack.css({'margin-right': '0.5em'});
					btnBack.click(() =>
					{
						let list = line.datum as any[];
						list.splice(list.length - 1, 1);
						if (typeof Vec.last(list) != 'string') list.splice(list.length - 1, 1);
						this.rebuildGrid();
						this.triggerModified();
					});
				}
			}
			else renderTerm(divContent, line.datum, line, 0);

			let btnAssert = $('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divContent);
			btnAssert.text('\u{21E9}');
			btnAssert.css({'margin-right': '0.5em'});
			btnAssert.click(() => this.pickExtraTerm(btnAssert, line, false));
			let btnProp = $('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divContent);
			btnProp.text('\u{21E8}');
			btnProp.css({'margin-right': '0.5em'});
			btnProp.click(() => this.pickExtraTerm(btnProp, line, true));

			let btnDelete = $('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divButton);
			btnDelete.text('\u{2716}');
			btnDelete.click(() =>
			{
				this.lines.splice(n, 1);
				this.rebuildGrid();
				this.triggerModified();
			});
		}

		row++;
		let divAdd = $('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / start / ${row} / end`, 'text-align': this.lines.length > 0 ? 'center' : 'left'});
		let btnAdd = $('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divAdd);
		btnAdd.text('\u{271A}');
		btnAdd.click(() => this.pickNewTerm(btnAdd));
	}

	private triggerModified():void
	{
		let metadata = this.lines.map((line) => line.datum);
		this.callbackChange(metadata);
	}

	private pickNewTerm(divParent:JQuery):void
	{
		let branchList:wmk.OntologyTreeTerm[] = [];
		const ROOTS = ['http://mixtures.org/rdf#MixtureMetadata'];
		for (let rootURI of ROOTS) branchList.push(...wmk.OntologyTree.main.getBranchList(rootURI));
		let popup = new wmk.Popup(divParent);
		popup.callbackPopulate = () =>
		{
			this.populateBranch(popup, branchList, (term) =>
			{
				this.lines.push({'datum': term.uri});
				this.rebuildGrid();
				this.triggerModified();
			});
		};
		popup.open();
	}

	private pickExtraTerm(divParent:JQuery, line:MetadataWidgetLine, isProperty:boolean):void
	{
		let branchList:wmk.OntologyTreeTerm[] = [];
		const ROOTS_ASSERT = ['http://mixtures.org/rdf#MixtureMetadata'];
		const ROOTS_PROP = ['http://purl.obolibrary.org/obo/UO_0000000'];
		for (let rootURI of (isProperty ? ROOTS_PROP : ROOTS_ASSERT)) branchList.push(...wmk.OntologyTree.main.getBranchList(rootURI));
		let popup = new wmk.Popup(divParent);
		popup.callbackPopulate = () =>
		{
			this.populateBranch(popup, branchList, (term) =>
			{
				if (typeof line.datum == 'string') line.datum = [line.datum];
				if (isProperty) line.datum.push(null);
				line.datum.push(term.uri);
				this.rebuildGrid();
				this.triggerModified();
			});
		};
		popup.open();
	}

	// enumerates a list of clickable ontology tree items
	private populateBranch(popup:wmk.Popup, branchList:wmk.OntologyTreeTerm[], callbackClicked:(term:wmk.OntologyTreeTerm) => void):void
	{
		let body = popup.body();

		for (let term of branchList)
		{
			let div = $('<div/>').appendTo(body);
			if (term.depth > 0)
			{
				div.css('margin-left', (term.depth - 0.5) + 'em');
				$('<span>\u{279E}&nbsp;</span>').appendTo(div).css({'color': '#A0A0A0'});
			}
			let span = $('<span class="wmk-metadataitem"/>').appendTo(div);
			span.text(term.label);
			wmk.addTooltip(span, escapeHTML(term.uri), null, 2000);
			span.click(() =>
			{
				wmk.clearTooltip();
				popup.close();
				callbackClicked(term);
			});
		}
	}
}

/* EOF */ }