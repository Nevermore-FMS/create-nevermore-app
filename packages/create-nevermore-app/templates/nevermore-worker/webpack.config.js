const path = require('path');

module.exports = {
  entry: {
      worker: './worker/index.js',
      frontend: './widgets/index.jsx'
  },
  devtool: "eval-source-map",
  externals: {
    react: 'react',
  },
  externalsType: 'window',
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  stats: 'minimal'
};