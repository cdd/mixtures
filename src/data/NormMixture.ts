/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2020 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/sketcher/MoleculeActivity.ts'/>

///<reference path='Mixfile.ts'/>
///<reference path='Mixture.ts'/>

namespace Mixtures /* BOF */ {

/*
	Mixture normalisation options: recommendations for how to make a mixture more conformant. It is up to the caller
	to decide what to do with this information.
*/

export interface NormMixtureNote
{
	origin:number[];

	stereoEnum?:string[]; // if defined, contains stereo-enumerated versions of current

	// units converted into concentration, if both possible & necessary
	concQuantity?:number; // a concentration numeric which is associated with the units below (two numbers in case of a range)
	concUnits?:string; // units for quantity (e.g. %, mol/L, g, etc.)
}

enum AbsType
{
	None,
	Mass, // reference scale: g
	Volume, // reference scale: L
	Moles, // reference scale: mol
}

export class NormMixture
{
	public notes:NormMixtureNote[] = [];

	// ------------ public methods ------------

	constructor(private mixture:Mixture)
	{
	}

	public analyse():void
	{
		let origins = this.mixture.getOrigins();
		let compList = origins.map((origin) => this.mixture.getComponent(origin));

		for (let n = 0; n < origins.length; n++)
		{
			let note:NormMixtureNote = {'origin': origins[n]};

			// stereocentres get expanded out
			let comp = compList[n];
			if (comp.molfile && Vec.isBlank(comp.contents))
			{
				let mol = wmk.MoleculeStream.readUnknown(comp.molfile);
				if (!mol) continue;
				let stereo = this.enumerateStereo(mol);
				if (Vec.notBlank(stereo)) note.stereoEnum = stereo.map((mol) => wmk.MoleculeStream.writeMDLMOL(mol));
			}

			this.notes.push(note);
		}

		let childIndexes:number[][] = [];
		for (let n = 0; n < origins.length; n++)
		{
			childIndexes[n] = [];
			let o = origins[n];
			for (let i = n + 1; i < origins.length; i++)
				if (origins[i].length == o.length + 1 && Vec.equals(o, origins[i].slice(0, o.length))) childIndexes[n].push(i);
		}

		// conversion of "absolute units" to concentrations, where possible
		let sumType = new Array(origins.length).fill(AbsType.None);
		let sumAmount = Vec.numberArray(null, origins.length);
		while (true)
		{
			let modified = false;

console.log('CYCLE...');
			for (let n = 0; n < origins.length; n++)
			{
				let comp = compList[n], note = this.notes[n];

				if (sumType[n] == AbsType.None)
				{
					[sumAmount[n], sumType[n]] = this.toAbsoluteUnits(comp);
					if (sumType[n] != AbsType.None) modified = true;
				}

				if (Vec.isBlank(comp.contents)) continue;

				// if there's no absolute quantity presently available, see if we can add up the sub-components
				if (sumType[n] == AbsType.None)
				{
					let amount = 0, childType = AbsType.None;
					for (let i of childIndexes[n])
					{
						if (sumType[i] == AbsType.None || (childType != AbsType.None && sumType[i] != childType))
						{
							childType = AbsType.None;
							break;
						}
						childType = sumType[i];
						amount += sumAmount[i];
					}

					if (childType != AbsType.None)
					{
						sumType[n] = childType;
						sumAmount[n] = amount;
						modified = true;
					}
				}

				// if current type is an absolute unit, see if all-but-one of the children have that same type
				if (sumType[n] != AbsType.None)
				{
					let idxOne = -1, sum = 0;
					for (let i of childIndexes[n])
					{
						if (sumType[i] == AbsType.None)
						{
							if (idxOne >= 0) {idxOne = -1; break;} // only one allowed
							idxOne = i;
						}
						else if (sumType[i] != sumType[n]) {idxOne = -1; break;} // can't be defined-but-different
					}

					if (idxOne >= 0)
					{
						sumType[idxOne] = sumType[n];
						sumAmount[idxOne] = sumAmount[n] - sum;
						modified = true;
					}
				}
			}

console.log('    modified='+modified);
console.log('    sumType='+sumType);
console.log('    sumAmount='+sumAmount);

			if (!modified) break;
		}

		// now use derived absolute units to infer concentration-types
		for (let n = 0; n < origins.length; n++) if (sumType[n] != AbsType.None)
		{
			for (let i of childIndexes[n]) if (sumType[i] != AbsType.None)
			{
				let numer = sumAmount[i], denom = sumAmount[n];
				let value:number = null, uri:string = null;
				if (sumType[i] == AbsType.Mass)
				{
					if (sumType[n] == AbsType.Mass) [value, uri] = [100 * numer / denom, StandardUnits.pcWW];
					else if (sumType[n] == AbsType.Volume) [100 * numer / denom, StandardUnits.pcWV];
					else if (sumType[n] == AbsType.Moles) {}
				}
				else if (sumType[i] == AbsType.Volume)
				{
					if (sumType[n] == AbsType.Mass) {}
					else if (sumType[n] == AbsType.Volume) [100 * numer / denom, StandardUnits.pcVV];
					else if (sumType[n] == AbsType.Moles) {}
				}
				else if (sumType[i] == AbsType.Moles)
				{
					if (sumType[n] == AbsType.Mass) {}
					else if (sumType[n] == AbsType.Volume) [value, uri] = [numer / denom, StandardUnits.mol_L];
					else if (sumType[n] == AbsType.Moles) [value, uri] = [100 * numer / denom, StandardUnits.pcMM];
				}
				if (uri != null)
				{
					this.notes[i].concQuantity = value;
					this.notes[i].concUnits = Units.uriToName(uri);
				}
			}
		}
	}

