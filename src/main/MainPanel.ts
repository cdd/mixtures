/*
    Mixfile Editor & Viewing Libraries

    (c) 2017 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>

/*
	Base class for "main windows": an object that takes up the entire browser window document, responds to resizing, etc.
*/

class MainPanel
{
	constructor(public root:JQuery)
	{
		$('body').css('overflow', 'hidden');

		root.css('width', '100%');
		root.css('height', document.documentElement.clientHeight + 'px');
		$(window).resize(() => this.onResize()); 

		root.on('menuAction', (event:any, cmd:string) => this.menuAction(cmd));
	}

	// stub: may be called early on to provide a source file upon which to work
	public loadFile(filename:string):void
	{
	}

	// minimum required functionality for resizing windows; override to capture
	protected onResize()
	{
		this.root.css('height', document.documentElement.clientHeight + 'px');
	}

	// stub: override this to receive menu events
	public menuAction(cmd:string):void
	{
	}
} 