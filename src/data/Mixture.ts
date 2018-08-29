/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../decl/node.d.ts'/>
///<reference path='Mixfile.ts'/>

namespace Mixtures /* BOF */ {

/*
	Data container for mixtures: basically wraps the Mixfile interface, with additional functionality.
*/

export class Mixture
{
	// ------------ public methods ------------

	constructor(public mixfile?:Mixfile)
	{
		if (!mixfile) this.mixfile = {'mixfileVersion': MIXFILE_VERSION};
	}

	// returns true if the mixture is blank
	public isEmpty():boolean
	{
		const BITS = ['name', 'description', 'synonyms', 'formula', 'molfile', 'inchi', 'inchiKey', 'smiles', 
					  'ratio', 'quantity', 'units', 'relation', 'identifiers', 'links', 'contents'];
		for (let bit of BITS) if ((this.mixfile as any)[bit] != null) return false;
		return true;
	}

	// makes a deep copy of self
	public clone():Mixture
	{
		return new Mixture(deepClone(this.mixfile));
	}

	// unpacks a string into a mixture; throws an exception if anything went wrong
	public static deserialise(data:string):Mixture
	{
		let mixfile = JSON.parse(data);
		return new Mixture(mixfile);
	}

	// converts the entire underlying JSON mixfile into a prettyprinted string
	public serialise():string
	{
		return Mixture.beautify(this.mixfile);
	}

	// likewise, for a sub-component
	public static serialiseComponent(comp:MixfileComponent):string
	{
		return Mixture.beautify(comp);
	}

	// uses the "origin vector" to fetch a particular component; this is an array of indices, where [] indicates the root; its first component is [0], 
	// the second child of its first component is [0,1], etc.
	public getComponent(origin:number[]):MixfileComponent
	{
		if (origin.length == 0) return this.mixfile;
		let find:MixfileComponent = null, look = this.mixfile.contents;
		for (let o of origin)
		{
			find = look[o];
			look = find.contents;
		}
		return find;
	}
	public getParentComponent(origin:number[]):MixfileComponent
	{
		if (origin.length == 0) return null;
		origin = origin.slice();
		origin.pop();
		return this.getComponent(origin);
	}

	// replaces a component at a given position; returns true if the new component was different to the old one
	public setComponent(origin:number[], comp:MixfileComponent):boolean
	{
		let find:MixfileComponent = this.mixfile, look = this.mixfile.contents;
		for (let o of origin)
		{
			find = look[o];
			look = find.contents;
		}

		// copy over the dictionary entries in 'comp', noting if anything changed
		let modified = false;
		for (let k in comp)
		{
			let v = (<any>comp)[k];
			if (v != (<any>find)[k])
			{
				(<any>find)[k] = v;
				modified = true;
			}
		}
		return modified;
	}

	// deletes the indicated component, and collapses any child nodes into its own position (as opposed to just deleting
	// them too)
	public deleteComponent(origin:number[]):void
	{
		if (origin.length == 0) return; // can't delete the whole thing

		let find:MixfileComponent = this.mixfile, look = this.mixfile.contents, parent = look;
		for (let o of origin)
		{
			parent = look;
			find = look[o];
			look = find.contents;
		}
		let idx = origin[origin.length - 1];
		parent.splice(idx, 1);
		if (look) for (let c of look) parent.splice(idx++, 0, c);
	}

	// insert a new component "above" the existing one, and handle the reparenting
	public prependBefore(origin:number[], comp:MixfileComponent):void
	{
		if (origin.length == 0) return;

		let find:MixfileComponent = this.mixfile, look = this.mixfile.contents, parent = look;
		for (let o of origin)
		{
			parent = look;
			find = look[o];
			look = find.contents;
		}
		let idx = origin[origin.length - 1];
		parent[idx] = comp;
		comp.contents = [find];
	}

	// takes an origin vector and splits it into {parent origin} and {child index}; returns null on both counts if this is the root node
	public static splitOrigin(origin:number[]):[number[], number]
	{
		if (origin.length == 0) return [null, null];
		let parent = origin.slice(0);
		let idx = parent.splice(origin.length - 1, 1)[0];
		return [parent, idx];
	}

	// ------------ private methods ------------

	// makes a JSON object into a nicely formatted string for human readability
	private static beautify(json:any):string
	{
		let lines = JSON.stringify(json, null, 4).split('\n');
		let regex = /^(\s*\"\w+\": )([\[\{].*)$/, regpad = /^(\s*)/;
		for (let n = 0; n < lines.length; n++)
		{
			let match = regex.exec(lines[n]);
			if (!match) continue;
			let padding = regpad.exec(lines[n]);
			lines[n] = match[1] + '\n' + padding[1] + match[2];
		}
		return lines.join('\n');
	}
}

/* EOF */ }