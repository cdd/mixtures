/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='MenuBanner.ts'/>
///<reference path='MainPanel.ts'/>

namespace Mixtures /* BOF */ {

/*
	Browsing/editing a collection of mixtures.
*/

const BANNER:MenuBannerButton[][] =
[
	[
		{'icon': 'CommandSave.svg', 'tip': 'Save', 'cmd': MenuBannerCommand.Save},
	],
	[
		{'icon': 'CommandEdit.svg', 'tip': 'Edit component', 'cmd': MenuBannerCommand.EditDetails},
		{'icon': 'CommandStructure.svg', 'tip': 'Edit structure', 'cmd': MenuBannerCommand.EditStructure},
		{'icon': 'CommandLookup.svg', 'tip': 'Lookup compound', 'cmd': MenuBannerCommand.Lookup},
		{'icon': 'CommandPicture.svg', 'tip': 'Export graphics', 'cmd': MenuBannerCommand.ExportSVG},
	],
	[
		{'icon': 'CommandAppend.svg', 'tip': 'Append component', 'cmd': MenuBannerCommand.Append},
		{'icon': 'CommandPrepend.svg', 'tip': 'Prepend component', 'cmd': MenuBannerCommand.Prepend},
		{'icon': 'CommandDelete.svg', 'tip': 'Delete', 'cmd': MenuBannerCommand.Delete},
		{'icon': 'CommandMoveUp.svg', 'tip': 'Move Up', 'cmd': MenuBannerCommand.MoveUp},
		{'icon': 'CommandMoveDown.svg', 'tip': 'Move Down', 'cmd': MenuBannerCommand.MoveDown},
	],
	[
		{'icon': 'CommandUndo.svg', 'tip': 'Undo', 'cmd': MenuBannerCommand.Undo},
		{'icon': 'CommandRedo.svg', 'tip': 'Redo', 'cmd': MenuBannerCommand.Redo},
	],
	[
		{'icon': 'CommandCopy.svg', 'tip': 'Copy', 'cmd': MenuBannerCommand.Copy},
		{'icon': 'CommandCut.svg', 'tip': 'Cut', 'cmd': MenuBannerCommand.Cut},
		{'icon': 'CommandPaste.svg', 'tip': 'Paste', 'cmd': MenuBannerCommand.Paste},
	],
	[
		{'icon': 'CommandViewDetail.svg', 'tip': 'Detail', 'cmd': MenuBannerCommand.ViewDetail},
		{'icon': 'CommandViewCard.svg', 'tip': 'Cards', 'cmd': MenuBannerCommand.ViewCard},
		{'icon': 'CommandZoomNormal.svg', 'tip': 'Zoom full', 'cmd': MenuBannerCommand.ZoomFull},
		{'icon': 'CommandZoomIn.svg', 'tip': 'Zoom in', 'cmd': MenuBannerCommand.ZoomIn},
		{'icon': 'CommandZoomOut.svg', 'tip': 'Zoom out', 'cmd': MenuBannerCommand.ZoomOut},
	],
];

enum CollectionPanelView
{
	Detail,
	Card,
}

const BG_NORMAL = '#E0E0E0';
const BG_SELECTED = '#B9CBFF';
const PAGE_SIZE = 100;

export class CollectionPanel extends MainPanel
{
	private filename:string = null;
	private collection = new MixtureCollection();
	private curPage = 0;
	private pageBlock:number[][] = [];
	private isDirty = false;

	private banner:MenuBanner;
	private divMain:DOM;
	private divFooter:DOM;
	private policy = wmk.RenderPolicy.defaultColourOnWhite(20);
	private viewType = CollectionPanelView.Detail;

	private selected = -1;
	private mapMixDiv = new Map<number, DOM>(); // index-in-collection to rendered div
	private editor:EditMixture = null; // when defined, refers to collection{selected}

	// ------------ public methods ------------

