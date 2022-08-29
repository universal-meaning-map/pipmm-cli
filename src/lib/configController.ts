import * as fs from "fs";
import Utils from "./utils";
import Referencer from "./referencer";
export default class ConfigController {
  static configPath: any;
  static relativeConfigPath = "/.pipmm/config.json";
  static _configFile: ConfigFile;

  static load = (repoPath: any): Boolean => {
    ConfigController.configPath =
      repoPath + ConfigController.relativeConfigPath;

    if (fs.existsSync(ConfigController.configPath)) {
      try {
        ConfigController._configFile = JSON.parse(
          fs.readFileSync(ConfigController.configPath, "utf8")
        );
        return true;
      } catch (e) {
        console.log("Failed to parse config file:" + e);
        return false;``
      }
    } else {
      console.log("No config file exists at " + ConfigController.configPath);
      console.log("To generate a new one run:");
      console.log("\tpipmm init");
      return false;
    }
  };

  static init = async (repoPath: string): Promise<void> => {
    ConfigController.configPath =
      repoPath + ConfigController.relativeConfigPath;
    let newConfig = await ConfigController.generateConfig(repoPath);
    ConfigController._configFile = newConfig;
    ConfigController.save();
    console.log(
      "Keys generated, new config file created at " +
        ConfigController.configPath +
        "\n"
    );
    console.log(ConfigController._configFile);
  };

  static generateConfig = async (foamRepo: string): Promise<ConfigFile> => {
    let idObj = await Referencer.makeIdObj();

    const configFile = {
      resources: {
        notesRepo: Utils.resolveHome(foamRepo),
        ipmmRepo: Utils.resolveHome(foamRepo + "/.pipmm/pipmmRepo.json"),
        logs: Utils.resolveHome(foamRepo + "/.pipmm/logs.json"),
        localFilter: Utils.resolveHome(foamRepo + "/.pipmm/localFilter.json"),
        remoteFilter: Utils.resolveHome(foamRepo + "/.pipmm/remoteFilter.json"),
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
      misc: {
        alwaysCompile: [
          "xavi-YAxr3c/trans-sub-abstraction-block-1639169078",
          "xavi-YAxr3c/trans-column-navigator-1612122309",
          "xavi-YAxr3c/trans-note-viewer-1641223323",
          "xavi-YAxr3c/pipmm-instructions-1644422409",
        ],
        defaultContentProperty: "xavi-YAxr3c/prop-view-1612698885",
        defaultExpr:
          "[%22i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3clzfmhs7a%22,[[%22i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3c2lf4dbua%22,%22i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3cl5uz4zaq%22]]]",
      },
      interplanetaryText: {
        compileArefs: false,
        defaultAbstractionPointer: "xavi-YAxr3c/prop-name-1612697362",
      },
      export: {
        stringTemplates: [
          {
            exportId: "md",
            aref: "[{transclusion}](https://example.com/#?expr=%5B%22i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3clzfmhs7a%22,%5B%5B%22i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3ck7dwg62a%22,%22{iid}%22%5D%5D%5D)",
            arefNotFound: "<404>",
          },
          {
            exportId: "txt",
            aref: "{transclusion}",
            arefNotFound: "-",
          },
        ],
      },

      publish: {
        buttonDown: {
          apiKey: "",
          subject: [
            {
              property: "xavi-YAxr3c/prop-name-1612697362",
              exportTemplateId: "txt",
            },
          ],
          body: [
            {
              property: "xavi-YAxr3c/prop-name-1612697362",
              exportTemplateId: "md",
            },
            {
              property: "xavi-YAxr3c/prop-view-1612698885",
              exportTemplateId: "md",
            },
          ],
        },
        telegram: {
          apiKey: "",
          channelUserName: "",
          body: [
            {
              property: "xavi-YAxr3c/prop-name-1612697362",
              exportTemplateId: "txt",
            },
            {
              property: "xavi-YAxr3c/prop-view-1612698885",
              exportTemplateId: "txt",
            },
          ],
        },
        twitter: {
          apiKey: "",
          body: [
            {
              property: "xavi-YAxr3c/prop-name-1612697362",
              exportTemplateId: "txt",
            },
            {
              property: "xavi-YAxr3c/prop-view-1612698885",
              exportTemplateId: "txt",
            },
          ],
        },
      },

      share: {
        myName: "myName",
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
    ConfigController._configFile.resources.notesRepo =
      Utils.resolveHome(foamRepoPath);
    ConfigController.save();
  }

  static get foamRepoPath(): string {
    return ConfigController._configFile.resources.notesRepo;
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

  static loadFriendConfig = (friendFolder: string): FriendConfig | null => {
    let path = Utils.resolveHome(
      ConfigController._configFile.resources.notesRepo +
        "/" +
        friendFolder +
        "/friendConfig.json"
    );

    if (fs.existsSync(path)) {
      try {
        let config: FriendConfig = JSON.parse(fs.readFileSync(path, "utf8"));
        return config;
      } catch (e) {
        console.log("Failed to parse friendConfig file:" + e);
        return null;
      }
    } else {
      console.log("No friendConfig file exists at " + path);
      return null;
    }
  };

  static makeSelfFriendConfig = (): FriendConfig => {
    return {
      identity: {
        mid: ConfigController._configFile.identity.mid,
        pubKey: ConfigController._configFile.identity.pubKey,
      },
    };
  };
}

interface ConfigFile {
  resources: {
    notesRepo: string;
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
  misc: {
    alwaysCompile: string[];
    defaultExpr: string;
    defaultContentProperty: string;
  };
  interplanetaryText: {
    compileArefs: boolean;
    defaultAbstractionPointer: string;
  };
  export: {
    stringTemplates: ExportTemplate[];
  };
  publish: {
    buttonDown: {
      apiKey: string;
      body: PublishExportRun[];
      subject: PublishExportRun[];
    };
    telegram: {
      apiKey: string;
      channelUserName: string;
      body: PublishExportRun[];
    };
    twitter: {
      apiKey: string;
      body: PublishExportRun[];
    };
  };
  share: {
    myName: string;
  };
}

export interface ExportTemplate {
  exportId: string;
  aref: string;
  arefNotFound: string;
}

export interface PublishExportRun {
  property: string;
  exportTemplateId: string;
}

interface FriendConfig {
  identity: {
    mid: string;
    pubKey: string;
  };
}
