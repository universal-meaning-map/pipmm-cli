import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Referencer from "../lib/referencer";
import Utils from "../lib/utils";

export default class InitCommand extends Command {
  static description =
    "Generates a config that allow peers of see and reference your notes";

  static flags = {
    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  async run() {
    const { args, flags } = this.parse(InitCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;
    let config = ConfigController.makeSelfFriendConfig();
    let folderName = Referencer.makeSelfFriendFolderId();

    console.log(JSON.stringify(config, null, 2));
    console.log(
      "Create a file named friendConfig.json and copy the JSON above inside. Place the file inside a folder named " +
        folderName
    );
  }
}