	constructor(root:DOM, private proxyClip:wmk.ClipboardProxy, private proxyMenu:wmk.MenuProxy)
	{
		super(root);

		this.banner = new MenuBanner(BANNER, (cmd:MenuBannerCommand) => this.menuAction(cmd));

		let divFlex = dom('<div/>').appendTo(root).css({'display': 'flex'});
		divFlex.css({'flex-direction': 'column', 'width': '100%', 'height': '100%'});
		let divBanner = dom('<div/>').appendTo(divFlex).css({'flex-grow': '0'});
		this.divMain = dom('<div/>').appendTo(divFlex).css({'flex-grow': '1', 'overflow-y': 'scroll'});
		this.divFooter = dom('<div/>').appendTo(divFlex).css({'flex-grow': '0'});

		this.banner.render(divBanner);
		this.dividePages();
		this.renderMain();

		this.updateBanner();
	}

	public setCollection(collection:MixtureCollection):void
	{
		this.collection = collection;
		this.dividePages();
		this.renderMain();
	}

	public loadFile(filename:string):void
	{
		if (!filename)
		{
			this.editor.clearHistory();
			this.editor.setMixture(new Mixture(), true, true);
			this.updateTitle();
			this.filename = null;
			this.isDirty = false;
			return;
		}

		const fs = require('fs');
		fs.readFile(filename, 'utf-8', (err:any, data:string):void =>
		{
			if (err) throw err;

			let collection:MixtureCollection;
			try {collection = MixtureCollection.deserialise(data);}
			catch (e)
			{
				console.log('Invalid mixture collection file: ' + e + '\n' + data);
				alert('Not a valid mixture collection file.');
				return;
			}

			this.setCollection(collection);
			this.filename = filename;
			this.isDirty = false;
			this.updateTitle();
		});
	}

	public menuAction(cmd:MenuBannerCommand):void
	{
		if (this.editor)
		{
			let dlg = this.editor.compoundEditor();
			if (dlg)
			{
				if (cmd == MenuBannerCommand.Cut) dlg.actionCut();
				else if (cmd == MenuBannerCommand.Copy) dlg.actionCopy();
				else if (cmd == MenuBannerCommand.Paste) dlg.actionPaste();
				else if (cmd == MenuBannerCommand.Undo) dlg.actionUndo();
				else if (cmd == MenuBannerCommand.Redo) dlg.actionRedo();
				return;
			}
			if (!this.editor.isReceivingCommands())
			{
				// certain common menu/shortcut commands are passed through to standard behaviour, the rest are stopped
				if ([MenuBannerCommand.Cut, MenuBannerCommand.Copy, MenuBannerCommand.Paste,
					MenuBannerCommand.Undo, MenuBannerCommand.Redo].indexOf(cmd) >= 0) document.execCommand(cmd);
				return;
			}
		}

		super.menuAction(cmd);
	}

