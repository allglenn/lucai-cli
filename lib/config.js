const fs = require('fs');
const path = require('path');
const os = require('os');

const configDir = path.join(os.homedir(), '.lucai');
const configFile = path.join(configDir, 'config.json');

function ensureConfigDirExists() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function saveConfig(config) {
  ensureConfigDirExists();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

function loadConfig() {
  if (!fs.existsSync(configFile)) {
    return { provider: 'openai', keys: {} };
  }
  try {
    const configData = fs.readFileSync(configFile, 'utf-8');
    const config = JSON.parse(configData);
    if (!config.provider) {
      config.provider = 'openai'; // Set default provider if missing
    }
    return config;
  } catch (error) {
    console.error('Error reading or parsing config file. Using default config.', error);
    return { provider: 'openai', keys: {} };
  }
}

function setConfig(provider, key) {
  const config = loadConfig();
  config.provider = provider;
  if (!config.keys) {
    config.keys = {};
  }
  config.keys[provider] = key;
  saveConfig(config);
}

function getApiKey(provider) {
  const config = loadConfig();
  const envVar = provider === 'openai' ? 'OPENAI_API_KEY' : 'GOOGLE_API_KEY';
  return (config.keys && config.keys[provider]) || process.env[envVar];
}

function getConfig() {
  return loadConfig();
}

module.exports = {
  setConfig,
  getApiKey,
  getConfig,
  loadConfig,
  saveConfig,
  ensureConfigDirExists,
}; 