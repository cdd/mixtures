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
	}

	public getMixture():Mixture {return this.mixture;}
	public setMixture(mixture:Mixture):void
	{
		this.mixture = mixture;

		let measure = new OutlineMeasurement(0, 0, this.policy.data.pointScale);
		let layout = new ArrangeMixture(mixture, measure, this.policy);
		layout.arrange();

		let vg = new MetaVector();
		new DrawMixture(layout, vg).draw();
		vg.normalise();


		this.content.empty();
		let svg = vg.createSVG();
		let div = $('<div></div>').appendTo(this.content);
		div.css('padding', '1em');
		div.append(svg);
	}
}