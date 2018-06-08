/*
    Mixfile Editor & Viewing Libraries

    (c) 2017 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../decl/node.d.ts'/>

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='MixturePanel.ts'/>

import wmk = WebMolKit;
import Vec = WebMolKit.Vec;
import pixelDensity = WebMolKit.pixelDensity;
import drawLine = WebMolKit.drawLine;
import escapeHTML = WebMolKit.escapeHTML;
import pathRoundedRect = WebMolKit.pathRoundedRect;
import eventCoords = WebMolKit.eventCoords;
import clone = WebMolKit.clone;
import deepClone = WebMolKit.deepClone;
import orBlank = WebMolKit.orBlank;
import blendRGB = WebMolKit.blendRGB;
import colourCode = WebMolKit.colourCode;
import TWOPI = WebMolKit.TWOPI;
import norm_xy = WebMolKit.norm_xy;
import newElement = WebMolKit.newElement;

namespace Mixtures /* BOF */ {

/*
	Startup: gets the ball rolling, and provide some high level window handling.
*/

let BASE_APP = ''; // base URL location for the app's program files (could be URL or filename)

export function runMixfileEditor(root:JQuery):void
{
	// node/electron imports; note these are defined inside the function so as not to perturb normal web-access, which does not
	// include these libraries
	const path = require('path');
	const electron = require('electron');
	const process = require('process');

	BASE_APP = path.normalize('file:/' + __dirname);

	var url = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
	wmk.RPC.RESOURCE_URL = path.normalize(url + '/res');

	// unpack web params: if present, they determine where to go from here
 	let params = window.location.search.substring(1).split('&');
	let panelClass:string = null; // default is straight to molecule editing
	let filename:string = null;
	for (let p of params)
	{
		let eq = p.indexOf('=');
		if (eq < 0) continue;
		let key = p.substring(0, eq), val = decodeURIComponent(p.substring(eq + 1));
		if (key == 'panel') panelClass= val;
		else if (key == 'fn') filename = val;
	}	

	if (!panelClass)
	{
		let dw = new MixturePanel(root);
		if (filename) dw.loadFile(filename);
	}
	else
	{
		let constructor = eval(panelClass);
		let dw:MainPanel = new constructor(root);
		if (filename) dw.loadFile(filename);
	}
}

// high level functionality for opening a window, with a given panel as content
export function openNewWindow(panelClass:string, filename?:string):void
{
	const electron = require('electron');
	let bw = new electron.remote.BrowserWindow({'width':800, 'height':700, 'icon': 'app/img/icon.png'});
	let url = BASE_APP + '/index.html?panel=' + panelClass;
	if (filename) url += '&fn=' + encodeURIComponent(filename);
	bw.loadURL(url);
	/*bw.on('closed', function() {bw = null;});*/
}

/* EOF */ }