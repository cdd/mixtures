/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2021 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

namespace Mixtures /* BOF */ {

/*
	Try to arrange a list of boxes into a more rectangular pattern, which has a better ratio than stacking everything vertically.
*/

enum SquarePackingSpring
{
	Strong = 0,
	Medium = 1,
	Weak = 2,
}

interface SquarePackingCandidate
{
	idxStart:number;
	springs:SquarePackingSpring[];
	layout?:wmk.Box[];
	outline?:wmk.Size;
	score?:number; // lower is better
	hash?:string;
}

interface SquarePackingSegment
{
	y:number;
	x1:number;
	x2:number;
}

export class SquarePacking
{
	public outline:wmk.Size;
	public layout:wmk.Box[] = null;

	private wantRatio:number;

	// --------------------- public methods ---------------------

	// sets up the object with the mandatory information
	constructor(private packSize:wmk.Size, private boxes:wmk.Box[], private hspace:number, private vspace:number)
	{
		this.wantRatio = packSize.w / packSize.h;

		/*
		// !! temporary validation
		let segs:SquarePackingSegment[] =
		[
			{'y': 0, 'x1': 0, 'x2': 1},
			{'y': 2, 'x1': 1, 'x2': 3},
			{'y': 1, 'x1': 3, 'x2': Number.POSITIVE_INFINITY}
		];
		this.mergeSegmentAbove(segs, {'y': 2.5, 'x1': 1.5, 'x2': 2.5});
		//this.mergeSegmentBelow(segs, {'y': -1.5, 'x1': 2, 'x2': 3.5});
		for (let seg of segs) console.log(JSON.stringify(seg));
		throw 'blork';*/
	}

	// carries out the arrangement: returns whether it got something good
	public pack():boolean
	{
		let candidates:SquarePackingCandidate[] = [];
		let num = this.boxes.length;
		for (let n = 0; n < num; n++)
		{
			let cand:SquarePackingCandidate = {'idxStart': n, 'springs': Vec.anyArray(SquarePackingSpring.Weak, num)};
			cand.hash = cand.idxStart + '/' + cand.springs;
			this.processCandidate(cand);
			candidates.push(cand);
		}

		const KEEP = 100;
		candidates = candidates.sort((c1, c2) => c1.score - c2.score).slice(0, KEEP);

		for (let sanity = 100; sanity > 0; sanity--)
		{
			let hashes = new Set<string>();
			for (let cand of candidates) hashes.add(cand.hash);

			let batch = candidates.slice(0);
			for (let cand of candidates) for (let n = 0; n < num; n++) if (n != cand.idxStart)
			{
				for (let sp of [SquarePackingSpring.Strong, SquarePackingSpring.Medium, SquarePackingSpring.Weak]) if (cand.springs[n] != sp)
				{
					let mod:SquarePackingCandidate = {'idxStart': cand.idxStart, 'springs': cand.springs.slice(0)};
					mod.springs[n] = sp;
					mod.hash = mod.idxStart + '/' + mod.springs;
					if (hashes.has(mod.hash)) continue;
					this.processCandidate(mod);
					batch.push(mod);
				}
			}

			batch = batch.sort((c1, c2) => c1.score - c2.score).slice(0, KEEP);

			let same = true;
			for (let n = 0; n < candidates.length && n < batch.length; n++) if (candidates[n].hash != batch[n].hash) {same = false; break;}

			if (!same) break;

			candidates = batch;
		}

		let best = candidates[0];

		this.outline = best.outline;
		this.layout = best.layout;
		let minY = this.layout[0].y;
		for (let box of this.layout) box.y -= minY;

		return true;
	}

	// --------------------- private methods ---------------------

