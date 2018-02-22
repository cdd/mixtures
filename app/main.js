/*
    Mixfile Editor & Viewing Libraries

    (c) 2017 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

const electron = require('electron');
const {app, BrowserWindow} = electron;

app.on('window-all-closed', function() 
{
	if (process.platform != 'darwin') app.quit();
});

// dig through command line parameters
let argv = process.argv.slice(0);
//let cwd = process.cwd();
let files = [];

while (argv.length > 0)
{
	let arg = argv.shift();
	if (arg == 'app/main.js') break; // anything after this is fair game
}
for (let n = 0; n < argv.length; n++)
{
	if (argv[n].startsWith('-')) {}
	else files.push(argv[n]);
	// (... consider other options...)
}
if (files.length == 0) files.push(null);

const BROWSER_PARAMS = {'width': 800, 'height': 700, 'icon': 'app/img/icon.png'};
const INIT_URL = 'file://' + __dirname + '/index.html';

let mainWindows = [];

app.on('window-all-closed', function() 
{
	/*if (process.platform != 'darwin')*/ app.quit();
});

app.on('ready', function() 
{ 
	for (let fn of files)
	{
		let wnd = new BrowserWindow(BROWSER_PARAMS);
		let url = INIT_URL;
		if (fn) url += '?fn=' + encodeURIComponent(fn);
		wnd.loadURL(url); 
		wnd.on('closed', () => 
		{
			wnd.removeAllListeners();
			for (let n = 0; n < mainWindows.length; n++) if (mainWindows[n] === wnd) {mainWindows.splice(n, 1); break;}
		});
	}
	setupMenu();
});

// setup the global menu for all windows
function setupMenu()
{
	const Menu = electron.Menu;

	// pushes a menu command over IPC to the render task: locates the root branch and issues a message, which will have been
	// captured by the instance of MainPanel
	function sendCommand(cmd)
	{
		let browser = BrowserWindow.getFocusedWindow();
		if (!browser) return;
		let js = '$("#root").trigger("menuAction", "' + cmd + '")';
		browser.webContents.executeJavaScript(js);
	}

	let template = 
	[
		{
			'label': 'File',
			'submenu': 
			[
				{'label': 'New Mixture', 'accelerator': 'CmdOrCtrl+N', 'click': () => new BrowserWindow(BROWSER_PARAMS).loadURL(INIT_URL)},
				{'label': 'Open...', 'accelerator': 'CmdOrCtrl+O', 'click': () => sendCommand('open')},
				{'label': 'Save', 'accelerator': 'CmdOrCtrl+S', 'click': () => sendCommand('save')},
				{'label': 'Save As...', 'accelerator': 'CmdOrCtrl+Shift+S', 'click': () => sendCommand('saveAs')},
				{'label': 'Export SDF...', 'accelerator': 'CmdOrCtrl+E', 'click': () => sendCommand('exportSDF')},
				{'role': 'close'}
			]
		},
		{
			'label': 'Edit',
			'submenu': 
			[
				{'label': 'Undo', 'accelerator': 'CmdOrCtrl+Z', 'click': () => sendCommand('undo')},
				{'label': 'Redo', 'accelerator': 'CmdOrCtrl+Shift+Z', 'click': () => sendCommand('redo')},
				{'type': 'separator'},
				{'label': 'Cut', 'accelerator': 'CmdOrCtrl+X', 'click': () => sendCommand('cut')},
				{'label': 'Copy', 'accelerator': 'CmdOrCtrl+C', 'click': () => sendCommand('copy')},
				{'label': 'Paste', 'accelerator': 'CmdOrCtrl+V', 'click': () => sendCommand('paste')},
				{'label': 'Delete', 'accelerator': 'CmdOrCtrl+Delete', 'click': () => sendCommand('delete')},
				{'label': 'Select All', 'accelerator': 'CmdOrCtrl+A', 'click': () => sendCommand('selectAll')},
			]
		},
		{
			'label': 'View',
			'submenu': 
			[
				{'label': 'Reload', 'role': 'reload'},
				{'label': 'Dev Tools', 'role': 'toggledevtools'},
				{'type': 'separator'},
				{'label': 'Normal Size', 'accelerator': 'CmdOrCtrl+0', 'click': () => sendCommand('zoomFull')},
				{'label': 'Zoom In', 'accelerator': 'CmdOrCtrl+=', 'click': () => sendCommand('zoomIn')},
				{'label': 'Zoom Out', 'accelerator': 'CmdOrCtrl+-', 'click': () => sendCommand('zoomOut')},
				{'type': 'separator'},
				{'role': 'togglefullscreen'}
			]
		},
		{
			'role': 'window',
			'submenu': 
			[
				{'role': 'minimize'},
				{'role': 'close'}
			]
		},
		/*{
			role: 'help',
			submenu: 
			[
			{
				label: 'Learn More',
				click () { require('electron').shell.openExternal('http://electron.atom.io') }
			}
			]
		}*/
	];

	if (process.platform === 'darwin') 
	{
		template.unshift(
		{
			'label': 'Mixtures',
			'submenu': 
			[
				{'role': 'about'},
				{'type': 'separator'},
				{'role': 'services', 'submenu': []},
				{'type': 'separator'},
				{'role': 'hide'},
				{'role': 'hideothers'},
				{'role': 'unhide'},
				{'type': 'separator'},
				{'role': 'quit'}
			]
		});
		/*
		// Edit menu.
		template[1].submenu.push(
			{
			type: 'separator'
			},
			{
			label: 'Speech',
			submenu: [
				{
				role: 'startspeaking'
				},
				{
				role: 'stopspeaking'
				}
			]
			}
		)
		// Window menu.
		template[3].submenu = [
			{
			label: 'Close',
			accelerator: 'CmdOrCtrl+W',
			role: 'close'
			},
			{
			label: 'Minimize',
			accelerator: 'CmdOrCtrl+M',
			role: 'minimize'
			},
			{
			label: 'Zoom',
			role: 'zoom'
			},
			{
			type: 'separator'
			},
			{
			label: 'Bring All to Front',
			role: 'front'
			}
		]*/
	}

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);

/*
	//const ipcRenderer = electron.ipcRenderer;
	const {ipcRenderer} = require('electron');
console.log('IPC?'+!!ipcRenderer+"/"+electron+"/"+electron.ipcRenderer);
for (let zog in electron) console.log('-- ' + zog);
	ipcRenderer.on('menu', function(event, arg)
	{
      console.log('menu message reviced'); // appear on macOS, not appear on Windows.
      if (arg == 'disable') menu.items[0].submenu.items[1].enabled = false;
    });*/
}