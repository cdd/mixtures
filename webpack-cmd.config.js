const path = require('path');

module.exports = 
{
	entry: './dist/index-cmd.ts',
	target: 'node',
	module: 
	{
		rules: 
		[
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: [
					/node_modules/,
					/src\/electron/,
				]
			},
			{test: /\.svg$/, loader: 'raw-loader'},
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
		filename: 'mixtures-cmd.js',
		library: 'Mixtures',
	},
	mode: 'production',
	devtool: 'source-map',
};