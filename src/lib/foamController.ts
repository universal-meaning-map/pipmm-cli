import ErrorController from "./errorController";
import Utils from "./utils";
import * as matter from "gray-matter";
import * as path from "path";
import {promises as fs} from "fs";

export default class FoamController {
  static import = async (ipmmRepo: String, foamRepo: string): Promise<void> => {
    let files = await fs.readdir(foamRepo);

    files = Utils.filterExtension(files, [".md"]);

    console.log(
      "Importing FOAM repository from ",
      path.resolve(process.cwd(), foamRepo),
      "..."
    );

    let i: number = 0;

    /*
    const progressBar = cli.progress({
      format: "{file}, {bar} {value}/{total} Notes",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
    });
    progressBar.start(files.length, 0);
*/
    for (let fileName of files) {
      //progressBar.update({ file: fileName });
      i++;
      let filePath = path.join(foamRepo, fileName);
      let note = await FoamController.makeNote(filePath);
    }
   // progressBar.stop();
  };

  static makeNote = async (filePath: string): Promise<NoteType> => {
    let note: NoteType = {};
    let data: string = "";
    try {
      data = await fs.readFile(filePath, "utf8");
    } catch (e) {
      ErrorController.recordProcessError(filePath, "reading file", e);
    }

    //gray-matter object
    try {
      let m = matter(data);

      note.content = m.content;

      for (let prop in m.data) {
        note[prop] = m.data[prop];
      }

      return note;
    } catch (error) {
      ErrorController.recordProcessError(
        filePath,
        "parsin Front Matter file",
        error
      );
    }

    return note;
  };
}

interface NoteType {
  [key: string]: any;
}
