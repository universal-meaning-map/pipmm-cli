import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Referencer from "../lib/referencer";
import Compiler from "../lib/compiler";
import Utils from "../lib/utils";
import { NoteWrap } from "../lib/ipmm";
import ErrorController from "../lib/errorController";
import InterplanetaryText from "../lib/interplanetaryText";

export default class ExportCommand extends Command {
  static description = "Exports interplanetary-text Markdown";

  static flags = {
    help: flags.help({ char: "h" }),

    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
    isXavi: flags.boolean({
      name: "isXavi",
      char: "x",
      description:
        "Hard-coded foamId references to Xavi's repo are assumed to be on the root folder",
    }),
  };

  static args = [
    {
      name: "prop",
      required: true,
      description: "<fileName/property> of interplanetary-text to export",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(ExportCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;
    if (flags.isXavi) ConfigController.isXavi = true;

    let runs = args.prop.split("/");
    let foamId = runs[0];
    if (runs.length <= 1) {
      console.log("Missing property to export: Use <fileName/property> syntax");
      return;
    }
    let propertyId = runs[1];

    const res = await Compiler.compileFile(
      ConfigController._configFile.resources.ipmmRepo,
      ConfigController._configFile.resources.notesRepo,
      foamId
    );

    let iid = await Referencer.makeIid(foamId);
    let tiid = await Referencer.makeIid(propertyId);
    let expr = Referencer.makeExpr(iid, tiid);

    if (res.isOk()) {
      let note: NoteWrap = res.value;
      let ipt = note.block.get(tiid);
      InterplanetaryText.transclude(expr);
    }
    ErrorController.saveLogs();
  }
}
