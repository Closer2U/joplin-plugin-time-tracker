const path = require('path');

const rootDir = path.resolve(__dirname);

module.exports = {
  mode: 'production',
  target: 'node',
  stats: 'errors-only',
  entry: './src/index.ts',
  output: {
    filename: 'index.js',
    path: path.resolve(rootDir, 'dist'),
  },
  resolve: {
    // CRITICAL: api resolves to the local shim that references the joplin global
    alias: {
      api: path.resolve(rootDir, 'api'),
    },
    extensions: ['.js', '.tsx', '.ts', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  // No externals — js-yaml gets bundled, api is resolved via alias
};
