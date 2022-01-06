import { Config } from "@oclif/config";
import * as fs from "fs";
import * as path from "path";
import Utils from "./utils";
import * as ipfs from "ipfs-core";
import ConfigCommand from "../commands/config";

export default class ConfigController {
   static _configPath = "~/.ipmm/config.json";
  /*
  private static _defaultIpmmPath = "~/.ipmm/repo.json";
  private static _logsPath = "~/.ipmm/logs.json";
  private static filterRemote = "~/.ipmm/filterRemote.json";
  private static filterLocal = "~/.ipmm/filterLocal.json";
*/
  private static _configFile: ConfigFile;

  private static get configPath(): string {
    return Utils.resolveHome(ConfigController._configPath);
  }
  

  static load = () => {
    let configPath = ConfigController.configPath;

    if (fs.existsSync(configPath)) {
      try{
        ConfigController._configFile = JSON.parse(fs.readFileSync(configPath, "utf8"));
      }
      catch(e){
        "Failed to parse config file:"+e;
      }
      //let data = JSON.parse(fs.readFileSync(configPath, "utf8"));
     /* ConfigController._configFile = {
        ipmmRepo: data.ipmmRepo,
        foamRepo: data.foamRepo,
      };
      */
    } else {
      console.log("No config file exists at " + configPath);
      console.log("To generate a new one run:");
      console.log("\tipmm init");
    }
  };

  static init = async (): Promise<void> => {
    let newConfig = await ConfigController.generateConfig();
    ConfigController._configFile = newConfig;
    ConfigController.save();
    console.log("New config files and keys created at "+ConfigController._configPath);
  }

  static generateConfig = async (): Promise<ConfigFile> => {
    const id = await ipfs.PeerId.create({ bits: 1024, keyType: "RSA" });
    const idObj = id.toJSON();

    const configFile = {
      identity: {
        mid: idObj.id,
        privKey: idObj.privKey!,
        pubKey: idObj.pubKey!,
      },
      network: {
        websocketPort: 56565,
        localServerPort: 67676,
        localClientPort: 78787,
        remoteServer: "",
      },
      resources: {
        foamRepo: "",
        ipmmRepo: "~/.ipmm/ipmmRepo.json",
        logs: "~/.ipmm/localFilter.json",
        localFilter: "~/.ipmm/localFilter.json",
        remoteFilter: "~/.ipmm/remoteFilter.json",
      },
    };
    return configFile;
  };

  static get config(): ConfigFile {
    if (!ConfigController._configFile) ConfigController.load();
    return ConfigController._configFile;
  }

  static set ipmmRepoPath(ipmmRepoPath: string) {
    ConfigController._configFile.resources.ipmmRepo = Utils.resolveHome(ipmmRepoPath);
    ConfigController.save();
  }

  static get ipmmRepoPath(): string {
    return this.config.resources.ipmmRepo;
  }

  static set foamRepoPath(foamRepoPath: string) {
    ConfigController._configFile.resources.foamRepo = Utils.resolveHome(foamRepoPath);
    ConfigController.save();
  }

  static get foamRepoPath(): string {
    return this.config.resources.foamRepo;
  }

  static get logsPath(): string {
    return ConfigController._configFile.resources.logs;
  }

  static get remoteFilterPath(): string {
    return ConfigController._configFile.resources.remoteFilter;
  }

  static get localFilterPath(): string {
    return ConfigController._configFile.resources.localFilter;
  }

  private static save() {
    Utils.saveFile(
      JSON.stringify(this.config, null, 2),
      ConfigController.configPath
    );
  }
}

interface ConfigFile {
  identity: {
    mid: string;
    privKey: string;
    pubKey: string;
  };
  network: {
    websocketPort: number;
    localServerPort: number;
    localClientPort: number;
    remoteServer: string;
  };
  resources: {
    foamRepo: string;
    ipmmRepo: string;
    logs: string;
    localFilter: string;
    remoteFilter: string;
  };
}
