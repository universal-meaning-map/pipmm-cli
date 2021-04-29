import { Config } from "@oclif/config";
import { config } from "cli-ux";
import * as fs from "fs";
import { utils } from "mocha";
import * as path from "path";
import ConfigCommand from "../commands/config";
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
    ConfigController.loadConfig();
    ConfigController._configFile.ipmmRepo = ipmmRepoPath;
    ConfigController.save();
  }

  static get ipmmRepoPath(): string {
    return this.config.ipmmRepo;
  }

  static set foamRepoPath(foamRepoPath: string) {
    ConfigController.loadConfig();
    ConfigController._configFile.foamRepo = foamRepoPath;
    ConfigController.save();
  }

  static get foamRepoPath(): string {
    return this.config.foamRepo;
  }

  private static save() {
    Utils.saveFile(JSON.stringify(this.config), ConfigController.configPath);
  }
}

interface ConfigFile {
  ipmmRepo: string;
  foamRepo: string;
}
