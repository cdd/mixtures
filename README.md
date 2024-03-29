# Mixtures Project

Defines a file format for chemical mixtures (`Mixfile`) and an editor, based on the Electron framework.

## License

See the `LICENSE` file in the original repository. The contents of the GitHub repository ([here](https://github.com/cdd/mixtures))
is &copy; 2018-2019 Collaborative Drug Discovery, Inc., and made available to everyone else via the
[Gnu Public License v3](https://www.gnu.org/licenses/gpl-3.0.en.html).

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
etc.). *MInChI* on the other hand is derived from the *InChI* algorithm, which is a canonical line identifer for a molecule. Turning a sketch into an identifier destroys a lot of information, but for many applications this is a good thing (e.g. easy comparison for equality, indexing in databases). The *MInChI* notation is the mixture derivative, which is handy for many of the same kinds of reasons.

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

* `${GIT}/Mixtures` ⟵ [GitHub](https://github.com/cdd/mixtures)
* `${GIT}/WebMolKit` ⟵ [GitHub](https://github.com/aclarkxyz/web_molkit)

More recent versions of the project have additional NPM dependencies that are encoded into `package.json`. These are installed by:

```
npm i
```

This command creates a `node_modules` subdirectory and fills it with all the necessary packages. 

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

## Command Line

The project supports a console mode as well as interactive editing. This uses *NodeJS* as the executing environment. To run with no parameters and get a list of commands:

```
node app/console.js
```

The main command line feature is the ability to stream in a file containing mixtures, and stream out mixtures in some processed form. The following formats can be used for input _or_ output:

* `mixfile`: a JSON object formatted as a *Mixfile*
* `json`: a JSON array that contains some number of *Mixfile*-formatted objects
* `sdf`: an MDL SDfile with special fields that can be used to reconstruct hierarchy and concentration for mixtures

The following formats can only be used for output:

* `minchi`: the MInChI notation describing a mixture as a collection of InChI identifiers + metadata
* `longminchikey`: a hash form of MInChI notation which contains InChI keys for each of the structures
* `shortminchikey`: a hash form of MInChI notation which combines all of the structures into a single fixed-length string
* `svg`: Scalable Vector Graphics (SVG) picture, for rendering purposes

The console can use files or standard input/output as necessary. For files, the type is often implied by the suffix, but for stdin/stdout it must always be specified.

For example, converting an array of mixtures to the marked up SDfile format can be as done as either of:

```
node app/console.js -i mixtures.json -o mixtures.sdf
node app/console.js -i mixtures.json -if json -o mixtures.sdf -of sdf
```

If InChI generation is required, the location of the binary executable must be provided, e.g. to display the MInChI notation for a mixfile:

```
node app/console.js --inchi ~/bin/inchi-1 -i something.mixfile -of minchi
```

## SDfile Encoding

The _Mixfile_ format is designed for mixtures, but it is a new thing that is not backward compatible with any existing formats. It is possible to encode the primary mixture fields in an _SDfile_ with specific fields that must be present to define the mixture. An _SDfile_ normally encodes a number of distinct records, each of which has a structure and an arbitrary number of named fields with text values. Because a mixture usually has multiple components that may have their own structure, it is necessary to use multiple records per mixture.

Mixtures can be interconverted with _SDfiles_ such that they preserve the mixture hierarchy, and the name, structure and concentration for each component. Other properties of the _Mixfile_ do not presently survive the round trip. This formatting mode is intended as a precursor generation of MInChI notation, but it also has the advantage that it can be viewed with any ordinary _SDfile_ viewer, albeit not in mixture form.

To see an example of multiple mixtures encoded in this way, do:

```
node app/console.js -i play/collection.json -of sdf
```

The first mixture in the collection (butyllithium in pentane) is emitted as:

```

Generated by WebMolKit

  0  0  0  0  0  0  0  0  0  0999 V2000
M  END
> <Name>
1.0M t-Butyllithium in Pentane

> <MINCHI$N>
1

$$$$

Generated by WebMolKit

  5  3  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  5  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.5000    0.0000    0.0000 Li  0  3  0  0  0  0  0  0  0  0  0  0
    0.0000    1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000   -1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  4  1  0  0  0  0
  1  5  1  0  0  0  0
M  CHG  2   1  -1   3   1
M  END
> <Name>
t-butyllithium

> <MINCHI$N>
1.1

> <MINCHI$C>
17mr-1

$$$$

Generated by WebMolKit

  5  4  0  0  0  0  0  0  0  0999 V2000
    0.2010   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.7990   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    4.0981    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    5.3971   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  3  4  1  0  0  0  0
  4  5  1  0  0  0  0
M  END
> <Name>
pentane

> <MINCHI$N>
1.2

$$$$
```

The mixture hierarchy has 3 components, so there are 3 records emitted to the _SDfile_. Blank molecules are used to denote a component with no structure. Three additional fields are present where applicable:

* `Name`: component name (when available)
* `MINCHI$N`: the hierarchy position of the component (always present)
* `MINCHI$C`: the concentration information formatted according to MInChI notation rules (when available)

The hierarchy position (`MINCHI$N`) is always `1` for the first component of mixture. Parsing these _SDfiles_ involves reading multiple rows and putting them together as a single mixture. Whenever a hierarchy value of `1` is encountered, it means the previous mixture is complete, and that this record is part of a new one. The format of the value is a list of 1-based indexes joined by a dot. The example shown emits the root node as position `1`, the active ingredient as `1.1` and the solvent as `1.2`, which corresponds to the layout of the mixture. Further nesting is indicated by more dots (e.g. `1.1.1` etc.)

When the root node of a mixture is blank (has no name, structure or concentration associated with it) then the root node itself can optionally be omitted: its immediate descendents are indicated with hierarchy positions of `1`, `2`, etc., rather than `1.1`, `1.2` etc. as they would have been if the root node has been included explicitly. So the butyl lithium example with its root left out would be emitted as:

```

Generated by WebMolKit

  5  3  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  5  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.5000    0.0000    0.0000 Li  0  3  0  0  0  0  0  0  0  0  0  0
    0.0000    1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000   -1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  4  1  0  0  0  0
  1  5  1  0  0  0  0
M  CHG  2   1  -1   3   1
M  END
> <Name>
t-butyllithium

> <MINCHI$N>
1

> <MINCHI$C>
17mr-1

$$$$

Generated by WebMolKit

  5  4  0  0  0  0  0  0  0  0999 V2000
    0.2010   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.5000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.7990   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    4.0981    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    5.3971   -0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  3  4  1  0  0  0  0
  4  5  1  0  0  0  0
M  END
> <Name>
pentane

> <MINCHI$N>
2

$$$$
```

## Reference Data

Several examples of handcrafted *Mixfiles* are `play` directory (e.g. `mixture1.mixfile`, etc.). To view these, run the app and use File|Open.

In the `reference` directory is a file named `gathering.zip`, which contains a lot of mixtures:

```
Archive:  reference/gathering.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
     3346  10-18-2018 21:47   training000001.mixfile
     3838  10-18-2018 21:47   training000002.mixfile
     3021  10-18-2018 21:47   training000003.mixfile
     3222  10-18-2018 21:47   training000004.mixfile
     9088  10-18-2018 21:47   training000005.mixfile
     9069  10-18-2018 21:47   training000006.mixfile
     3986  10-18-2018 21:47   training000007.mixfile
     4526  10-18-2018 21:47   training000008.mixfile
     4960  10-18-2018 21:47   training000009.mixfile
     5281  10-18-2018 21:47   training000010.mixfile
...
      951  10-18-2018 21:49   training005613.mixfile
     1036  10-18-2018 21:49   training005614.mixfile
      987  10-18-2018 21:49   training005615.mixfile
---------                     -------
 10671859                     5615 files
```

These originate from a text extraction project, which is itself not open source. This particular output data, though, is part of the
open source package, and may be used for various purposes.
