/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2018 Collaborative Drug Discovery, Inc

    All rights reserved
    
    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/data/DataSheetStream.ts'/>
///<reference path='../../../WebMolKit/src/data/MDLWriter.ts'/>

///<reference path='../main/startup.ts'/>
///<reference path='../main/InChI.ts'/>
///<reference path='../data/Mixfile.ts'/>
///<reference path='../data/Mixture.ts'/>
///<reference path='../data/Units.ts'/>

namespace Mixtures /* BOF */ {

// work-in-progress placeholder for the recursive MInChI assembler
interface MInChIBuilder
{
	molecules:string;
	hierarchy:string;
	units:string;
	count:number;
}

/*
	Formulates a MInChI string out of the given mixture.
*/

export class ExportMInChI
{
	private mixture:Mixture;
	private minchi = '?';

	// ------------ public methods ------------

    constructor(private mixfile:Mixfile)
    {
		this.mixture = new Mixture(mixfile);
    }

	// this should generally be called first: any component that has a structure but not an InChI string gets one calculated,
	// which presumes that the external environment has been configured to allow this; returns true if anything was done, i.e.
	// the parameter mixture was modified; note that if any components have an InChI that is wrong, this will be believed
	public fillInChI():boolean
	{
		if (!InChI.isAvailable()) return false; // silent failure: the caller should check if specific action is required

		let modified = false;
		for (let comp of this.mixture.getComponents())
		{
			if (!comp.molfile || comp.inchi) continue;
			let mol:wmk.Molecule = null;
			try {mol = wmk.MoleculeStream.readUnknown(comp.molfile);}
			catch (e) {continue;} // silent failure if it's an invalid molecule
			if (wmk.MolUtil.isBlank(mol)) continue;
			[comp.inchi, comp.inchiKey] = InChI.makeInChI(mol);
			modified = true;
		}
		return modified;
	}

	// assembles the MInChI string: once this has completed, the result is available
	public formulate():void
	{
		let sortmix = deepClone(this.mixfile);
		this.sortContents(sortmix.contents);

		let builder:MInChIBuilder = {'molecules': '', 'hierarchy': '', 'units': '', 'count': 0};
		if (sortmix.inchi || sortmix.name /* ?? */) this.assembleContents(builder, [sortmix])
		else if (Vec.arrayLength(sortmix.contents) > 0) this.assembleContents(builder, sortmix.contents);
		else {} // do nothing: it's completely empty
		
		// NOTE: haven't quite decided how to do names yet; if the root node has a name but no structure, is that
		// cause for making an "empty" hierarchy element? if not, then the overall name of the mixture gets lost...

		this.minchi = 'MInChI=0.00.1S/' + builder.molecules + '/n{' + builder.hierarchy + '}/g{' + builder.units + '}';
	}

    // returns the MInChI string formulated as above
    public getResult():string
    {
        return this.minchi;
    }

	// ------------ private methods ------------

	// for the given mixfile components, sorts them by InChI, and does likewise with their contents
	private sortContents(contents:MixfileComponent[]):void
	{
		if (!contents || contents.length <= 1) return;
		contents.sort((c1:MixfileComponent, c2:MixfileComponent):number =>
		{
			let s1 = (c1.inchi ? c1.inchi : '?') + '\t' + (c1.name ? c1.name : '');
			let s2 = (c2.inchi ? c2.inchi : '?') + '\t' + (c2.name ? c2.name : '');
			return s1.localeCompare(s2);
		});
		for (let comp of contents) this.sortContents(comp.contents);
	}

	// recursively scans down the content array (previously sorted) and collects the components into a list, which
	// is expressed by the interim builder object
	private assembleContents(builder:MInChIBuilder, contents:MixfileComponent[])
	{
		//if (!contents || contents.length == 0) return;

		for (let n = 0; n < contents.length; n++)
		{
			let notFirst = builder.count > 0;

			let comp = contents[n];
			if (notFirst) builder.molecules += '&';
			if (comp.inchi) 
			{
				const PFX = 'InChI=1S/'; // if it doesn't start with this, we don't consider it a valid InChI
				if (comp.inchi.startsWith(PFX)) builder.molecules += comp.inchi.substring(PFX.length);
			}

			if (n > 0) builder.hierarchy += '&';
			builder.hierarchy += (++builder.count).toString();

			if (notFirst) builder.units += '&';
			let fmtconc = this.formatConcentration(comp);
			if (fmtconc) builder.units += fmtconc;

			// add sub-components (recursively)
			if (comp.contents && comp.contents.length > 0)
			{
				builder.hierarchy += '&'; // need to precede the '{...}' that will be subsequently appended
				builder.hierarchy += '{';
				this.assembleContents(builder, comp.contents);
				builder.hierarchy += '}';
			}
		}
	}

    // turns a concentration into a suitable precursor string, or null otherwise
    private formatConcentration(comp:MixfileComponent):string
    {
        // TODO: need special deal for ratio without denominator - can sometimes add them up to form an implicit denominator
		// TODO: this is currently the same as ExportSDFile; make a common reference... probably Units.ts

        if (comp.ratio && comp.ratio.length >= 2)
        {
            let numer = comp.ratio[0], denom = comp.ratio[1];
            if (!(denom > 0)) return null;
            return (100 * numer / denom) + 'pp';
        }

        if (comp.quantity == null || comp.units == null) return null;

        // special deal (maybe temporary): units that are written with common names that map to a URI are converted automatically
        let unitURI = comp.units;
        if (!unitURI.startsWith('http://')) unitURI = Units.nameToURI(unitURI);
        if (!unitURI) return;

        // TODO: maybe another special deal for absolute weight/volume/mole quantities - convert them into ratios, to the extent that's
        // possible... maybe approximating where necessary

        let bits:string[] = [];
        
        if (comp.relation != null) bits.push(comp.relation);

        let values:number[] = typeof comp.quantity == 'number' ? [comp.quantity as number] : comp.quantity;

        let [mnemonic, scaled] = Units.convertToMInChI(unitURI, values);
        if (!mnemonic) return;
        bits.push(scaled[0].toString());
        if (scaled.length > 1) {bits.push('..'); bits.push(scaled[1].toString());}
        bits.push(mnemonic);

        return bits.join('');
    }
}

/* EOF */ }