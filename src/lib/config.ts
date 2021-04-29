import * as fs from "fs";
import Utils from "../lib/utils";
import * as path from "path";

export default class Config {
  ipmmRepo: string;
  foamRepo: string;

  constructor(ipmmrepo: string, foamRepo: string) {
    this.ipmmRepo = ipmmrepo;
    this.foamRepo = foamRepo;
  }

  static configPath = "~/.ipmm/config.json";

  static loadConfig = async (): Promise<Config> => {
    let configPath = Utils.resolveHome(Config.configPath);
    
    if (!fs.existsSync(configPath)) {
      throw new Error("Nof config file exists at " + configPath);
    }

    let data = JSON.parse(fs.readFileSync(configPath, "utf8"));

    let config = new Config(data.ipmmRepo, data.foamRepo);
    console.log("config", config);

    return config;
  };

  static saveConfig = async (): Promise<void> => {
    if (!fs.existsSync(configPath)) {
      console.log("Creating config file at " + configPath);
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({}));
    }
  };
}
