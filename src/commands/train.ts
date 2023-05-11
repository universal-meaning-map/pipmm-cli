import { Command, flags } from "@oclif/command";
import ConfigController, {
  ExportTemplate,
  PublishExportRun,
} from "../lib/configController";
import axios from "axios";
import Referencer from "../lib/referencer";
import Compiler from "../lib/compiler";
import Utils from "../lib/utils";
import Filter from "../lib/filterController";
import Publisher from "../lib/publisher";
import InterplanetaryText from "../lib/interplanetaryText";

export default class TrainCommand extends Command {
  static description =
    "Iterates over git history and creates word embeddings for every meaning unit";

  static flags = {
    help: flags.help({ char: "h" }),

    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  async run() {
    const { args, flags } = this.parse(TrainCommand);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    // Compile
    await Compiler.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );
    let repo = Referencer.iidToNoteWrap;

    //Filter
    let jsonFilter = Utils.getFile(ConfigController.botFilterPath);
    console.log(jsonFilter);
    console.log("a");
    let filter = JSON.parse(jsonFilter);
    console.log("Applying filter:\n" + jsonFilter);

    let filteredRepo = await Filter.filter(repo, filter);
    console.log("Total abstractions: " + repo.size);
    console.log("Filtered abstractions: " + filteredRepo.size);
    console.log(
      "Percentage " +
        Math.round(((filteredRepo.size * 100) / repo.size) * 100) / 100 +
        "%"
    );

    console.log("Uploading...");
    // Export

    const PIR_IID = 
      "i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3chsme72ka";

    for (let [iid, note] of filteredRepo.entries()) {
      // console.log(iid);
      let config = {
        // property: "xavi-YAxr3c/prop-name-1612697362",
        property: "xavi-YAxr3c/prop-view-1612698885",
        exportTemplateId: "txt",
      };

      let out = await Publisher.makePublishRun(iid, config);
      let exportObj = {
        iid: iid,
        pir: note.block.get(PIR_IID),
        content: out,
        time: Date.now(),
      };
      console.log(exportObj);
      //console.log(note.block);
    }
  }
  /*

    // Upload
    let endpoint = "";
    const res = await axios.put(endpoint, Utils.notesWrapToObjs(filteredRepo));

    if (res.data) {
      console.log(res.data);
    } else {
      console.log(res);
    }
    */
}
