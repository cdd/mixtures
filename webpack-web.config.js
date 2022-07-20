const path = require('path');

module.exports = 
{
	entry: './dist/index-web.ts',
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
		filename: 'mixtures-web.js',
		sourceMapFilename: 'mixtures.map',
		library: 'Mixtures',
	},
	mode: 'development',
	target: 'node',
};