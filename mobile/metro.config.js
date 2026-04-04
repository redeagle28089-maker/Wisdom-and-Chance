const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(monorepoRoot, "shared"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.extraNodeModules = new Proxy(
  { "@shared": path.resolve(monorepoRoot, "shared") },
  {
    get: (target, name) => {
      if (name in target) return target[name];
      const localModule = path.join(projectRoot, "node_modules", String(name));
      try {
        require("fs").statSync(localModule);
        return localModule;
      } catch {}
      return path.join(monorepoRoot, "node_modules", String(name));
    },
  }
);

module.exports = config;
