const path = require('path');

module.exports = 
{
	entry: './dist/index-src.ts',
	target: 'electron-main',
	module: 
	{
		rules: 
		[
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
			{test: /\.svg$/, loader: 'raw-loader'},
			{test: /\.ds$/, loader: 'raw-loader'},
			{test: /\.onto$/, loader: 'raw-loader'},
		],
	},
	resolve: 
	{
		extensions: ['.ts', '.js'],
	},
	performance: 
	{
		hints: false,
		maxEntrypointSize: 512000,
		maxAssetSize: 512000
	},
	output: 
	{
		path: path.resolve(__dirname, 'app'),
		filename: 'mixtures.js',
		library: 'Mixtures',
	},
	mode: 'production',
	devtool: 'source-map',
};