	private processCandidate(cand:SquarePackingCandidate):void
	{
		let len = this.boxes.length;
		cand.layout = this.boxes.map((box) => new wmk.Box(0, 0, box.w, box.h));
		let placed = Vec.booleanArray(false, len);
		placed[cand.idxStart] = true;

		let placeAbove = (idx:number, spring:SquarePackingSpring):void =>
		{
			let box = cand.layout[idx];
			let segs:SquarePackingSegment[] = null;
			for (let n = idx + 1; n < len; n++) if (placed[n])
			{
				let ref = cand.layout[n];
				let newsegs:SquarePackingSegment[] = [];
				if (ref.minX() > 0) newsegs.push({'y': ref.midY() - this.vspace, 'x1': 0, 'x2': ref.minX() - this.hspace});
				newsegs.push({'y': ref.minY() - this.vspace, 'x1': Math.max(0, ref.minX() - this.hspace), 'x2': ref.maxX() + this.hspace});
				newsegs.push({'y': ref.minY() - this.vspace + 0.5 * box.h, 'x1': ref.maxX() + this.hspace, 'x2': Number.POSITIVE_INFINITY});
				if (segs == null) segs = newsegs;
				else for (let nseg of newsegs) this.mergeSegmentAbove(segs, nseg);
			}

			let bestX = 0, bestY = Number.NEGATIVE_INFINITY;
			for (let n = 0; n < segs.length; n++)
			{
				let x = segs[n].x1, y = Number.POSITIVE_INFINITY;
				for (let i = n; i < segs.length; i++)
				{
					y = Math.min(y, segs[i].y);
					if (box.w < segs[i].x2 - x) break;
				}
				if (y > bestY) [bestX, bestY] = [x, y];
				if (spring == SquarePackingSpring.Strong) break;
				if (spring == SquarePackingSpring.Medium && x > 0.5 * this.packSize.w) break;
			}
			box.x = bestX;
			box.y = bestY - box.h;
			placed[idx] = true;
		};
		let placeBelow = (idx:number, spring:SquarePackingSpring):void =>
		{
			let box = cand.layout[idx];
			let segs:SquarePackingSegment[] = null;
			for (let n = idx - 1; n >= 0; n--) if (placed[n])
			{
				let ref = cand.layout[n];
				let newsegs:SquarePackingSegment[] = [];
				if (ref.minX() > 0) newsegs.push({'y': ref.midY() + this.vspace, 'x1': 0, 'x2': ref.minX() - this.hspace});
				newsegs.push({'y': ref.maxY() + this.vspace, 'x1': Math.max(0, ref.minX() - this.hspace), 'x2': ref.maxX() + this.hspace});
				newsegs.push({'y': ref.maxY() + this.vspace - 0.5 * box.h, 'x1': ref.maxX() + this.hspace, 'x2': Number.POSITIVE_INFINITY});
				if (segs == null) segs = newsegs;
				else for (let nseg of newsegs) this.mergeSegmentBelow(segs, nseg);
			}

			let bestX = 0, bestY = Number.POSITIVE_INFINITY;
			for (let n = 0; n < segs.length; n++)
			{
				let x = segs[n].x1, y = Number.NEGATIVE_INFINITY;
				for (let i = n; i < segs.length; i++)
				{
					y = Math.max(y, segs[i].y);
					if (box.w < segs[i].x2 - x) break;
				}
				if (y < bestY) [bestX, bestY] = [x, y];
				if (spring == SquarePackingSpring.Strong) break;
				if (spring == SquarePackingSpring.Medium && x > 0.5 * this.packSize.w) break;
			}
			box.x = bestX;
			box.y = bestY;
			placed[idx] = true;
		};

		for (let d = 1; d < len; d++)
		{
			let i1 = cand.idxStart - d, i2 = cand.idxStart + d;
			if (i1 >= 0) placeAbove(i1, cand.springs[i1]);
			if (i2 < len) placeBelow(i2, cand.springs[i2]);
		}

		let loX = 0, hiX = Vec.max(cand.layout.map((box) => box.maxX()));
		let loY = Vec.min(cand.layout.map((box) => box.minY())), hiY = Vec.max(cand.layout.map((box) => box.maxY()));
		cand.outline = new wmk.Size(hiX - loX, hiY - loY);
		let ratio = cand.outline.w / cand.outline.h;
		cand.score = Math.abs(ratio - this.wantRatio) * (cand.outline.w + cand.outline.h) + Vec.sum((cand.layout.map((box) => box.x)));
	}

	private mergeSegmentAbove(segs:SquarePackingSegment[], merge:SquarePackingSegment):void
	{
		for (let look of segs)
		{
			if (merge.x1 >= look.x1 && merge.x1 <= look.x2 && merge.x2 >= look.x1 && merge.x2 <= look.x2)
			{
				if (merge.y > look.y) return; // completely buried
				segs.push({'y': look.y, 'x1': merge.x2, 'x2': look.x2});
				look.x2 = merge.x1;
				break;
			}
			if (merge.x1 >= look.x1 && merge.x1 <= look.x2)
			{
				if (merge.y < look.y) look.x2 = merge.x1; else merge.x1 = look.x2;
			}
			if (merge.x2 >= look.x1 && merge.x2 <= look.x2)
			{
				if (merge.y < look.y) look.x1 = merge.x2; else merge.x2 = look.x1;
			}
		}
		for (let n = segs.length - 1; n >= 0; n--) if (segs[n].x1 >= segs[n].x2) segs.splice(n, 1);
		if (merge.x1 < merge.x2)
		{
			segs.push(merge);
			segs.sort((seg1, seg2) => seg1.x1 - seg2.x1);
		}
	}
	private mergeSegmentBelow(segs:SquarePackingSegment[], merge:SquarePackingSegment):void
	{
		for (let look of segs)
		{
			if (merge.x1 >= look.x1 && merge.x1 <= look.x2 && merge.x2 >= look.x1 && merge.x2 <= look.x2)
			{
				if (merge.y < look.y) return; // completely buried
				segs.push({'y': look.y, 'x1': merge.x2, 'x2': look.x2});
				look.x2 = merge.x1;
				break;
			}
			if (merge.x1 >= look.x1 && merge.x1 <= look.x2)
			{
				if (merge.y > look.y) look.x2 = merge.x1; else merge.x1 = look.x2;
			}
			if (merge.x2 >= look.x1 && merge.x2 <= look.x2)
			{
				if (merge.y > look.y) look.x1 = merge.x2; else merge.x2 = look.x1;
			}
		}
		for (let n = segs.length - 1; n >= 0; n--) if (segs[n].x1 >= segs[n].x2) segs.splice(n, 1);
		if (merge.x1 < merge.x2)
		{
			segs.push(merge);
			segs.sort((seg1, seg2) => seg1.x1 - seg2.x1);
		}
	}
}

/* EOF */ }