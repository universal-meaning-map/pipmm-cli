import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import DefinerStore, { Definition } from "../lib/definerStore";
import Composer, { SubSection } from "../lib/composer";
import AnswerCommand from "./answer";

export default class DocsCommand extends Command {
  static description =
    "Uses the output of Drafters to build a documentation site based on markdown / MkDocs";

  static flags = {
    help: flags.help({ char: "h" }),
  };

  static args = [
    {
      name: "drafter_uri",
      required: true,
      description: "URI to the drafter document",
      hidden: false,
    },

    {
      name: "publish_uri",
      required: true,
      description: "URI where the docs will be published",
      hidden: false,
    },
  ];

  static buildMarkdown(section: SubSection, level: number): string {
    let t = Composer.getHeading(level) + " " + section.title + "\n\n";

    //Base output can't have gaps.
    if (section.baseOutput == "") {
      t += "Not written.";
    }

    t += section.baseOutput + "\n";
    level++;

    for (let s of section.subSections) {
      let bo = DocsCommand.buildMarkdown(s, level);
      if (bo == "") return t;
      t += bo;
    }
    return t;
  }

  async run() {
    console.warn = () => {};

    const { args, flags } = this.parse(DocsCommand);

    let workingPath = process.cwd();

    // if (!ConfigController.load(workingPath)) return;

    let drafter = Composer.loadDrafter(args.drafter_uri);
    let md = DocsCommand.buildMarkdown(drafter.page, 1);

    console.log(md);

    Utils.saveFile(md, args.publish_uri + "/" + drafter.page.title + ".md");
  }
}
