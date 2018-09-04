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
	}

    // returns the MInChI string formulated as above
    public getResult():string
    {
        return this.minchi;
    }

	// ------------ private methods ------------

/*
    // turns a concentration into a suitable precursor string, or null otherwise
    private formatConcentration(comp:MixfileComponent):string
    {
        // TODO: need special deal for ratio without denominator - can sometimes add them up to form an implicit denominator

        if (comp.ratio && comp.ratio.length >= 2)
        {
            let numer = comp.ratio[0], denom = comp.ratio[1];
            if (!(denom > 0)) return null;
            return (100 * numer / denom) + ' pp';
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

        return bits.join(' ');
    }*/
}

/* EOF */ }