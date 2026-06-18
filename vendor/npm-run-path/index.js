'use strict';
function npmRunPath({ path = process.env.PATH } = {}) {
  return path;
}
function env({ env: envOption = process.env, ...opts } = {}) {
  return { ...envOption, PATH: npmRunPath({ ...opts, path: envOption.PATH }) };
}
module.exports = npmRunPath;
module.exports.npmRunPath = npmRunPath;
module.exports.env = env;
