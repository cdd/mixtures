/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	Data container for mixtures: basically wraps the Mixfile interface, with additional functionality.

	Note that functionality should be assumed to be using shallow pointers to the underlying dictionary, unless
	specified otherwise (e.g. clone).
*/

export class Mixture
{
	// ------------ public methods ------------

	constructor(public mixfile?:Mixfile)
	{
		if (!mixfile) this.mixfile = {'mixfileVersion': MIXFILE_VERSION};
		else if (!this.mixfile.mixfileVersion) this.mixfile.mixfileVersion = MIXFILE_VERSION;
	}

	// instantiates a new mixture object by casting a component into a root mixfile
	public static fromComponent(comp:MixfileComponent):Mixture
	{
		let mixfile = deepClone(comp) as Mixfile;
		mixfile.mixfileVersion = MIXFILE_VERSION;
		return new Mixture(mixfile);
	}

	// returns true if the mixture is blank
	public isEmpty():boolean
	{
		return Mixture.isComponentEmpty(this.mixfile);
	}
	public static isComponentEmpty(comp:MixfileComponent):boolean
	{
		const BITS = ['name', 'description', 'synonyms', 'formula', 'molfile', 'inchi', 'inchiKey', 'smiles',
					  'ratio', 'quantity', 'units', 'relation', 'identifiers', 'links'];
		for (let bit of BITS) if ((comp as any)[bit] != null) return false;
		if (Vec.arrayLength(comp.contents) > 0) return false;
		return true;
	}

	// returns true if there's something to put in the quantity section
	public static hasQuantity(comp:MixfileComponent):boolean
	{
		return comp.quantity != null || comp.ratio != null;
	}

	// makes a deep copy of self
	public clone():Mixture
	{
		return new Mixture(deepClone(this.mixfile));
	}

	// returns true if the two mixtures are identical at all parts of their branch structure
	public equals(other:Mixture):boolean
	{
		if (other == null) return false;
		return this.recursiveEqual(this.mixfile, other.mixfile);
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

	// uses the "origin vector" to fetch a particular component; this is an array of indices, where [] indicates the root; its first
	// component is [0], the second child of its first component is [0,1], etc.
	public getComponent(origin:number[]):MixfileComponent
	{
		if (origin.length == 0) return this.mixfile;
		let find:MixfileComponent = null, look = this.mixfile.contents;
		for (let o of origin)
		{
			find = look[o];
			if (!find) return null;
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

	// returns a flat list of all components, i.e. without any hierarchy; these are all pointers to the originals, so
	// modifications can be made directly
	public getComponents():MixfileComponent[]
	{
		let list:MixfileComponent[] = [], stack:MixfileComponent[] = [this.mixfile];
		while (stack.length > 0)
		{
			let comp = stack.shift();
			list.push(comp);
			if (comp.contents) for (let sub of comp.contents) stack.push(sub);
		}
		return list;
	}

	// returns an array that is equal in size to the number of nodes; each entry contains origin of that node
	public 	getOrigins():number[][]
	{
		let origins:number[][] = [];

		let nodeEnum = (origin:number[], comp:MixfileComponent):void =>
		{
			origins.push(origin);
			for (let n = 0; n < Vec.arrayLength(comp.contents); n++) nodeEnum(Vec.append(origin, n), comp.contents[n]);
		};

		nodeEnum([], this.mixfile);
		return origins;
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
			let v = (comp as any)[k];
			if (v != (find as any)[k])
			{
				(find as any)[k] = v;
				modified = true;
			}
		}

		// cleanup by removing explicit nulls
		Object.keys(find).forEach((key:string) => {if ((find as any)[key] == null) delete (find as any)[key];});

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
		// slightly different when prepending before the root element
		if (origin.length == 0)
		{
			let mixfile = this.mixfile;
			let subcomp:MixfileComponent = {};
			const SKIP = ['mixfileVersion', 'contents'];
			for (let key in (mixfile as any)) if (!SKIP.includes(key))
			{
				(subcomp as any)[key] = (mixfile as any)[key];
				delete (mixfile as any)[key];
			}
			mixfile.contents = [subcomp];

			return;
		}

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

	// makes a JSON object into a nicely formatted string for human readability
	public static beautify(json:any):string
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

	// ------------ private methods ------------

	// returns true if this component, and all sub-components, are equal
	private recursiveEqual(comp1:MixfileComponent, comp2:MixfileComponent):boolean
	{
		let dict1:any = comp1, dict2:any = comp2;
		/*let keys1 = Object.keys(dict1), keys2 = Object.keys(dict2);
		let i:number;
		if ((i = keys1.indexOf('contents')) >= 0) keys1.splice(i, 1);
		if ((i = keys2.indexOf('contents')) >= 0) keys2.splice(i, 1);*/
		let keys1:string[] = [], keys2:string[] = [];
		for (let k in dict1) if (k != 'contents' && dict1[k] != null) keys1.push(k);
		for (let k in dict2) if (k != 'contents' && dict2[k] != null) keys2.push(k);
		keys1.sort();
		keys2.sort();
		if (!Vec.equals(keys1, keys2)) return false; // different keys (less contents) is a dealbreaker
		for (let k of keys1)
		{
			let v1 = dict1[k], v2 = dict2[k];
			if (Array.isArray(v1) && Array.isArray(v2))
			{
				if (!Vec.equals(v1, v2)) return false;
			}
			else // assume scalar
			{
				if (v1 != v2) return false;
			}
		}

		let len = Vec.arrayLength(comp1.contents);
		if (len != Vec.arrayLength(comp2.contents)) return false;
		for (let n = 0; n < len; n++) if (!this.recursiveEqual(comp1.contents[n], comp2.contents[n])) return false;

		return true;
	}
}

/* EOF */ }