import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import DefinerStore, { Definition } from "../lib/definerStore";
import Composer, { Resource } from "../lib/composer";
import RequestConceptHolder from "../lib/requestConceptHolder";
import LlmRequests from "../lib/llmRequests";
import { GPT4TURBO, callLlm, getPromptContextMaxChars } from "../lib/llm";
import matter = require("gray-matter");
import Publisher from "../lib/publisher";
import Referencer from "../lib/referencer";
import DirectSearch from "../lib/directSearch";

export default class EnrichCommand extends Command {
  static description = "Uses LLMs to write about a topic in a specific format";

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
      name: "draftFileName",
      required: true,
      description: "Draft to enrich",
      hidden: false,
    },
  ];

  async run() {
    console.warn = () => {};

    const { args, flags } = this.parse(EnrichCommand);

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

    //Get all data from muo
    let iid = await Referencer.getIidByFileName(args.draftFileName);
    if (!iid) {
      console.log(args.draftFileName + " draft could not be found");
      return;
    }
    let withHyphen = true;

    let question = await Publisher.getTextFromProperty(
      iid,
      Referencer.PROP_QUESTION_FILENAME,
      withHyphen
    );

    let draft = await Publisher.getTextFromProperty(
      iid,
      Referencer.PROP_DRAFT_FILENAME,
      withHyphen
    );

    let styleId = await Publisher.getTextFromProperty(
      iid,
      Referencer.PROP_COMPOSER_STYLE_FILENAME,
      withHyphen
    );

    let title = await Publisher.getTextFromProperty(
      iid,
      Referencer.PROP_TITLE_FILENAME,
      withHyphen
    );

    let unknown = await Publisher.getTextFromProperty(
      iid,
      Referencer.PROP_UNKNOWN_FILENAME,
      withHyphen
    );

    if (draft == "") {
      console.log(
        args.draftFileName +
          " is missing " +
          Referencer.PROP_DRAFT_FILENAME +
          " property"
      );
    }
    if (question == "") {
      console.log(
        args.draftFileName +
          " is missing " +
          Referencer.PROP_QUESTION_FILENAME +
          " property"
      );
    }
    if (title == "") {
      console.log(
        args.draftFileName +
          " is missing " +
          Referencer.PROP_TITLE_FILENAME +
          " property"
      );
    }
    if (styleId == "") {
      console.log(
        args.draftFileName +
          " is missing " +
          Referencer.PROP_COMPOSER_STYLE_FILENAME +
          " property"
      );
    }

    let qid = Composer.makeQuestionId(title);

    //directories
    let enrichPath =
      args.composerDirectory + "/framework-support/" + qid + "-e.md";
    let autoPath =
      args.composerDirectory + "/framework-support/" + qid + "-a.md";
    let manualPath = args.composerDirectory + "/framework/" + qid + ".md";
    let stylePath = args.composerDirectory + "/styles/" + styleId + ".md";

    //Check composer directory
    let style = Utils.getFile(stylePath);

    // Get ernich if it exist

    let enrich = "";
    try {
      enrich = Utils.getFile(enrichPath);
      console.log(enrich);
    } catch {
      console.log("No enrich path:\n" + enrichPath);
    }

    //ENRICH
    if (enrich == "") {
      let draftDependencies =
        await DirectSearch.getAllNamesWithHyphenDependencies(
          Utils.renameToHyphen(args.draftFileName),
          Referencer.PROP_DRAFT_FILENAME
        );

      await DefinerStore.load();

      let rch = new RequestConceptHolder(
        [],
        draft,
        draftDependencies,
        question
      );
      await rch.proces();
      await DefinerStore.save();

      const enrichReq = LlmRequests.Enrich;
      enrichReq.identifierVariable = question;
      const enrichModel = GPT4TURBO;
      const promptTemplateChars = enrichReq.template.length;
      const maxPromptContextChars = getPromptContextMaxChars(
        enrichReq.maxPromptChars,
        enrichReq.maxCompletitionChars,
        promptTemplateChars,
        enrichModel
      );

      let trimedByScore = DefinerStore.trimScoreList(rch.all, 0.7);

      let allDefinitions: Definition[] =
        await DefinerStore.getDefinitionsByConceptScoreList(trimedByScore);

      let maxedOutTextDefinitions: string[] = DefinerStore.getMaxOutDefinitions(
        allDefinitions,
        maxPromptContextChars
      );
      let definitionsText = maxedOutTextDefinitions.join("\n");
      // definitionsText = definitionsText.replaceAll(Tokenizer.hyphenToken, " ");

      for (let i = 0; i < maxedOutTextDefinitions.length; i++) {
        console.log(i + ". " + allDefinitions[i].name);
      }
      console.log(`
    DEFINITIONS:
    Name: ${enrichReq.name}
    Id: ${enrichReq.identifierVariable}
    Used defs: ${maxedOutTextDefinitions.length} /  ${allDefinitions.length}
    `);

      let known = "";

      if (known != "") {
        known =
          "KNOWN CONCEPTS\n\nThe following concepts are well known by the audience and do not need explanation: " +
          args.known;
      }
      const enrichInputVariables = {
        draft: draft,
        question: question,
        known: known,
        perspective: definitionsText,
      };

      enrich = await callLlm(enrichModel, enrichReq, enrichInputVariables);
      Utils.saveFile(enrich, enrichPath);
    } else {
      console.log("Enrich found");
    }

    //STYLE
    const styleReq = LlmRequests.Style;
    styleReq.identifierVariable = question;

    if (unknown != "") {
      unknown =
        "\n\nUNKWNOWN CONCEPTS\n\nThe following are unknown to the audience. Do not mention them, if they are very important explain them in a nameless manner: " +
        unknown;
    }
    const styleInputVariables = {
      draft: enrich,
      question: question,
      style: style,
      unknown: unknown,
    };

    let styleModel = GPT4TURBO;
    let styled = await callLlm(styleModel, styleReq, styleInputVariables);
    Utils.saveFile(styled, autoPath);

    try {
      Utils.getFile(manualPath);
    } catch (e) {
      //if manual doesn't exist we create it
    }

    let openMuo =
      "[Draft](obsidian://open?vault=foam&file=" +
      encodeURI(args.draftFileName) +
      ")";
    let openEnrich = "[Enriched](framework-support/" + qid + "-e)";
    let transcludedAuto = "![[framework-support/" + qid + "-a]]";

    let body =
      openMuo + "  " + openEnrich + "\n\n" + transcludedAuto + "\n\n---\n";
    let r: Resource = {
      title: title,
      question: question,
      qid: qid,
      styleId: styleId,
      timestamp: Date.now(),
      muoFileName: args.draftFileName,
      public: false,
    };
    let md = matter.stringify(body, r);

    Utils.saveFile(md, manualPath);
  }
}
