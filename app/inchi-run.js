import createRuntime from './inchi.js';

// Workaround until emscripten support for ES6 modules improves
const browswerWasmDirectory = '/build/';
const runtime = createRuntime({
  locateFile: (path, scriptDirectory) => {
    return `${scriptDirectory || browswerWasmDirectory}${path}`;
  }
});

const {allocate, intArrayFromString, ALLOC_NORMAL, _malloc, _free, UTF8ToString} = runtime;

function molfileToInChI(molfile, options)
{
	return new Promise((resolve, reject) => 
	{
		runtime.then(
			() => 
			{
				const c_molfile = stringPointer(molfile);
				const c_options = stringPointer(options);
				const buffer = _malloc(BUFFER_SIZE);

				runtime._molfile_to_inchi(c_molfile, c_options, buffer, BUFFER_SIZE);

				const result = UTF8ToString(buffer, BUFFER_SIZE);

				_free(molfile);
				_free(options);
				_free(buffer);

				resolve(result);
			},
			(reason) => reject(reason));
	});
};

const stringPointer = (string) => 
{
	return allocate(intArrayFromString(string), 'i8', ALLOC_NORMAL);
};

const BUFFER_SIZE = 1024;

export default molfileToInChI;
