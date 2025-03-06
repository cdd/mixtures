/*
	Mixfile Editor & Viewing Libraries

	(c) 2017-2025 Collaborative Drug Discovery, Inc

	All rights reserved

	http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Vec} from 'webmolkit/util/Vec';
import {Mixture} from './Mixture';
import {MoleculeStream} from 'webmolkit/io/MoleculeStream';
import {StandardUnits, Units} from './Units';
import {Molecule} from 'webmolkit/mol/Molecule';
import {ActivityType, MoleculeActivity, SketchState} from 'webmolkit/sketcher/MoleculeActivity';
import {MixfileComponent} from './Mixfile';

/*
	Mixture normalisation options: recommendations for how to make a mixture more conformant. It is up to the caller
	to decide what to do with this information.
*/

export interface NormMixtureNote
{
	origin:number[];

	stereoEnum?:string[]; // if defined, contains stereo-enumerated versions of current

	// units converted into concentration, if both possible & necessary
	concQuantity?:number | number[]; // a concentration numeric which is associated with the units below (two numbers in case of a range)
	concError?:number; // optional standard error (applies to quantity when it's a scalar)
	concUnits?:string; // units for quantity (e.g. %, mol/L, g, etc.)
	concRelation?:string;
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
			let note:NormMixtureNote = {origin: origins[n]};

			// stereocentres get expanded out
			let comp = compList[n];
			if (comp.molfile && Vec.isBlank(comp.contents))
			{
				let mol = MoleculeStream.readUnknown(comp.molfile);
				if (!mol) continue;
				let stereo = this.enumerateStereo(mol);
				if (Vec.notBlank(stereo)) note.stereoEnum = stereo.map((mol) => MoleculeStream.writeMDLMOL(mol));
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
		let sumAmount1 = Vec.numberArray(null, origins.length);
		let sumAmount2 = Vec.numberArray(null, origins.length);
		let sumError = Vec.numberArray(null, origins.length);
		while (true)
		{
			let modified = false;

			for (let n = 0; n < origins.length; n++)
			{
				let comp = compList[n], note = this.notes[n];

				if (sumType[n] == AbsType.None)
				{
					[sumType[n], sumAmount1[n], sumAmount2[n], sumError[n]] = this.toAbsoluteUnits(comp);
					if (sumType[n] != AbsType.None) modified = true;
				}

				if (Vec.isBlank(comp.contents)) continue;

				// if there's no absolute quantity presently available, see if we can add up the sub-components
				if (sumType[n] == AbsType.None)
				{
					let amount = 0, childType = AbsType.None;
					for (let i of childIndexes[n])
					{
						if (sumType[i] == AbsType.None || sumAmount2[i] != null ||
							(childType != AbsType.None && sumType[i] != childType))
						{
							childType = AbsType.None;
							break;
						}
						childType = sumType[i];
						amount += sumAmount1[i];
					}

					if (childType != AbsType.None)
					{
						sumType[n] = childType;
						sumAmount1[n] = amount;
						modified = true;
					}
				}

				// if current type is an absolute unit, see if all-but-one of the children have that same type
				if (sumType[n] != AbsType.None && childIndexes[n].length >= 2)
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
						else if (sumAmount2[i] != null) {idxOne = -1; break;} // ranges disqualify
						else sum += sumAmount1[i];
					}

					if (idxOne >= 0)
					{
						sumType[idxOne] = sumType[n];
						sumAmount1[idxOne] = sumAmount1[n] - sum;
						modified = true;
					}
				}
			}

