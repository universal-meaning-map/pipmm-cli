import { Config } from "@oclif/config";
import * as fs from "fs";
import * as path from "path";
import Utils from "./utils";

export default class ConfigController {
  private static _configPath = "~/.ipmm/config.json";
  //private static _defaultIpfsPath = "~/.ipmm/";
  private static _defaultIpmmPath = "~/.ipmm/repo.json";
  private static _logsPath = "~/.ipmm/logs.json";

  private static _configFile: ConfigFile;

  private static get configPath(): string {
    return Utils.resolveHome(ConfigController._configPath);
  }

  private static load = () => {
    let configPath = ConfigController.configPath;

    if (fs.existsSync(configPath)) {
      //console.log("Config already exists at " + configPath);
      let data = JSON.parse(fs.readFileSync(configPath, "utf8"));
      ConfigController._configFile = {
        ipmmRepo: data.ipmmRepo,
        foamRepo: data.foamRepo,
        //ipfsRepo: data.ipfsRepo,
      };
    } else {
      //console.log("No config file exists at " + configPath);
      ConfigController._configFile = {
        ipmmRepo: ConfigController._defaultIpmmPath,
        foamRepo: "",
        //ipfsRepo: ConfigController._defaultIpfsPath,
      };
    }
  };

  static get config(): ConfigFile {
    if (!ConfigController._configFile) ConfigController.load();
    return ConfigController._configFile;
  }

  static set ipmmRepoPath(ipmmRepoPath: string) {
    ConfigController.load();
    ConfigController._configFile.ipmmRepo = Utils.resolveHome(ipmmRepoPath);
    ConfigController.save();
  }

  static get ipmmRepoPath(): string {
    return this.config.ipmmRepo;
  }

  static set foamRepoPath(foamRepoPath: string) {
    ConfigController.load();
    ConfigController._configFile.foamRepo = Utils.resolveHome(foamRepoPath);
    ConfigController.save();
  }

  static get foamRepoPath(): string {
    return this.config.foamRepo;
  }

  static set ipfsRepoPath(ipfsRepoPath: string) {
    ConfigController.load();
    ConfigController._configFile.ipfsRepo = Utils.resolveHome(ipfsRepoPath);
    ConfigController.save();
  }

  static get ipfsRepoPath(): string {
    return this.config.ipfsRepo;
  }

  static get logsPath(): string {
    return ConfigController._logsPath;
  }

  private static save() {
    Utils.saveFile(JSON.stringify(this.config), ConfigController.configPath);
  }
}

interface ConfigFile {
  ipmmRepo: string;
  foamRepo: string;
  //ipfsRepo: string;
}
