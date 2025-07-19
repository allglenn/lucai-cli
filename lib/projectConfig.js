const fs = require('fs');
const path = require('path');

function findProjectRoot(startDir) {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function loadProjectConfig() {
  const projectRoot = findProjectRoot(process.cwd());
  if (!projectRoot) {
    return {};
  }

  const configFile = path.join(projectRoot, '.lucai.json');
  if (!fs.existsSync(configFile)) {
    return {};
  }

  try {
    const configData = fs.readFileSync(configFile, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error reading or parsing .lucai.json file.', error);
    return {};
  }
}

module.exports = {
  loadProjectConfig,
};