	// ------------ private methods ------------

	// if the given molecule has stereogenic centres (i.e. wavy bonds), enumerate them explicitly
	private enumerateStereo(mol:wmk.Molecule):wmk.Molecule[]
	{
		let splitMolecule = (mol:wmk.Molecule):wmk.Molecule[] =>
		{
			for (let n = 1; n <= mol.numBonds; n++) if (mol.bondType(n) == wmk.Molecule.BONDTYPE_UNKNOWN)
			{
				let mol1 = mol.clone(), mol2 = mol.clone();
				if (mol.bondOrder(n) == 1)
				{
					// make up & down versions of the bond
					mol1.setBondType(n, wmk.Molecule.BONDTYPE_DECLINED);
					mol2.setBondType(n, wmk.Molecule.BONDTYPE_INCLINED);
					return [mol1, mol2];
				}
				else if (mol.bondOrder(n) == 2)
				{
					// for a cis/trans double bond, use the sketcher algorithm to rotate it; if the rotation is rejected,
					// it'll just return the input molecule, with the stereolabel removed
					let mol1 = mol.clone();
					mol1.setBondType(n, wmk.Molecule.BONDTYPE_NORMAL);

					let mol2:wmk.Molecule = null;
					if (!mol.bondInRing(n))
					{
						let state:wmk.SketchState = {'mol': mol1, 'currentAtom': 0, 'currentBond': n, 'selectedMask': null};
						let activ = new wmk.MoleculeActivity(state, wmk.ActivityType.BondRotate, {});
						activ.execute();
						if (!activ.errmsg && activ.output.mol) mol2 = activ.output.mol;
					}
					return mol2 ? [mol1, mol2] : [mol1];
				}
			}
			return null;
		};

		let list:wmk.Molecule[] = [mol];
		for (let n = 0; n < list.length; n++)
		{
			let emols = splitMolecule(list[n]);
			if (!emols) continue;

			list[n] = emols[0];
			for (let i = emols.length - 1; i >= 1; i--) list.splice(n + 1, 0, emols[i]);
			n--;
		}

		return list.length > 1 ? list : null;
	}

	// converts the units within the component to "absolute" form, at a singular scale
	private toAbsoluteUnits(comp:MixfileComponent):[number, AbsType]
	{
		if (!comp.units || typeof comp.quantity != 'number') return [null, AbsType.None];
		let uri = Units.nameToURI(comp.units), value = comp.quantity as number;
		if (!uri) return [null, AbsType.None];

		if (uri == StandardUnits.kg) return [value * 1E3, AbsType.Mass];
		else if (uri == StandardUnits.g) return [value, AbsType.Mass];
		else if (uri == StandardUnits.mg) return [value * 1E-3, AbsType.Mass];
		else if (uri == StandardUnits.ug) return [value * 1E-6, AbsType.Mass];
		else if (uri == StandardUnits.ng) return [value * 1E-9, AbsType.Mass];
		else if (uri == StandardUnits.L) return [value, AbsType.Volume];
		else if (uri == StandardUnits.mL) return [value * 1E-3, AbsType.Volume];
		else if (uri == StandardUnits.uL) return [value * 1E-6, AbsType.Volume];
		else if (uri == StandardUnits.nL) return [value * 1E-9, AbsType.Volume];
		else if (uri == StandardUnits.mol) return [value, AbsType.Moles];
		else if (uri == StandardUnits.mmol) return [value * 1E-3, AbsType.Moles];
		else if (uri == StandardUnits.umol) return [value * 1E-6, AbsType.Moles];
		else if (uri == StandardUnits.nmol) return [value * 1E-9, AbsType.Moles];

		return [null, AbsType.None];
	}
}

/* EOF */ }