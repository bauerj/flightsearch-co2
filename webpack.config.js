const path = require('path')
const webpack = require('webpack')
const WebExtWebpackPlugin = require('webext-webpack-plugin').default
const CopyWebpackPlugin = require('copy-webpack-plugin');

if (process.env.API_USER && process.env.API_PASSWORD) {
  var secrets = {
    password: process.env.API_PASSWORD,
    username: process.env.API_USERNAME
  }
}
else {
  try {
    var secrets = require('./secrets.json')
  }
  catch (e) {
    var secrets = require('./secrets.example.json')
    console.log("WARNING: No API key defined in secrets.json. Using placeholder values.")
  }
}


module.exports = (env, argv) => {
  let config = {
    entry: {
      'content': './src/content.js',
      'background': './src/background.js'
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist')
    },
    plugins: [
      new webpack.DefinePlugin({
        'API_CONFIG': JSON.stringify(secrets)
    }),
    new CopyWebpackPlugin([
      {from: 'manifest.json', to: 'manifest.json'},
    ]),
    ]
  };
  if (env && env.debug) {
    config.plugins.push(
      new WebExtWebpackPlugin({ 
        sourceDir: path.resolve(__dirname),
        startUrl: ['https://google.com/flights']
      })
    )
  }
  return config
}