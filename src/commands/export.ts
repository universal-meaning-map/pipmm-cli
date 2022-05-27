import { Command, flags } from "@oclif/command";
import ConfigController, { ExportTemplate } from "../lib/configController";
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
  };

  static args = [
    {
      name: "exportId",
      required: true,
      description: "exportId defined in the config file",
      hidden: false,
    },
    {
      name: "prop",
      required: true,
      description: "<fileName/property> of interplanetary-text to export",
      hidden: false,
    },

    {
      name: "v1",
      required: false,
      description: "value that will replace the  string-template {v1}",
      hidden: false,
    },

    {
      name: "v2",
      required: false,
      description: "value that will replace the  string-template {v2}",
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

    let exportTemplate: ExportTemplate | null = null;
    let existingExportIds = [];

    for (let t of ConfigController._configFile.export.stringTemplates) {
      if (t.exportId == args.exportId) {
        exportTemplate = t;
        break;
      }
      existingExportIds.push(t.exportId);
    }
    if (exportTemplate == null) {
      console.log(
        "The exportId specified does not match any of the defined in " +
          ConfigController.configPath
      );
      console.log("Available exportIds: " + existingExportIds.join(", "));
      return;
    }

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
      let output = InterplanetaryText.transclude(
        expr,
        exportTemplate!,
        iid,
        args.v1,
        args.v2
      );
      console.log(output)
    }
    else{
      console.log("error")
    }
    ErrorController.saveLogs();
  }
}
