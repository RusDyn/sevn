// ESLint configuration is now at the workspace root (eslint.config.js)
// This file exists for backwards compatibility with the package exports
const path = require('path');

module.exports = require(path.join(__dirname, '../../eslint.config.js'));
