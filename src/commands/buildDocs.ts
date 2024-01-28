import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import DefinerStore, { Definition } from "../lib/definerStore";
import Composer, { Resource, SubSection } from "../lib/composer";
import AnswerCommand from "./answer";
import RequestConceptHolder from "../lib/requestConceptHolder";
import LlmRequests from "../lib/llmRequests";
import { GPT4TURBO, callLlm, getPromptContextMaxChars } from "../lib/llm";
import matter = require("gray-matter");
import InterplanetaryText from "../lib/interplanetaryText";
import Publisher from "../lib/publisher";
import Referencer from "../lib/referencer";
import DirectSearch from "../lib/directSearch";
import { promises as fs } from "fs";
import Tokenizer from "../lib/tokenizer";

export default class BuildDocs extends Command {
  static description = "Create docs files from Composer";

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
      name: "composerDirectory",
      required: true,
      description: "URI of the Composer directory",
      hidden: false,
    },

    {
      name: "docsDirectory",
      required: true,
      description: "URI of the docs directory. ",
      hidden: false,
    },
  ];

  makeWikilink(r: Resource) {
    return "[" + r.title + "](" + r.qid + ".md)";
  }

  makeIndexPage(resources: Resource[], baseDir: string) {
    let text = "# Framework\n\n";
    for (let r of resources) {
      text += "- " + this.makeWikilink(r) + "\n";
    }

    Utils.saveFile(text, baseDir + "/index.md");
  }

  async run() {
    console.warn = () => {};

    const { args, flags } = this.parse(BuildDocs);

    let workingPath = process.cwd();
    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }
    if (!ConfigController.load(workingPath)) return;

    let composerFrameworkDir = args.composerDirectory + "/framework";
    let docsFrameworkDir = args.docsDirectory + "/framework";
    //Delete existing Framework in docs

    //Hardcoded to prevent mistakes
    //Wipe docsFrameDir
    Utils.deleteFolder("/Users/xavi/Dev/umm-mkdocs/docs/framework");

    let files = await fs.readdir(composerFrameworkDir);
    files = Utils.filterByExtensions(files, [".md"]);

    let index: Resource[] = [];

    // Build files
    for (let fileName of files) {
      let data = Utils.getFile(composerFrameworkDir + "/" + fileName);

      let frontMatter;

      try {
        frontMatter = matter(data);
      } catch (e) {
        console.log("Unable to parse front-matter for: " + fileName);
        console.log(e);
        return;
      }

      if (frontMatter.data) {
        let r: Resource = frontMatter.data as Resource;
        if (r.public) {
          index.push(r);

          let docsFilePath = docsFrameworkDir + "/" + r.qid + ".md";

          let writing = frontMatter.content.split("---")[1].trim();

          console.log(writing);

          let body = "# " + r.title + "\n\n" + writing;
          Utils.saveFile(body, docsFilePath);
        }
      }
    }

    // Build index
    this.makeIndexPage(index, docsFrameworkDir);
  }
}
