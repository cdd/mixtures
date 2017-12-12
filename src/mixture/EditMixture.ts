/*
    Mixfile Editor & Viewing Libraries

    (c) 2017 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/sketcher/Sketcher.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/gfx/Rendering.ts'/>
///<reference path='../../../WebMolKit/src/ui/Widget.ts'/>

///<reference path='Mixfile.ts'/>
///<reference path='ArrangeMixture.ts'/>
///<reference path='DrawMixture.ts'/>

/*
	High level widget for the editing area for a mixture.
*/

class EditMixture extends Widget
{
	private mixture = new Mixture();
	private policy = RenderPolicy.defaultColourOnWhite();
	private canvasMixture:HTMLCanvasElement;
	private canvasOver:HTMLCanvasElement;

	private offsetX = 0;
	private offsetY = 0;
	private pointScale = this.policy.data.pointScale;
	private gfxMixture:MetaVector = null;
	private filthy = true;

	// ------------ public methods ------------

	constructor()
	{
		super();
	}

	public render(parent:any):void
	{
		super.render(parent);

		this.content.css({'width': '100%', 'height': '100%'});
		this.content.css('background-color', '#F0F0F0');

		let canvasStyle = 'position: absolute; left: 0; top: 0; pointer-events: none;';
		this.canvasMixture = <HTMLCanvasElement>newElement(this.content, 'canvas', {'style': canvasStyle});
		this.canvasOver = <HTMLCanvasElement>newElement(this.content, 'canvas', {'style': canvasStyle});

		this.content.resize(() => this.redraw());
	}

	public getMixture():Mixture {return this.mixture;}
	public setMixture(mixture:Mixture):void
	{
		this.mixture = mixture;

		// !! centre it...
		this.offsetX = 0;
		this.offsetY = 0;
		this.pointScale = this.policy.data.pointScale;

		this.filthy = true;
		this.redraw();
	}

	// makes sure the content gets redrawn imminently; calling many times is not a performance issue
	public delayedRedraw():void
	{
		this.filthy = true;
		window.setTimeout(() => {if (this.filthy) this.redraw();}, 10);		
	}

	// ------------ private methods ------------
	
	private redraw():void
	{
		if (!this.filthy) return;
		this.filthy = false;

		let width = this.content.width(), height = this.content.height();
		let density = pixelDensity();
		
		for (let canvas of [this.canvasMixture, this.canvasOver])
		{
			canvas.width = width * density;
			canvas.height = height * density;
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';
		}


		let measure = new OutlineMeasurement(this.offsetX, this.offsetY, this.pointScale);
		let layout = new ArrangeMixture(this.mixture, measure, this.policy);
		layout.arrange();

		this.gfxMixture = new MetaVector();
		new DrawMixture(layout, this.gfxMixture).draw();
		this.gfxMixture.normalise();
		
		this.gfxMixture.renderCanvas(this.canvasMixture, true);
	}
}