	public customMenuAction(cmd:MenuBannerCommand):void
	{
		if (this.editor)
		{
			/* !! if (cmd == MenuBannerCommand.ExportSDF) this.actionExportSDF();
			else if (cmd == MenuBannerCommand.ExportSVG) this.actionFileExportSVG();
			else if (cmd == MenuBannerCommand.CreateMInChI) this.actionFileCreateMInChI();
			else*/ if (cmd == MenuBannerCommand.Undo) this.editor.performUndo();
			else if (cmd == MenuBannerCommand.Redo) this.editor.performRedo();
			else if (cmd == MenuBannerCommand.Cut) this.editor.clipboardCopy(true);
			else if (cmd == MenuBannerCommand.Copy) this.editor.clipboardCopy(false);
			else if (cmd == MenuBannerCommand.CopyBranch) this.editor.clipboardCopy(false, true);
			else if (cmd == MenuBannerCommand.Paste) this.editor.clipboardPaste();
			else if (cmd == MenuBannerCommand.EditStructure) this.editor.editStructure();
			else if (cmd == MenuBannerCommand.EditDetails) this.editor.editDetails();
			else if (cmd == MenuBannerCommand.Lookup) this.editor.lookupCurrent();
			else if (cmd == MenuBannerCommand.Delete) this.editor.deleteCurrent();
			else if (cmd == MenuBannerCommand.Append) this.editor.appendToCurrent();
			else if (cmd == MenuBannerCommand.Prepend) this.editor.prependBeforeCurrent();
			else if (cmd == MenuBannerCommand.MoveUp) this.editor.reorderCurrent(-1);
			else if (cmd == MenuBannerCommand.MoveDown) this.editor.reorderCurrent(1);
			else if (cmd == MenuBannerCommand.ZoomFull) this.editor.zoomFull();
			else if (cmd == MenuBannerCommand.ZoomIn) this.editor.zoom(1.25);
			else if (cmd == MenuBannerCommand.ZoomOut) this.editor.zoom(0.8);
			else super.customMenuAction(cmd);
		}
		else
		{
			/*if (cmd == MenuBannerCommand.ExportSDF) this.actionExportSDF();
			else if (cmd == MenuBannerCommand.ExportSVG) this.actionFileExportSVG();
			else if (cmd == MenuBannerCommand.CreateMInChI) this.actionFileCreateMInChI();
			else*/ if (cmd == MenuBannerCommand.Cut) this.clipboardCopy(true);
			else if (cmd == MenuBannerCommand.Copy) this.clipboardCopy(false);
			else if (cmd == MenuBannerCommand.Paste) this.clipboardPaste();
			else if (cmd == MenuBannerCommand.EditDetails) this.editMixture();
			else if (cmd == MenuBannerCommand.Delete) this.deleteMixture();
			else if (cmd == MenuBannerCommand.Append) this.appendMixture();
			else if (cmd == MenuBannerCommand.Prepend) this.prependMixture();
			else if (cmd == MenuBannerCommand.MoveUp) this.reorderCurrent(-1);
			else if (cmd == MenuBannerCommand.MoveDown) this.reorderCurrent(1);
			else if (cmd == MenuBannerCommand.ZoomFull) this.zoomScale();
			else if (cmd == MenuBannerCommand.ZoomIn) this.zoomScale(1.25);
			else if (cmd == MenuBannerCommand.ZoomOut) this.zoomScale(0.8);
			else if (cmd == MenuBannerCommand.ViewDetail) this.changeView(cmd);
			else if (cmd == MenuBannerCommand.ViewCard) this.changeView(cmd);
			else super.customMenuAction(cmd);
		}
	}

	// ------------ private methods ------------

	private renderMain():void
	{
		this.divMain.empty();
		this.divFooter.empty();

		this.selected = -1;
		this.mapMixDiv.clear();

		let divContent = dom('<div/>').appendTo(this.divMain);

		if (this.viewType == CollectionPanelView.Card)
		{
			divContent.css({'display': 'flex', 'flex-wrap': 'wrap'});
			divContent.css({'justify-content': 'flex-start', 'align-items': 'flex-start'});
		}

		//for (let n = 0; n < this.collection.count; n++)
		for (let idx of this.pageBlock[this.curPage])
		{
			let div = this.createMixture(idx, this.collection.getMixture(idx)).appendTo(divContent);
			div.onClick(() => this.changeSelection(idx));
			div.onDblClick(() => this.editMixture());
			this.mapMixDiv.set(idx, div);
		}

		let npage = this.pageBlock.length;
		if (npage > 1)
		{
			this.divFooter.css({'text-align': 'center', 'border-top': '1px solid #808080', 'background-color': 'white'});

			if (this.curPage > 0)
			{
				let ahref = dom('<a/>').appendTo(this.divFooter).attr({'href': '#'});
				ahref.setText('Previous');
				ahref.onClick((event) =>
				{
					this.curPage--;
					this.renderMain();
					event.preventDefault();
				});
			}

			let showPages:number[] = [];
			for (let n = Math.max(0, this.curPage - 5); n <= Math.min(npage - 1, this.curPage + 5); n++) showPages.push(n);
			if (Vec.first(showPages) != 0) showPages.unshift(0);
			if (Vec.last(showPages) != npage - 1) showPages.push(npage - 1);

			for (let n = 0; n < showPages.length; n++)
			{
				let page = showPages[n];
				if (n > 0 && page != showPages[n - 1] + 1) this.divFooter.appendText('...');
				if (page != this.curPage)
				{
					let ahref = dom('<a/>').appendTo(this.divFooter).attr({'href': '#'});
					ahref.setText(`${page + 1}`);
					ahref.onClick((event) =>
					{
						this.curPage = page;
						this.renderMain();
						event.preventDefault();
					});
				}
				else this.divFooter.appendHTML(`<span>${page + 1}</span>`);
			}

			if (this.curPage < npage - 1)
			{
				let ahref = dom('<a/>').appendTo(this.divFooter).attr({'href': '#'});
				ahref.setText('Next');
				ahref.onClick((event) =>
				{
					this.curPage++;
					this.renderMain();
					event.preventDefault();
				});
			}

			//this.divFooter.find('a,span').css({'margin-left': '0.25em', 'margin-right': '0.25em'});
			for (let dom of this.divFooter.findAll('a,span')) dom.css({'margin-left': '0.25em', 'margin-right': '0.25em'});

			this.divFooter.appendText(` (${this.collection.count})`);
		}
	}

