/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {MainPanel} from './MainPanel';
import {MixturePanel} from './MixturePanel';
import {DOM} from 'webmolkit/util/dom';
import {initWebMolKit, Theme} from 'webmolkit/util/Theme';
import {OntologyTree} from 'webmolkit/data/OntologyTree';
import {ClipboardProxy} from 'webmolkit/ui/ClipboardProxy';
import {MenuProxy, MenuProxyContext} from 'webmolkit/ui/MenuProxy';
import * as path from 'path';
import * as process from 'process';
import {ipcRenderer} from 'electron';
import {Menu as ElectronMenu, MenuItem as ElectronMenuItem, clipboard as electronClipboard, getCurrentWindow} from '@electron/remote';
import {CollectionPanel} from './CollectionPanel';

export let ON_DESKTOP = false; // by default assume it's running in a regular web page; switch to true if it's the locally
							   // executed window version
export function setOnDesktop(onDesktop:boolean):void {ON_DESKTOP = onDesktop;}

/*
	Startup: gets the ball rolling, and provide some high level window handling.
*/

export async function runMixfileEditor(resURL:string, rootID:string):Promise<void>
{
	let root = DOM.find('#' + rootID);

	ON_DESKTOP = true;
	initWebMolKit(resURL);
	await OntologyTree.init();
	await OntologyTree.main.loadFromURL(resURL + '/data/ontology/metacategory.onto');

	process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

	let url = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
	Theme.RESOURCE_URL = path.normalize(url + '/res');

	// unpack web params: if present, they determine where to go from here
 	let params = window.location.search.substring(1).split('&');
	let panelClass:string = null; // default is straight to molecule editing
	let filename:string = null;
	for (let p of params)
	{
		let eq = p.indexOf('=');
		if (eq < 0) continue;
		let key = p.substring(0, eq), val = decodeURIComponent(p.substring(eq + 1));
		if (key == 'panel') panelClass = val;
		else if (key == 'fn') filename = val;
	}

	if (!panelClass && filename && filename.endsWith('.json')) panelClass = 'CollectionPanel';

	let proxyClip = new ClipboardProxy();
	proxyClip.getString = ():string => electronClipboard.readText();
	proxyClip.setString = (str:string):void => electronClipboard.writeText(str);
	proxyClip.setHTML = (html:string):void => electronClipboard.writeHTML(html);
	proxyClip.canSetHTML = ():boolean => true;
	proxyClip.canAlwaysGet = ():boolean => true;

	let proxyMenu = new MenuProxy();
	proxyMenu.hasContextMenu = () => true;
	proxyMenu.openContextMenu = (menuItems:MenuProxyContext[], event:MouseEvent) =>
	{
		let populate = (emenu:Electron.Menu, itemList:MenuProxyContext[]):void =>
		{
			for (let item of itemList)
			{
				if (!item || !item.label) emenu.append(new ElectronMenuItem({type: 'separator'}));
				else if (item.click) emenu.append(new ElectronMenuItem(item));
				else if (item.subMenu)
				{
					let subMenu = new ElectronMenu();
					populate(subMenu, item.subMenu);
					emenu.append(new ElectronMenuItem({label: item.label, submenu: subMenu}));
				}
			}
		};

		let menu = new ElectronMenu();
		populate(menu, menuItems);

		menu.popup({window: getCurrentWindow()});
	};

	let main:MainPanel;
	if (!panelClass || panelClass == 'MixturePanel')
	{
		main = new MixturePanel(root, proxyClip, proxyMenu);
	}
	else if (panelClass == 'CollectionPanel')
	{
		main = new CollectionPanel(root, proxyClip, proxyMenu);
	}

	main.loadFile(filename);

	ipcRenderer.on('menuAction', (event, args) => main.menuAction(args));	
}

// high level functionality for opening a window, with a given panel as content
/*export function openNewWindow(panelClass:string, filename?:string):void
{
	const WEBPREF = {nodeIntegration: true, contextIsolation: false, enableRemoteModule: true, spellcheck: false};
	let iconFN = __dirname + '/img/icon.png';
	let bw = new BrowserWindow({width: 900, height: 800, icon: iconFN, webPreferences: WEBPREF});
	let baseApp = path.normalize('file:/' + __dirname);
	let url = baseApp + '/index.html?panel=' + panelClass;
	if (filename) url += '&fn=' + encodeURIComponent(filename);
	bw.loadURL(url);
}*/


export function openNewWindow(panelClass:string, filename?:string, options:Record<string, string> = {}):void
{
	let args:Record<string, string> = {...options};
	if (panelClass) args['panelClass'] = panelClass;
	if (filename) args['filename'] = filename;
	ipcRenderer.send('openWindow', args);
}
