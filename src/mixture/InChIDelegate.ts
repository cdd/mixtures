/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

import {Molecule} from 'webmolkit/data/Molecule';

export interface InChIResult
{
	inchi:string;
	inchiKey:string;
}

export abstract class InChIDelegate
{
	public async generate(mol:Molecule):Promise<InChIResult>
	{
		throw new Error('InChI not implemented.');
	};
}