	private dividePages():void
	{
		let sz = this.collection.count;
		if (sz == 0)
		{
			this.pageBlock = [[]];
			this.curPage = 0;
			return;
		}

		let blk:number[] = [];
		this.pageBlock = [blk];
		for (let n = 0; n < sz; n++)
		{
			if (blk.length >= PAGE_SIZE) this.pageBlock.push(blk = []);
			blk.push(n);
		}

		this.curPage = Math.min(this.curPage, this.pageBlock.length - 1);
	}

	private createMixture(idx:number, mixture:Mixture):DOM
	{
		let divOuter = dom('<div/>');
		if (this.viewType == CollectionPanelView.Detail)
		{
			divOuter.css({'display': 'block'});
		}
		else // == CollectionPanelView.Card
		{
			divOuter.css({'display': 'inline-block'});
		}

		let divInner = dom('<div/>').appendTo(divOuter).css({'display': 'flex'});
		divInner.css({'margin': '2px', 'padding': '2px', 'border-radius': '4px'});
		divInner.css({'background-color': BG_NORMAL, 'border': '1px solid #808080'});

		let measure = new wmk.OutlineMeasurement(0, 0, this.policy.data.pointScale);
		let layout = new ArrangeMixture(mixture, measure, this.policy);
		layout.arrange();

		let gfx = new wmk.MetaVector();
		let draw = new DrawMixture(layout, gfx);
		draw.draw();

		let tag = (idx + 1).toString(), fsz = 10, tpad = 2;
		let wad = wmk.FontData.measureText(tag, fsz);
		gfx.drawRect(0, 0, wad[0] + 2 * tpad, wad[1] + 2 * tpad, wmk.MetaVector.NOCOLOUR, 0, 0x000000);
		gfx.drawText(0 + tpad, tpad, tag, fsz, 0xFFFFFF, wmk.TextAlign.Top | wmk.TextAlign.Left);

		gfx.normalise();
		let wrapSVG = dom('<div/>').appendTo(divInner).css({'display': 'inline-block'});
		dom(gfx.createSVG()).appendTo(wrapSVG).css({'display': 'block'});

		if (this.viewType == CollectionPanelView.Detail) this.displayFields(dom('<div/>').appendTo(divInner), mixture);

		return divInner;
	}

	private changeView(cmd:MenuBannerCommand):void
	{
		if (cmd == MenuBannerCommand.ViewDetail) this.viewType = CollectionPanelView.Detail;
		else if (cmd == MenuBannerCommand.ViewCard) this.viewType = CollectionPanelView.Card;
		this.renderMain();
	}

	private changeSelection(idx:number):void
	{
		if (this.selected >= 0)
		{
			let div = this.mapMixDiv.get(this.selected);
			if (div) div.css({'background-color': BG_NORMAL});
		}
		this.selected = idx;
		if (idx >= 0)
		{
			let div = this.mapMixDiv.get(idx);
			if (div) div.css({'background-color': BG_SELECTED});
		}
	}

