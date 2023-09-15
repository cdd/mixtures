/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	Checks the supplied string to see if it is a CTAB (V2000/V3000) with features that make enumerable. If so,
	returns a list of molecules.
*/

interface ProtoMolecule
{
	mol:wmk.Molecule;
	children:ProtoMolecule[];
	attachAny:Map<number, number[]>; // bond -> list of atom indices
	stereoRacemic:number[][]; // blocks of atoms which are racemic
	stereoRelative:number[][]; // blocks of atoms which exist in their drawn configuration OR the opposite
	linkNodes:wmk.MDLReaderLinkNode[]; // so-called link nodes, aka repeating atom
	mixtures:wmk.MDLReaderGroupMixture[]; // mixture collections, which may overlap
}

export class ExtractCTABComponent
{
	// ------------ public methods ------------

	constructor(private text:string)
	{
	}

	// returns a component instance if and only when the underlying CTAB has something mixture-esque; if it's not a molecule,
	// or is just a plain ordinary single molecule, returns null
	public extract():MixfileComponent
	{
		let ctab = new wmk.MDLMOLReader(this.text);
		try {ctab.parse();}
		catch (ex) {return null;}

		if (!ctab.mol) return null;

		let seed:Partial<ProtoMolecule> = {mol: ctab.mol};
		if (ctab.groupAttachAny.size > 0) seed.attachAny = ctab.groupAttachAny;
		if (ctab.groupStereoRacemic.length > 0) seed.stereoRacemic = ctab.groupStereoRacemic;
		if (ctab.groupStereoRelative.length > 0) seed.stereoRelative = ctab.groupStereoRelative;
		if (ctab.groupLinkNodes.length > 0) seed.linkNodes = ctab.groupLinkNodes;
		if (ctab.groupMixtures.length > 0) seed.mixtures = ctab.groupMixtures;

		if (!seed.attachAny && !seed.stereoRacemic && !seed.stereoRelative &&
			!seed.linkNodes && !seed.mixtures) return null;

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

		if (prototypes.length == 0) return null;
		if (prototypes.length == 1 && Vec.isBlank(prototypes[0].children)) return null;

		let emit = (comp:MixfileComponent, proto:ProtoMolecule):void =>
		{
			let subComp:MixfileComponent = {};
			if (proto.mol) subComp.molfile = new wmk.MDLMOLWriter(proto.mol).write();
			comp.contents.push(subComp);
			if (proto.children)
			{
				subComp.contents = [];
				for (let child of proto.children) emit(subComp, child);
			}
		};

		let comp:MixfileComponent = {contents: []};
		if (ctab.molName) comp.name = ctab.molName;
		for (let proto of prototypes) emit(comp, proto);

		return comp;
	}

	// ------------ private methods ------------

