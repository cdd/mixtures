/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2020 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Widget} from 'webmolkit/ui/Widget';
import {MixfileMetadatum} from '../data/Mixfile';
import {dom, DOM} from 'webmolkit/util/dom';
import {installInlineCSS} from 'webmolkit/util/Theme';
import {OntologyTree, OntologyTreeTerm} from 'webmolkit/data/OntologyTree';
import {Vec} from 'webmolkit/util/Vec';
import {addTooltip, clearTooltip} from 'webmolkit/ui/Tooltip';
import {escapeHTML} from 'webmolkit/util/util';
import {Popup} from 'webmolkit/ui/Popup';

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
}

export class MetadataWidget extends Widget
{
	private lines:MetadataWidgetLine[] = [];

	private divGrid:DOM;

	// ------------ public methods ------------

	constructor(metadata:MixfileMetadatum[], private callbackChange:(metadata:MixfileMetadatum[]) => void)
	{
		super();

		if (metadata) for (let datum of metadata) this.lines.push({'datum': datum});

		installInlineCSS('metadatawidget', CSS_METADATAWIDGET);
	}

	public render(parent:any):void
	{
		super.render(parent);

		this.divGrid = dom('<div/>').appendTo(this.contentDOM).css({'display': 'grid', 'width': '100%', 'margin': '0'});
		this.divGrid.css({'align-items': 'baseline', 'justify-content': 'start'});
		this.divGrid.css({'grid-row-gap': '0.5em', 'grid-column-gap': '0.5em'});
		this.divGrid.css({'grid-template-columns': '[start content] 1fr [button] auto [end]'});

		this.rebuildGrid();
	}

	// ------------ private methods ------------

	private rebuildGrid():void
	{
		this.divGrid.empty();

		let renderTerm = (parent:DOM, item:number | string, line:MetadataWidgetLine, idx:number):void =>
		{
			let div = dom('<div/>').appendTo(parent);
			div.css({'padding': '0.2em', 'margin-right': '0.5em'});
			if (typeof item == 'string')
			{
				div.css({'background-color': idx == 0 ? '#D0D0D0' : '#D0D0FF', 'border-radius': '3px'});
				let branch = OntologyTree.main.getBranch(item);
				if (Vec.notBlank(branch))
				{
					div.setText(branch[0].label);
					addTooltip(div, escapeHTML(branch[0].uri), null, 1000);
				}
				else div.setText(item);
			}
			else // number (or null, which is a pre-number)
			{
				let input = dom('<input type="number"/>').appendTo(div).css({'width': '5em', 'padding': '0', 'font': 'inherit'});
				if (item != null)
				{
					input.css({'width': Math.max(5, item.toString().length) + 'em'});
					input.setValue(item.toString());
				}
				input.onInput(() =>
				{
					let num = parseFloat(input.getValue());
					if (!isNaN(num)) (line.datum as number[])[idx] = num;
				});
			}
		};

		let row = 0;

		for (let n = 0; n < this.lines.length; n++)
		{
			let line = this.lines[n];

			row++;
			let divContent = dom('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / content`});
			let divButton = dom('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / button`});

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
					let btnBack = dom('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divContent);
					btnBack.setText('\u{21E6}');
					btnBack.css({'margin-right': '0.5em'});
					btnBack.onClick(() =>
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

			let btnAssert = dom('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divContent);
			btnAssert.setText('\u{21E9}');
			btnAssert.css({'margin-right': '0.5em'});
			btnAssert.onClick(() => this.pickExtraTerm(btnAssert, line, false));
			let btnProp = dom('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divContent);
			btnProp.setText('\u{21E8}');
			btnProp.css({'margin-right': '0.5em'});
			btnProp.onClick(() => this.pickExtraTerm(btnProp, line, true));

			let btnDelete = dom('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divButton);
			btnDelete.setText('\u{2716}');
			btnDelete.onClick(() =>
			{
				this.lines.splice(n, 1);
				this.rebuildGrid();
				this.triggerModified();
			});
		}

		row++;
		let divAdd = dom('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / start / ${row} / end`, 'text-align': this.lines.length > 0 ? 'center' : 'left'});
		let btnAdd = dom('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divAdd);
		btnAdd.setText('\u{271A}');
		btnAdd.onClick(() => this.pickNewTerm(btnAdd));
	}

	private triggerModified():void
	{
		let metadata = this.lines.map((line) => line.datum);
		this.callbackChange(metadata);
	}

	private pickNewTerm(divParent:DOM):void
	{
		let branchList:OntologyTreeTerm[] = [];
		const ROOTS = ['http://mixtures.io/rdf#MixtureMetadata'];
		for (let rootURI of ROOTS) branchList.push(...OntologyTree.main.getBranchList(rootURI));
		let popup = new Popup(divParent);
		popup.callbackPopulate = () =>
		{
			this.populateBranch(popup, branchList, (term) =>
			{
				this.lines.push({datum: term.uri});
				this.rebuildGrid();
				this.triggerModified();
			});
		};
		popup.open();
	}

	private pickExtraTerm(divParent:DOM, line:MetadataWidgetLine, isProperty:boolean):void
	{
		let branchList:OntologyTreeTerm[] = [];
		const ROOTS_ASSERT = ['http://mixtures.io/rdf#MixtureMetadata'];
		const ROOTS_PROP = ['http://purl.obolibrary.org/obo/UO_0000000'];
		for (let rootURI of (isProperty ? ROOTS_PROP : ROOTS_ASSERT)) branchList.push(...OntologyTree.main.getBranchList(rootURI));
		let popup = new Popup(divParent);
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
	private populateBranch(popup:Popup, branchList:OntologyTreeTerm[], callbackClicked:(term:OntologyTreeTerm) => void):void
	{
		let body = popup.bodyDOM();

		for (let term of branchList)
		{
			let div = dom('<div/>').appendTo(body);
			if (term.depth > 0)
			{
				div.css({'margin-left': (term.depth - 0.5) + 'em'});
				dom('<span>\u{279E}</span>').appendTo(div).css({'color': '#A0A0A0', 'margin-right': '0.5em'});
			}
			let span = dom('<span/>').appendTo(div).class('wmk-metadataitem');
			span.setText(term.label);
			addTooltip(span, escapeHTML(term.uri), null, 2000);
			span.onClick(() =>
			{
				clearTooltip();
				popup.close();
				callbackClicked(term);
			});
		}
	}
}