	protected actionFileOpen():void
	{
		const electron = require('electron');
		const dialog = electron.remote.dialog;
		let params:any =
		{
			'title': 'Open Mixtures',
			'properties': ['openFile'],
			'filters':
			[
				{'name': 'Mixfile Collection', 'extensions': ['json']},
				{'name': 'Mixfile', 'extensions': ['mixfile']},
			]
		};
		dialog.showOpenDialog(params).then((value) =>
		{
			if (value.canceled) return;
			for (let fn of value.filePaths)
			{
				if (fn.endsWith('.mixfile'))
					openNewWindow('MixturePanel', fn);
				else
					openNewWindow('CollectionPanel', fn);
			}
		});
	}

	protected actionFileSave():void
	{
		if (this.editor)
		{
			this.stopEdit();
			return;
		}

		if (!this.filename) {this.actionFileSaveAs(); return;}

		this.saveFile(this.filename);
		this.isDirty = false;
		this.updateTitle();
	}

	protected actionFileSaveAs():void
	{
		const electron = require('electron');
		const dialog = electron.remote.dialog;
		let params:any =
		{
			'title': 'Save Mixfile Collection',
			//defaultPath...
			'filters':
			[
				{'name': 'Mixfile Collection', 'extensions': ['json']}
			]
		};
		dialog.showSaveDialog({}).then((value) =>
		{
			if (value.canceled) return;
			this.saveFile(value.filePath);
			this.filename = value.filePath;
			this.isDirty = false;
			this.updateTitle();
		});
	}

	public saveFile(filename:string):void
	{
		let content = this.collection.serialise();

		const fs = require('fs');
		fs.writeFile(filename, content, (err:any):void =>
		{
			if (err) alert('Unable to save: ' + err);
		});
	}

	private updateTitle():void
	{
		if (this.filename == null) {document.title = 'Mixture Collection'; return;}

		let slash = Math.max(this.filename.lastIndexOf('/'), this.filename.lastIndexOf('\\'));
		let title = 'Mixture Collection - ' + this.filename.substring(slash + 1);
		if (this.isDirty) title += '*';
		document.title = title;
	}

	private updateBanner():void
	{
		let isEditing = this.editor != null;

		this.banner.activateButtons(
		{
			[MenuBannerCommand.EditStructure]: isEditing,
			[MenuBannerCommand.Lookup]: isEditing,
			[MenuBannerCommand.ExportSVG]: isEditing,
			[MenuBannerCommand.Undo]: isEditing,
			[MenuBannerCommand.Redo]: isEditing,
			[MenuBannerCommand.ViewDetail]: !isEditing,
			[MenuBannerCommand.ViewCard]: !isEditing,
		});
	}

	private scrollToIndex(idx:number):void
	{
		if (idx < 0) return;
		let div = this.mapMixDiv.get(idx);
		if (div) this.divMain.el.scrollTop = div.offset().y - this.divMain.offset().y + this.divMain.el.scrollTop;
	}

	private editMixture():void
	{
		if (this.selected < 0) return;

		this.editor = new EditMixture(this.proxyClip, this.proxyMenu);

		this.divMain.empty();
		this.editor.render(this.divMain);

		this.editor.setMixture(this.collection.getMixture(this.selected));
		this.editor.setDirty(false);
		this.updateBanner();
	}

	private stopEdit():void
	{
		if (!this.editor) return;

		let idx = this.selected;
		if (this.editor.isDirty())
		{
			this.collection.setMixture(idx, this.editor.getMixture());
			this.isDirty = true;
		}

		this.editor = null;
		this.renderMain();
		this.changeSelection(idx);
		this.scrollToIndex(idx);
		this.updateBanner();
		this.updateTitle();
	}

	private clipboardCopy(withCut:boolean):void
	{
		let idx = this.selected;
		if (idx < 0 || this.editor) return;

		let str = this.collection.getMixture(idx).serialise();
		this.proxyClip.setString(str);

		if (withCut)
		{
			this.collection.deleteMixture(idx);
			this.isDirty = true;

			let top = this.divMain.el.scrollTop;
			this.renderMain();
			this.divMain.el.scrollTop = top;
			this.updateBanner();
			this.updateTitle();
		}
	}

