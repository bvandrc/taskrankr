'use strict';

const path = require('path');

const npmRunPath = (options = {}) => {
  const { cwd = process.cwd(), path: inputPath = process.env.PATH } = options;
  const parts = [];
  let current = cwd;
  while (true) {
    parts.push(path.join(current, 'node_modules', '.bin'));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return parts.concat(inputPath || '').join(path.delimiter);
};

const env = (options = {}) => {
  const { env: inputEnv = process.env } = options;
  const pathKey = Object.keys(inputEnv).find(k => k.toUpperCase() === 'PATH') || 'PATH';
  return { ...inputEnv, [pathKey]: npmRunPath({ ...options, path: inputEnv[pathKey] }) };
};

module.exports = npmRunPath;
module.exports.default = npmRunPath;
module.exports.env = env;
