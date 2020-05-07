/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../../WebMolKit/src/decl/corrections.d.ts'/>
///<reference path='../../../WebMolKit/src/decl/jquery.d.ts'/>
///<reference path='../../../WebMolKit/src/util/util.ts'/>
///<reference path='../../../WebMolKit/src/data/Molecule.ts'/>
///<reference path='../../../WebMolKit/src/data/MoleculeStream.ts'/>
///<reference path='../../../WebMolKit/src/data/MDLReader.ts'/>
///<reference path='../../../WebMolKit/src/data/MDLWriter.ts'/>
///<reference path='../../../WebMolKit/src/data/MolUtil.ts'/>
///<reference path='../../../WebMolKit/src/data/CoordUtil.ts'/>

///<reference path='../decl/node.d.ts'/>
///<reference path='../decl/electron.d.ts'/>
///<reference path='../startup.ts'/>

namespace Mixtures /* BOF */ {

/*
	Checks the supplied string to see if it is a CTAB (V2000/V3000) with features that make enumerable. If so,
	returns a list of molecules.
*/

interface ProtoMolecule
{
	mol:wmk.Molecule;
	attachAny:Map<number, number[]>; // bond -> list of atom indices
	stereoRacemic:number[][]; // blocks of atoms which are racemic
	stereoRelative:number[][]; // blocks of atoms which exist in their drawn configuration OR the opposite
	linkNodes:wmk.MDLReaderLinkNode[]; // so-called link nodes, aka repeating atom
	mixtures:wmk.MDLReaderGroupMixture[]; // mixture collections, which may overlap
}

export class ExtractCTABComponent
{
	public name:string = null;
	public molecules:wmk.Molecule[] = [];
			
	// ------------ public methods ------------

	constructor(private text:string)
	{
	}

	public extract():boolean
	{
		let ctab = new wmk.MDLMOLReader(this.text);
		try {ctab.parse();}
		catch (ex) {return null;}

		if (!ctab.mol) return false;

		let seed:Partial<ProtoMolecule> = {'mol': ctab.mol};
		if (ctab.groupAttachAny.size > 0) seed.attachAny = ctab.groupAttachAny;
		if (ctab.groupStereoRacemic.length > 0) seed.stereoRacemic = ctab.groupStereoRacemic;
		if (ctab.groupStereoRelative.length > 0) seed.stereoRelative = ctab.groupStereoRelative;
		if (ctab.groupLinkNodes.length > 0) seed.linkNodes = ctab.groupLinkNodes;
		if (ctab.groupMixtures.length > 0) seed.mixtures = ctab.groupMixtures;

		if (!seed.attachAny && !seed.stereoRacemic && !seed.stereoRelative &&
			!seed.linkNodes && !seed.mixtures) return false;

		const SANITY = 100; // stop enumerating after this many

		let prototypes:ProtoMolecule[] = [seed as ProtoMolecule];
		for (let n = 0; n < prototypes.length;)
		{
			let proto = prototypes[n];
			let list:ProtoMolecule[] = this.enumerateAttachAny(proto);
			if (!list) list = this.enumerateStereoRacemic(proto);
			if (!list) list = this.enumerateStereoRelative(proto);
			if (!list) list = this.enumerateLinkNodes(proto);
			if (!list) list = this.enumerateMixtures(proto);

			if (list)
			{
				prototypes[n] = list[0];
				for (let i = 1; i < list.length; i++) prototypes.splice(n + i, 0, list[i]);
			}
			else n++;

			if (prototypes.length > SANITY) break;
		}

		if (prototypes.length <= 1) return false;

		this.name = ctab.molName;
		this.molecules = prototypes.map((p) => p.mol);
		return true;
	}

	// ------------ private methods ------------

	private enumerateAttachAny(proto:ProtoMolecule):ProtoMolecule[]
	{
		return null;
	}

	// groups of racemic stereocentres: enumerate all combinations (2^group size)
	private enumerateStereoRacemic(proto:ProtoMolecule):ProtoMolecule[]
	{
		if (Vec.isBlank(proto.stereoRacemic)) return null;

		let blk = proto.stereoRacemic.shift();
		let mol = proto.mol;

		let affected = new Set<number>();
		for (let atom of blk) affected.add(atom);
		let bonds:number[] = [];
		for (let n = 1; n <= mol.numBonds; n++) if (affected.has(mol.bondFrom(n)) || affected.has(mol.bondTo(n)))
		{
			let bt = mol.bondType(n);
			if (bt == wmk.Molecule.BONDTYPE_INCLINED || bt == wmk.Molecule.BONDTYPE_DECLINED) bonds.push(n);
		}

		let nperm = Math.min(256, 1 << bonds.length);
		let list = [this.shallowClone(proto, mol)];
		for (let n = 1; n < nperm; n++)
		{
			let rmol = mol.clone();
			for (let i = 0, bitand = 1; i < bonds.length; i++)
			{
				if (n & bitand)
				{
					let bt = rmol.bondType(bonds[i]);
					bt = bt == wmk.Molecule.BONDTYPE_INCLINED ? wmk.Molecule.BONDTYPE_DECLINED : wmk.Molecule.BONDTYPE_INCLINED;
					rmol.setBondType(bonds[i], bt);
				}
				bitand = bitand << 1;
			}
			list.push(this.shallowClone(proto, rmol));
		}

		return list;
	}

	// relative stereocentres: add the original + the inversion for that group
	private enumerateStereoRelative(proto:ProtoMolecule):ProtoMolecule[]
	{
		if (Vec.isBlank(proto.stereoRelative)) return null;

		let blk = proto.stereoRelative.shift();
		let affected = new Set<number>();
		for (let atom of blk) affected.add(atom);

		let molinv = proto.mol.clone();
		for (let n = 1; n <= molinv.numBonds; n++) if (affected.has(molinv.bondFrom(n)) || affected.has(molinv.bondTo(n)))
		{
			let bt = molinv.bondType(n);
			if (bt == wmk.Molecule.BONDTYPE_INCLINED) molinv.setBondType(n, wmk.Molecule.BONDTYPE_DECLINED);
			else if (bt == wmk.Molecule.BONDTYPE_DECLINED) molinv.setBondType(n, wmk.Molecule.BONDTYPE_INCLINED);
		}

		return [proto, this.shallowClone(proto, molinv)];
	}
	private enumerateLinkNodes(proto:ProtoMolecule):ProtoMolecule[]
	{
		return null;
	}
	private enumerateMixtures(proto:ProtoMolecule):ProtoMolecule[]
	{
		return null;
	}

	private shallowClone(proto:ProtoMolecule, mol:wmk.Molecule):ProtoMolecule
	{
		let dup:ProtoMolecule =
		{
			'mol': mol,
			'attachAny': proto.attachAny,
			'stereoRacemic': proto.stereoRacemic,
			'stereoRelative': proto.stereoRelative,
			'linkNodes': proto.linkNodes,
			'mixtures': proto.mixtures,
		};
		return dup;
	}
}

/* EOF */ }