	private enumerateAttachAny(proto:ProtoMolecule):ProtoMolecule[]
	{
		if (!proto.attachAny) return null;
		let bond:number = null;
		for (let look of proto.attachAny.keys()) {bond = look; break;}
		if (bond == null) return null;
		let atoms = proto.attachAny.get(bond);
		proto.attachAny.delete(bond);
		if (Vec.isBlank(atoms)) return null;

		let mol = proto.mol;
		let atomKeep = mol.bondFrom(bond), atomChop = mol.bondTo(bond);
		if (mol.atomElement(atomChop) == '*') {}
		else if (mol.atomElement(atomKeep) == '*') [atomKeep, atomChop] = [atomChop, atomKeep];
		else if (mol.atomAdjCount(atomKeep) < mol.atomAdjCount(atomChop)) [atomKeep, atomChop] = [atomChop, atomKeep];

		// update the baseline prototype in lieu of the atom sacrificial atom getting deleted
		for (let look of proto.attachAny.keys()) this.removeAtom(proto.attachAny.get(look), atomChop);
		if (proto.stereoRelative) for (let look of proto.stereoRelative) this.removeAtom(look, atomChop);
		if (proto.stereoRacemic) for (let look of proto.stereoRacemic) this.removeAtom(look, atomChop);
		if (proto.linkNodes) for (let n = proto.linkNodes.length - 1; n >= 0; n--)
		{
			if (proto.linkNodes[n].atom == atomChop) {proto.linkNodes.splice(n, 1); continue;}
			if (proto.linkNodes[n].atom > atomChop) proto.linkNodes[n].atom--;
			this.removeAtom(proto.linkNodes[n].nbrs, atomChop);
		}
		if (proto.mixtures) for (let look of proto.mixtures) this.removeAtom(look.atoms, atomChop);

		let list:ProtoMolecule[] = [];
		for (let connAtom of atoms)
		{
			let cmol = mol.clone();
			if (atomChop == cmol.bondFrom(bond)) cmol.setBondFrom(bond, connAtom); else cmol.setBondTo(bond, connAtom);
			cmol.deleteAtomAndBonds(atomChop);
			// TODO: ideally a little redepiction of the connecting bond would be in order, but the connectivity is right, and
			// in most cases it will be possible to see what it is
			list.push(this.protoClone(proto, cmol));
		}

		return list;
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
		let list = [this.protoClone(proto, mol)];
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
			list.push(this.protoClone(proto, rmol));
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

		return [proto, this.protoClone(proto, molinv)];
	}
	private enumerateLinkNodes(proto:ProtoMolecule):ProtoMolecule[]
	{
		if (Vec.isBlank(proto.linkNodes)) return null;

		let link = proto.linkNodes.shift();

		let mol = proto.mol, a1 = link.atom;
		let nbr1 = link.nbrs.length >= 1 ? link.nbrs[0] : 0;

		let list:ProtoMolecule[] = [];
		for (let n = link.minRep; n <= link.maxRep; n++)
		{
			if (n == 1)
			{
				list.push(this.protoClone(proto, mol));
				continue;
			}

			let rmol = mol.clone();
			let addedAtoms:number[] = [];
			for (let i = 2; i <= n; i++)
			{
				let a2 = rmol.addAtom(rmol.atomElement(a1), rmol.atomX(a1), rmol.atomY(a1));
				rmol.setAtomCharge(a2, rmol.atomCharge(a1));
				rmol.setAtomUnpaired(a2, rmol.atomUnpaired(a2));
				rmol.addBond(a1, a2, 1);
				if (nbr1 > 0)
				{
					let a3 = 0;
					for (let adj of rmol.atomAdjList(a1)) if (adj != a2 && adj != nbr1) {a3 = adj; break;}
					if (a3 > 0)
					{
						let b = rmol.findBond(a1, a3);
						if (rmol.bondFrom(b) == a1) rmol.setBondFrom(b, a2); else rmol.setBondTo(b, a2);
					}
				}
				addedAtoms.push(a1);
			}
			// TODO: depiction would be nice; the atoms are just overlayed on top of each other

			let rproto = this.protoClone(proto, rmol);
			if (rproto.mixtures) for (let mix of rproto.mixtures)
			{
				if (mix.atoms.includes(a1)) mix.atoms.push(...addedAtoms);
			}
			list.push(rproto);
		}

		return list;
	}
	private enumerateMixtures(proto:ProtoMolecule):ProtoMolecule[]
	{
		if (Vec.isBlank(proto.mixtures)) return null;

		// NOTE: currently assuming that this enumeration step happens last, and is done in one fell swoop; the protomolecule hierarchy
		// that gets returned discards any remaining enumeration materials

		let mol = proto.mol, mixtures = proto.mixtures;

		let identity = mixtures.map((mix) => mix.index);
		let leafmask = Vec.booleanArray(true, mixtures.length);
		for (let mix of mixtures) if (mix.parent > 0)
		{
			let i = identity.indexOf(mix.parent);
			if (i >= 0) leafmask[i] = false;
		}

		let root = {children: []} as ProtoMolecule;
		let mapTree = new Map<number, ProtoMolecule>();
		mapTree.set(0, root);
		while (true)
		{
			let anything = false;
			for (let n = 0; n < mixtures.length; n++) if (!leafmask[n] && !mapTree.has(mixtures[n].index))
			{
				let parent = mapTree.get(mixtures[n].parent);
				if (!parent) continue;
				let node = {children: []} as ProtoMolecule;
				parent.children.push(node);
				mapTree.set(mixtures[n].index, node);
				anything = true;
			}
			if (!anything) break;
		}

		let nonemask = Vec.booleanArray(true, mol.numAtoms); // atoms not mentioned in any mixture block
		for (let mix of mixtures) for (let a of mix.atoms) nonemask[a - 1] = false;

		for (let n = 0; n < mixtures.length; n++) if (leafmask[n])
		{
			let atommask = nonemask.slice(0);
			for (let a of mixtures[n].atoms) atommask[a - 1] = true;

			let mixmol = wmk.MolUtil.subgraphMask(mol, atommask);
			let node = {mol: mixmol} as ProtoMolecule;
			mapTree.get(mixtures[n].parent).children.push(node);
		}

		if (root.children.length == 1) root = root.children[0];
		return root.children;
	}

	// makes a copy of the prototype's fields, and copies over the replacement molecule
	private protoClone(proto:ProtoMolecule, mol:wmk.Molecule):ProtoMolecule
	{
		let dup:ProtoMolecule =
		{
			'mol': mol,
			'children': [],
			'attachAny': proto.attachAny ? new Map(proto.attachAny) : null,
			'stereoRacemic': deepClone(proto.stereoRacemic),
			'stereoRelative': deepClone(proto.stereoRelative),
			'linkNodes': deepClone(proto.linkNodes),
			'mixtures': deepClone(proto.mixtures),
		};
		return dup;
	}

	// updates a list given that a certain atom has been deleted: decrements or removes any atoms that are affected
	private removeAtom(list:number[], atom:number):void
	{
		for (let n = list.length - 1; n >= 0; n--)
		{
			if (list[n] == atom) list.splice(n, 1);
			else if (list[n] > atom) list[n]--;
		}
	}
}

/* EOF */ }