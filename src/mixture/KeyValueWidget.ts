/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2020 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	Widget for editing a key/value pattern, whereby key/value pairs can be added and edited individually.
*/

interface KeyValueWidgetLine
{
	key:string;
	value:string;
	inputKey?:DOM;
	inputValue?:DOM;
}

export class KeyValueWidget extends wmk.Widget
{
	private lines:KeyValueWidgetLine[] = [];

	private divGrid:DOM;

	// ------------ public methods ------------

	constructor(dict:Record<string, string | string[]>, private callbackChange:(dict:Record<string, string | string[]>) => void)
	{
		super();

		for (let key in dict)
		{
			let value = dict[key];
			if (typeof value == 'string') this.lines.push({key, value});
			else if (Array.isArray(value)) for (let v of value) this.lines.push({key, 'value': v});
		}
	}

	public render(parent:any):void
	{
		super.render(parent);
		
		this.divGrid = dom('<div/>').appendTo(this.contentDOM).css({'display': 'grid', 'width': '100%', 'margin': '0'});
		this.divGrid.css({'align-items': 'baseline', 'justify-content': 'start'});
		this.divGrid.css({'grid-row-gap': '0.5em', 'grid-column-gap': '0.5em'});
		this.divGrid.css({'grid-template-columns': '[start key] 1fr [value] 1fr [button] auto [end]'});

		this.rebuildGrid();
	}

	// ------------ private methods ------------

	private rebuildGrid():void
	{
		this.divGrid.empty();

		let row = 0;

		for (let n = 0; n < this.lines.length; n++)
		{
			let line = this.lines[n];

			row++;
			let divKey = dom('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / key`});
			let divValue = dom('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / value`});
			let divButton = dom('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / button`});

			line.inputKey = dom('<input/>').appendTo(divKey).css({'width': '100%', 'padding': '0', 'font': 'inherit'});
			line.inputKey.setValue(line.key);
			line.inputKey.onInput(() => this.scrapeData());

			line.inputValue = dom('<input/>').appendTo(divValue).css({'width': '100%', 'padding': '0', 'font': 'inherit'});
			line.inputValue.setValue(line.value);
			line.inputValue.onInput(() => this.scrapeData());

			let btnDelete = dom('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divButton);
			btnDelete.setText('\u{2716}');
			btnDelete.onClick(() =>
			{
				this.lines.splice(n, 1);
				this.rebuildGrid();
				this.scrapeData();
			});
		}

		row++;
		let divAdd = dom('<div/>').appendTo(this.divGrid).css({'grid-area': `${row} / start / ${row} / end`, 'text-align': this.lines.length > 0 ? 'center' : 'left'});
		let btnAdd = dom('<button class="wmk-button wmk-button-small wmk-button-default"/>').appendTo(divAdd);
		btnAdd.setText('\u{271A}');
		btnAdd.onClick(() =>
		{
			this.lines.push({key: '', value: ''});
			this.rebuildGrid();
			this.scrapeData();
		});
	}

	private scrapeData():void
	{
		let dict:Record<string, string | string[]> = {};
		for (let line of this.lines)
		{
			line.key = line.inputKey.getValue();
			line.value = line.inputValue.getValue();
			if (!line.key || !line.value) continue;

			let dval = dict[line.key];
			if (!dval) dict[line.key] = line.value;
			else if (typeof dval == 'string') dict[line.key] = [dval, line.value];
			else if (Array.isArray(dval)) dval.push(line.value);
		}
		
		this.callbackChange(dict);
	}
}

/* EOF */ }