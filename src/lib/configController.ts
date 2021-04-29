import { config } from "cli-ux";
import * as fs from "fs";
import * as path from "path";
import Daemon from "./daemon";
import Utils from "./utils";

export default class ConfigController {
  private static _configPath = "~/.ipmm/config.json";
  private static _configFile: ConfigFile;

  private static get configPath(): string {
    return Utils.resolveHome(ConfigController._configPath);
  }

  private static loadConfig = (): ConfigFile => {
    let configPath = ConfigController.configPath;

    if (fs.existsSync(configPath)) {
      //console.log("No config file exists at " + configPath);
      let data = JSON.parse(fs.readFileSync(configPath, "utf8"));
      let config: ConfigFile = {
        ipmmRepo: data.ipmmRepo,
        foamRepo: data.foamRepo,
      };

      ConfigController._configFile = config;
      return config;
    } else {
      let config: ConfigFile = {
        ipmmRepo: "",
        foamRepo: "",
      };
      return config;
    }
  };

  private static saveConfig = (config: ConfigController): void => {
    let configPath = ConfigController.configPath;
    if (!fs.existsSync(configPath)) {
      console.log("No config file exist, creating new file at " + configPath);
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config));
    console.log(JSON.stringify(config));
  };

  static get config(): ConfigFile {
    if (ConfigController._configFile) {
      return ConfigController._configFile;
    } else {
      return ConfigController.loadConfig();
    }
  }

  static set ipmmRepoPath(ipmmRepoPath: string) {
    let config = this.config;
    config.ipmmRepo = ipmmRepoPath;
    this.saveConfig(config);
  }

  static get ipmmRepoPath(): string {
    return this.config.ipmmRepo;
  }

  static set foamRepoPath(foamRepoPath: string) {
    let config = this.config;
    config.foamRepo = foamRepoPath;
    this.saveConfig(config);
  }

  static get foamRepoPath(): string {
    return this.config.foamRepo;
  }
}

interface ConfigFile {
  ipmmRepo: string;
  foamRepo: string;
}
