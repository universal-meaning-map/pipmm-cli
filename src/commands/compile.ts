import { Command, flags } from "@oclif/command";
import cli, { config } from "cli-ux";
import ConfigController from "../lib/configController";
import Compiler from "../lib/compiler";
import ErrorController from "../lib/errorController";
import { NoteWrap } from "../lib/ipmm";
import { promises as fs, readFile } from "fs";
import Referencer from "../lib/referencer";
import Utils from "../lib/utils";
import LogsController from "../lib/logsController";

import matter from "gray-matter";
import * as path from "path";
import { name } from "@ipld/dag-json/index";

export default class CompileCommand extends Command {
  static description =
    "Compiles the `Abstractions` repository (or a single note) into an IPMM repo and saves it as JSON object";

  static flags = {
    help: flags.help({ char: "h" }),
    notesRepoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  static args = [
    {
      name: "fileName",
      required: false,
      description: "File name within the Foam root directory to import ",
      hidden: false,
    },
  ];

  async run() {
    const { args, flags } = this.parse(CompileCommand);
    let workingPath = process.cwd();
    if (flags.notesRepoPath) {
      workingPath = Utils.resolveHome(flags.notesRepoPath);
    }
    if (!ConfigController.load(workingPath)) return;

    /*
    //Migration
    let files = await fs.readdir(
      ConfigController._configFile.resources.notesRepo
    );
    files = Utils.filterByExtensions(files, [".md"]);

    let i = 0;
    for (let fileNameWithExtension of files) {
      i++;
      const filePath = path.join(
        ConfigController._configFile.resources.notesRepo,
        fileNameWithExtension
      );

      const fileData = await fs.readFile(filePath, "utf8");
      let frontMatter;
      try {
        frontMatter = matter(fileData);
      } catch (e) {
        console.log("error: " + fileNameWithExtension);
        console.log(e);
      }

      let name = "";
      if (frontMatter!.data[Referencer.PROP_NAME_FILENAME]) {
        name = frontMatter!.data[Referencer.PROP_NAME_FILENAME];
      }

      const fileName = Utils.removeFileExtension(fileNameWithExtension);

      const fid = Referencer.getFID(fileName);
      let newName = name;

      if (!name) {
        name = " " + fileName;
        if (fileData.length > 50) {
          newName = fileName.substring(0, fileName.length - 11);
          if (fileName.indexOf("prop-") == -1) {
            newName = newName.split("-").join(" ");
          }
          name = "🔴" + newName;
        } else {
          continue;
        }
      }


      
      // console.log(i + " " + fid + "  " + name);
      
      //Build content
      
      let content = "";
      if (frontMatter!.content) content = frontMatter!.content;
      let yaml = {};
      yaml.fid = parseInt(fid);
      
      for (const key in frontMatter!.data) {
          if (key != Referencer.PROP_NAME_FILENAME) {
              yaml[key] = frontMatter!.data[key];
            }
        }
        
        const c = matter!.stringify(content, yaml);

        console.log(newName)
        /*
        Utils.saveFile(
            c,
            ConfigController._configFile.resources.notesRepo +
            "/new/" +
            fileName +
            ".md"
            );

            ^/
        }
        

    return;
    */

    //compile a single filex
    if (args.fileName) {
      const res = await Compiler.compileFile(
        ConfigController._configFile.resources.ipmmRepo,
        ConfigController._configFile.resources.notesRepo,
        args.fileName
      );

      if (res.isOk()) {
        let note: NoteWrap = res.value;
        let obj = Utils.strMapToObj(note.block);
        console.log("iid: " + note.iid);
        console.log("cid: " + note.cid);
        console.log(JSON.stringify(obj, null, 2));
        //TODO: Update repo
      }
    }
    //compile all files from user repo and its dependencies
    else {
      await Compiler.compileAll(
        ConfigController._configFile.resources.ipmmRepo,
        ConfigController._configFile.resources.notesRepo
      );
      console.log(
        "Compiled " + Referencer.iidToNoteWrap.size + " abstractions"
      );
      await Utils.saveIpmmRepo();
    }

    const sortedMap = new Map(
      [...Referencer.missingFileNames.entries()].sort((a, b) => b[1] - a[1])
    );
    console.log(sortedMap);

    ErrorController.saveLogs();
    LogsController.logSummary(ErrorController.savedErrors);
  }
}