	private clipboardPaste():void
	{
		let mixture = Mixture.deserialise(this.proxyClip.getString());
		if (!mixture)
		{
			alert('No mixture on clipboard.');
			return;
		}
		this.appendMixture(mixture);
	}

	private deleteMixture():void
	{
		let idx = this.selected;
		if (idx < 0 || this.editor) return;
		this.collection.deleteMixture(idx);
		this.renderMain();
		if (idx < this.collection.count) this.scrollToIndex(idx);

		this.isDirty = true;
		this.updateTitle();
	}

	private appendMixture(mixture?:Mixture):void
	{
		if (!mixture) mixture = new Mixture();

		if (this.editor) return;
		let idx:number;
		if (this.selected < 0)
		{
			idx = this.collection.appendMixture(mixture);
		}
		else
		{
			idx = this.selected + 1;
			this.collection.insertMixture(idx, mixture);
		}
		this.renderMain();
		this.changeSelection(idx);
		this.scrollToIndex(idx);

		this.isDirty = true;
		this.updateTitle();
	}

	private prependMixture():void
	{
		if (this.editor) return;
		let idx = Math.max(0, this.selected);
		this.collection.insertMixture(idx, new Mixture());
		let top = this.divMain.el.scrollTop;
		this.renderMain();
		this.changeSelection(idx);
		this.divMain.el.scrollTop = top;

		this.isDirty = true;
		this.updateTitle();
	}

	private reorderCurrent(dir:number):void
	{
		let idx = this.selected;
		if (idx < 0 || idx + dir < 0 || idx + dir >= this.collection.count || this.editor) return;
		this.collection.swapMixtures(idx, idx + dir);
		let top = this.divMain.el.scrollTop;
		this.renderMain();
		this.changeSelection(idx + dir);
		this.divMain.el.scrollTop = top;

		this.isDirty = true;
		this.updateTitle();
	}

	// alter zoom level by a factor, or reset (null)
	public zoomScale(scale?:number):void
	{
		// TODO
	}

	// render other fields that are encoded into the root branch of the mixture
	private displayFields(domParent:DOM, mixture:Mixture):void
	{
		let items:[string, string][] = [];
		let root = mixture.mixfile as Record<string, any>;
		const SKIP = ['name', 'molfile', 'quantity', 'ratio', 'units', 'relation', 'mixfileVersion'];
		for (let key in root) if (!SKIP.includes(key))
		{
			let val = root[key];
			if (typeof val != 'string' && typeof val != 'number') continue;
			items.push([key, val.toString()]);
		}

		if (items.length == 0) return;

		items.sort((i1, i2) => i1[0].localeCompare(i2[0]));

		domParent.css({'padding-left': '0.5em'});

		let flex = dom('<div/>').appendTo(domParent).css({'display': 'flex'});
		flex.css({'flex-direction': 'row', 'flex-wrap': 'wrap', 'justify-content': 'flex-start', 'align-items': 'flex-start'});

		for (let [title, label] of items)
		{
			let div = dom('<div/>').appendTo(flex).css({'white-space': 'nowrap', 'margin': '0 0.2em 0.2em 0'});
			let divTitle = dom('<div/>').appendTo(div).css({'display': 'inline-block', 'padding': '0.2em', 'background-color': '#C0C0C0', 'border': '1px solid black'});
			let divLabel = dom('<div/>').appendTo(div).css({'display': 'inline-block', 'padding': '0.2em', 'background-color': '#F8F8F8', 'border': '1px solid black'});

			divTitle.css({'border-right': 'none'});
			divTitle.css({'border-radius': '0.2em 0 0 0.2em'});
			divLabel.css({'border-radius': '0 0.2em 0.2em 0'});

			divTitle.setText(title);
			divLabel.setText(label);
		}
	}
}

/* EOF */ }