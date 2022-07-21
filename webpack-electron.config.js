const path = require('path');

module.exports = 
{
	entry: './dist/index-electron.ts',
	module: 
	{
		rules: 
		[
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
		],
	},
	resolve: 
	{
		extensions: ['.ts', '.js'],
	},
	output: 
	{
		path: path.resolve(__dirname, 'app'),
		filename: 'mixtures-electron.js',
		sourceMapFilename: 'mixtures-electron.js.map',
		library: 'Mixtures',
	},
	mode: 'development',
	target: 'electron-main',
};