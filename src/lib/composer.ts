import AnswerCommand from "../commands/answer";
import Utils from "./utils";

export interface SubSection {
  isGoodEnough: boolean;
  title: string;
  question: string;
  length: string;
  guidelines: string;
  givenConcepts: string[];
  baseOutput: string;
  historic: string[];
  subSections: SubSection[];
}

export interface Drafter {
  context: string;
  page: SubSection;
}

export default class Composer {
  static loadDrafter(uri: string) {
    const drafterStr = Utils.getFile(uri);
    const drafter: Drafter = JSON.parse(drafterStr) as Drafter;
    return drafter;
  }

  static buildRequestYAML(drafter: Drafter): string {
    return `
{
    "title": "IPMM overview",
    "question": "What's IPMM?",
    "length": "4 paragraphs",
    "requirements": [
      "A high level overview.",
      "Do not talk about particular human needs but how its aim is to increase the signal-to-noise ratio by information not being mediated by others."
    ],
    "subSections": [
      {
        "title": "Current stage",
        "question": "What's the current stage of development of IPMM?",
        "length": "2 paragraphs",
        "requirements": [
          "Justify why the conceptual framework is the priority and by having a shared model we will be able to build a more resilient tool."
        ],
        "subSections": []
      },
      {
        "title": "Terminology",
        "question": "Why it is  relevant for IPMM to have its own terminology?",
        "length": "1 paragraph",
        "requirements": [
          "Focus on explain why by defining things in explicit ways we can have a lot more subtlety and precision. We are not bound to existing definitions and we can evolve them as we need. "
        ],
        "subSections": []
      }
    ]
  }
`;
  }

  static buildRequest(s: SubSection): string {
    return JSON.stringify(Composer.buildRequestObj(s), null, 2);
  }

  static buildRequestObj(s: SubSection): any {
    let objs = [];
    for (let ss of s.subSections) {
      objs.push(Composer.buildRequestObj(ss));
    }
    let obj = {
      title: s.title,
      question: s.question,
      length: s.length,
      gx3uidelines: s.guidelines,
      subsections: objs,
    };
    return obj;
  }

  static getHeading(level: number) {
    let h = "";
    for (let i = 0; i < level; i++) {
      h = h + "#";
    }
    return h;
  }

  static buildBaseOutput(section: SubSection, level: number): string {
    let t = Composer.getHeading(level) + " " + section.title + "\n\n";

    //Base output can't have gaps.
    if (section.baseOutput == "") return "";

    t += section.baseOutput + "\n";
    level++;

    for (let s of section.subSections) {
      let bo = Composer.buildBaseOutput(s, level);
      if (bo == "") return t;
      t += bo;
    }
    return t;
  }

  static extractGivenConcepts(section: SubSection) {
    let givenConcepts = section.givenConcepts;
    for (let s of section.subSections) {
      givenConcepts = givenConcepts.concat(Composer.extractGivenConcepts(s));
    }
    return givenConcepts;
  }

  static extractQuestions(section: SubSection) {
    let questions = section.question;
    for (let s of section.subSections) {
      questions += "\n" + Composer.extractQuestions(s);
    }
    return questions;
  }

  static getTextBetweenTokens(
    input: string,
    startToken: string,
    endToken: string
  ): string | null {
    const startIdx = input.indexOf(startToken);

    if (startIdx !== -1) {
      const endIdx = input.indexOf(endToken, startIdx + startToken.length);

      if (endIdx !== -1) {
        return input.substring(startIdx + startToken.length, endIdx);
      }
    }

    return null;
  }

  static extractOutputSections(
    section: SubSection,
    output: string
  ): SubSection {
    let newText = Composer.getTextBetweenTokens(
      output,
      section.title + "\n\n",
      "#"
    );
    if (!newText) {
      newText = Composer.getTextBetweenTokens(
        output,
        section.title + "\n\n",
        "---"
      );
    }
    if (!newText) newText = "FAIL";

    section.historic.push(newText);

    let newSubsections: SubSection[] = [];
    for (let s of section.subSections) {
      let newS = Composer.extractOutputSections(s, output);
      newSubsections.push(newS);
    }
    section.subSections = newSubsections;
    return section;
  }

  static makeQuestionId(str: string) {
    //Slugify
    return str
      .toLowerCase()
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/[^\w\-]+/g, "") // Remove non-word characters except hyphens
      .replace(/\-\-+/g, "-") // Replace consecutive hyphens with a single hyphen
      .replace(/^-+/, "") // Remove leading hyphens
      .replace(/-+$/, "");
  }
}
