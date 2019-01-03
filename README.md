# Mixtures Project

Defines a file format for chemical mixtures (`Mixfile`) and an editor, based on the Electron framework.

## Mixfile

The *Mixfile* format is a simple JSON-based container that holds a hierarchy of chemical compounds, each of which is represented
by structure, name, quantity and any number of optional identifiers. The hierarchical form allows various degrees of complexity, e.g.
a single compound with a purity estimate, to a nested collection of mixtures-within-mixtures. The specification of quantities allows
various types of concentration units (e.g. percent, ratio, molarity), and also permits vagueness (e.g. error bars, ranges, inequalities, 
implied remainders and unknowns).

Because *Mixfile* mixtures are serialised using JSON (JavaScript Object Notation) they are incredibly easy to pack/unpack using any
modern programming language, and are also quite highly human readable. Structures are represented using the MDL Molfile format, which
is the ubiquitous industry standard.

The purpose of the *Mixfile* format is to capture the essential description of a mixture, from the point of view of its formation (i.e.
what went into it, rather than what it turns into once it reaches equilibrium). 

An example of a very simple *Mixfile* is thus:

```
{
    "mixfileVersion": 0.01,
    "name": "1.0M t-Butyllithium in Pentane",
    "contents": 
    [
        {
            "name": "t-butyllithium",
            "molfile": "\n\n\n  5  3  0  0  0  0  0  0  0  0999 V2000\n    0.0000    0.0000    0.0000 C   0  5  0  0  0  0  0  0  0  0  0  0\n    1.5000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n   -1.5000   -0.0000    0.0000 Li  0  3  0  0  0  0  0  0  0  0  0  0\n   -0.0000    1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    0.0000   -1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  1  4  1  0  0  0  0\n  1  5  1  0  0  0  0\nM  CHG  2   1  -1   3   1\nM  END",
            "quantity": 1.7,
            "units": "mol/L",
            "inchi": "InChI=1S/C4H9.Li/c1-4(2)3;/h1-3H3;/q-1;+1",
            "inchiKey": "InChIKey=UBJFKNSINUCEAL-UHFFFAOYSA-N"
        },
        {
            "name": "pentane",
            "molfile": "\n\n\n  5  4  0  0  0  0  0  0  0  0999 V2000\n    0.2010   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    1.5000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    2.7990   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    4.0981    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n    5.3971   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\n  2  3  1  0  0  0  0\n  3  4  1  0  0  0  0\n  4  5  1  0  0  0  0\nM  END",
            "inchi": "InChI=1S/C5H12/c1-3-5-4-2/h3-5H2,1-2H3",
            "inchiKey": "InChIKey=OFBQJSOFQDEBGM-UHFFFAOYSA-N"
        }
    ]
}
```

## MInChI

The code in this project allows *Mixfiles* to be used to generate *MInChI* notation. A *Mixfile* is intended to be a descriptive format that
errs on the side of capturing more information than is necessary (e.g. aesthetic sketches of the molecules, names and synonyms, database identifiers,
etc.). *MInChI* on the other hand is derive from the *InChI* algorithm, which is a canonical line identifer for a molecule. Turning a sketch into an identifier destroys a lot of information, but for many applications this is a good thing (e.g. easy comparison for equality, indexing in databases). The *MInChI* notation is the mixture derivative, which is handy for many of the same kinds of reasons.

## Codebase

The Mixture Editor, and the code used to manage *Mixfiles*, is all written in **TypeScript**. This is a layer on top of **JavaScript** which, as the
name suggests, adds typing. Long story short, this makes programming for the web platform a lot like coding in **Java**, which is a really good thing.

The deployment platform is **Electron**, which is a custom version of the *Chrome Browser* combined with the **NodeJS** libraries, which makes it
possible to write web-based apps that target the desktop, and have the full privileges of a native app. This means that the bulk of the codebase
can be used to drive a regular web page *or* run like a regular Windows/Linux/macOS app *or* be embedded on any other platform that has a JavaScript
rendering engine.

## Installation

Prior to trying to build this project, ensure that `npm` is installed (NodeJS Package Manager). Use it to install `electron`. Download the latest
version of *TypeScript* (`tsc`) from Microsoft. If you plan on viewing or editing the source code, *Visual Studio Code* is highly recommended.

The Mixture Editor has one major dependency: *WebMolKit*, which needs to be installed in a parallel directory, with that name. So:

* `${GIT}`
 * `Mixtures` --> [GitHub](https://github.com/cdd/mixtures)
 * `WebMolKit` --> [GitHub](https://github.com/aclarkxyz/web_molkit)

Compiling at the command line can be done simply with:

```
cd ${GIT}/Mixtures
tsc
```

The command line compiler reads the `tsconfig.json` file and pulls everything together. This will rebuild the file `app/mixfile.js`, which is
the cross-compiled destination JavaScript bundle.

An *Electron* app is essentially a collection of several files that turns an `index.html` file into a wrapper for a windowed desktop app. It
can be executed from the command line with:

```
electron app
```

## Web Embedding

The difference between an *Electron* app and a web page is that the former has access to a number of libraries from *NodeJS* which allow all
kinds of native functionality like window management, reading/writing local files, popping up a file open/save dialog, etc. If there is a
reasonable separation between code that does/does not use this functionality, it is possible to code for both target categories at once.

The Mixture Editor can be used on a regular web page, with a slightly different entry pathway. See the file `app/webdemo.html` for an example
of how to do this. It demonstrates an embedded mixture editor, which lacks certain functionality that is desktop specific (e.g. lookup of molecules,
running the InChI executable, saving to disk, etc.). It is also straightforward to invoke specific functions like loading and rendering of
mixtures for dynamic display on a page.