			if (!modified) break;
		}

		// now use derived absolute units to infer concentration-types
		for (let n = 0; n < origins.length; n++) if (sumType[n] != AbsType.None)
		{
			for (let i of childIndexes[n]) if (sumType[i] != AbsType.None)
			{
				let scale = 0, denom = sumAmount1[n], uri:string = null;
				if (sumType[i] == AbsType.Mass)
				{
					if (sumType[n] == AbsType.Mass) [scale, uri] = [100 / denom, StandardUnits.pcWW];
					else if (sumType[n] == AbsType.Volume) [scale, uri] = [100 / denom, StandardUnits.pcWV];
					else if (sumType[n] == AbsType.Moles) {}
				}
				else if (sumType[i] == AbsType.Volume)
				{
					if (sumType[n] == AbsType.Mass) {}
					else if (sumType[n] == AbsType.Volume) [scale, uri] = [100 / denom, StandardUnits.pcVV];
					else if (sumType[n] == AbsType.Moles) {}
				}
				else if (sumType[i] == AbsType.Moles)
				{
					if (sumType[n] == AbsType.Mass) {}
					else if (sumType[n] == AbsType.Volume) [scale, uri] = [1.0 / denom, StandardUnits.mol_L];
					else if (sumType[n] == AbsType.Moles) [scale, uri] = [100 / denom, StandardUnits.pcMM];
				}

				if (uri != null)
				{
					if (sumAmount2[i] == null)
					{
						this.notes[i].concQuantity = sumAmount1[i] * scale;
						this.notes[i].concError = sumError[i] == null ? null : sumError[i] * scale;
					}
					else
					{
						this.notes[i].concQuantity = [sumAmount1[i] * scale, sumAmount2[i] * scale];
					}
					this.notes[i].concUnits = Units.uriToName(uri);
					this.notes[i].concRelation = compList[n].relation;
				}
			}
		}
	}

	public findNote(origin:number[]):NormMixtureNote
	{
		for (let note of this.notes) if (Vec.equals(origin, note.origin)) return note;
		return null;
	}

	// ------------ private methods ------------

	// if the given molecule has stereogenic centres (i.e. wavy bonds), enumerate them explicitly
	private enumerateStereo(mol:Molecule):Molecule[]
	{
		let splitMolecule = (mol:Molecule):Molecule[] =>
		{
			for (let n = 1; n <= mol.numBonds; n++) if (mol.bondType(n) == Molecule.BONDTYPE_UNKNOWN)
			{
				let mol1 = mol.clone(), mol2 = mol.clone();
				if (mol.bondOrder(n) == 1)
				{
					// make up & down versions of the bond
					mol1.setBondType(n, Molecule.BONDTYPE_DECLINED);
					mol2.setBondType(n, Molecule.BONDTYPE_INCLINED);
					return [mol1, mol2];
				}
				else if (mol.bondOrder(n) == 2)
				{
					// for a cis/trans double bond, use the sketcher algorithm to rotate it; if the rotation is rejected,
					// it'll just return the input molecule, with the stereolabel removed
					let mol1 = mol.clone();
					mol1.setBondType(n, Molecule.BONDTYPE_NORMAL);

					let mol2:Molecule = null;
					if (!mol.bondInRing(n))
					{
						let state:SketchState = {mol: mol1, currentAtom: 0, currentBond: n, selectedMask: null};
						let activ = new MoleculeActivity(state, ActivityType.BondRotate, {});
						activ.execute();
						if (!activ.errmsg && activ.output.mol) mol2 = activ.output.mol;
					}
					return mol2 ? [mol1, mol2] : [mol1];
				}
			}
			return null;
		};

		let list:Molecule[] = [mol];
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

	// converts the units within the component to "absolute" form, at a singular scale; return is type followed by
	// quantity1, quantity2, error (to capture ranges & errors, where applicable)
	private toAbsoluteUnits(comp:MixfileComponent):[AbsType, number, number, number]
	{
		if (!comp.units || comp.quantity == null /*|| typeof comp.quantity != 'number'*/) return [AbsType.None, null, null, null];
		let uri = Units.nameToURI(comp.units);
		if (!uri) return [AbsType.None, null, null, null];

		let scale = 0, type = AbsType.None;

		if (uri == StandardUnits.kg) [scale, type] = [1E3, AbsType.Mass];
		else if (uri == StandardUnits.g) [scale, type] = [1, AbsType.Mass];
		else if (uri == StandardUnits.mg) [scale, type] = [1E-3, AbsType.Mass];
		else if (uri == StandardUnits.ug) [scale, type] = [1E-6, AbsType.Mass];
		else if (uri == StandardUnits.ng) [scale, type] = [1E-9, AbsType.Mass];
		else if (uri == StandardUnits.L) [scale, type] = [1, AbsType.Volume];
		else if (uri == StandardUnits.mL) [scale, type] = [1E-3, AbsType.Volume];
		else if (uri == StandardUnits.uL) [scale, type] = [1E-6, AbsType.Volume];
		else if (uri == StandardUnits.nL) [scale, type] = [1E-9, AbsType.Volume];
		else if (uri == StandardUnits.mol) [scale, type] = [1, AbsType.Moles];
		else if (uri == StandardUnits.mmol) [scale, type] = [1E-3, AbsType.Moles];
		else if (uri == StandardUnits.umol) [scale, type] = [1E-6, AbsType.Moles];
		else if (uri == StandardUnits.nmol) [scale, type] = [1E-9, AbsType.Moles];
		else return [AbsType.None, null, null, null];

		if (typeof comp.quantity == 'number')
		{
			let error = comp.error == null ? null : comp.error * scale;
			return [type, (comp.quantity as number) * scale, null, error];
		}
		else
		{
			let [lo, hi] = comp.quantity as number[];
			return [type, lo * scale, hi * scale, null];
		}
	}
}

