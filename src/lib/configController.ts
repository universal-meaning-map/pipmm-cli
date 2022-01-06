import { Config } from "@oclif/config";
import * as fs from "fs";
import * as path from "path";
import Utils from "./utils";
import * as ipfs from "ipfs-core";
import ConfigCommand from "../commands/config";

export default class ConfigController {
  static configPath = Utils.resolveHome("~/.ipmm/config.json");
  /*
  private static _defaultIpmmPath = "~/.ipmm/repo.json";
  private static _logsPath = "~/.ipmm/logs.json";
  private static filterRemote = "~/.ipmm/filterRemote.json";
  private static filterLocal = "~/.ipmm/filterLocal.json";
*/
  static _configFile: ConfigFile;

  static load = (): Boolean => {
    if (fs.existsSync(ConfigController.configPath)) {
      try {
        ConfigController._configFile = JSON.parse(
          fs.readFileSync(ConfigController.configPath, "utf8")
        );
        return true;
      } catch (e) {
        console.log("Failed to parse config file:" + e);
        return false;
      }
    } else {
      console.log("No config file exists at " + ConfigController.configPath);
      console.log("To generate a new one run:");
      console.log("\tipmm init");
      return false;
    }
  };

  static init = async (foamRepo:string): Promise<void> => {
    let newConfig = await ConfigController.generateConfig(foamRepo);
    ConfigController._configFile = newConfig;
    ConfigController.save();
    console.log(
      "New config files and keys created at " +
        ConfigController.configPath +
        "\n"
    );
    console.log(ConfigController._configFile);
  };

  static generateConfig = async (foamRepo:string): Promise<ConfigFile> => {
    const id = await ipfs.PeerId.create({ bits: 1024, keyType: "RSA" });
    const idObj = id.toJSON();

    const configFile = {
      resources: {
        foamRepo: Utils.resolveHome(foamRepo),
        ipmmRepo: Utils.resolveHome("~/.ipmm/ipmmRepo.json"),
        logs: Utils.resolveHome("~/.ipmm/localFilter.json"),
        localFilter: Utils.resolveHome("~/.ipmm/localFilter.json"),
        remoteFilter: Utils.resolveHome("~/.ipmm/remoteFilter.json"),
      },
      network: {
        websocketsPort: 34343,
        localServerPort: 45454,
        localClientPort: 56565,
        remoteServer: "",
      },
      identity: {
        mid: idObj.id,
        privKey: idObj.privKey!,
        pubKey: idObj.pubKey!,
      },
    };
    return configFile;
  };

  static set ipmmRepoPath(ipmmRepoPath: string) {
    ConfigController._configFile.resources.ipmmRepo =
      Utils.resolveHome(ipmmRepoPath);
    ConfigController.save();
  }

  static get ipmmRepoPath(): string {
    return ConfigController._configFile.resources.ipmmRepo;
  }

  static set foamRepoPath(foamRepoPath: string) {
    ConfigController._configFile.resources.foamRepo =
      Utils.resolveHome(foamRepoPath);
    ConfigController.save();
  }

  static get foamRepoPath(): string {
    return ConfigController._configFile.resources.foamRepo;
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
      JSON.stringify(ConfigController._configFile, null, 2),
      Utils.resolveHome(ConfigController.configPath)
    );
  }
}

interface ConfigFile {
  resources: {
    foamRepo: string;
    ipmmRepo: string;
    logs: string;
    localFilter: string;
    remoteFilter: string;
  };
  network: {
    websocketsPort: number;
    localServerPort: number;
    localClientPort: number;
    remoteServer: string;
  };
  identity: {
    mid: string;
    privKey: string;
    pubKey: string;
  };
}
