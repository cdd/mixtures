/*
    Mixfile Editor & Viewing Libraries

    (c) 2017-2020 Collaborative Drug Discovery, Inc

    All rights reserved

    http://collaborativedrug.com

	Made available under the Gnu Public License v3.0
*/

///<reference path='../../WebMolKit/src/util/Vec.ts'/>

// NOTE: imports need to go before we start defining our own stuff, otherwise transpiler order sometimes breaks
import wmk = WebMolKit;
import Vec = WebMolKit.Vec;
import pixelDensity = WebMolKit.pixelDensity;
import drawLine = WebMolKit.drawLine;
import escapeHTML = WebMolKit.escapeHTML;
import pathRoundedRect = WebMolKit.pathRoundedRect;
import eventCoords = WebMolKit.eventCoords;
import clone = WebMolKit.clone;
import deepClone = WebMolKit.deepClone;
import orBlank = WebMolKit.orBlank;
import blendRGB = WebMolKit.blendRGB;
import colourCode = WebMolKit.colourCode;
import TWOPI = WebMolKit.TWOPI;
import norm_xy = WebMolKit.norm_xy; // eslint-disable-line
import newElement = WebMolKit.newElement;

///<reference path='../decl/node.d.ts'/>
