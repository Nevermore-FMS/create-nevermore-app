const path = require('path');

module.exports = {
  entry: {
      plugin: './plugin/index.js',
      frontend: './frontend/index.jsx'
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