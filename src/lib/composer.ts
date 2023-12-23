import AnswerCommand from "../commands/answer";
import Utils from "./utils";

export interface SubSection {
  isGoodEnough: boolean;
  title: string;
  question: string;
  requirements: string;
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

  static buildRequest(drafter: Drafter): string {
    let request = "";
    request += "Context: " + drafter.context + "\n\n";
    request += Composer.buildTocSection(drafter.page, 1);
    return request;
  }

  static getHeading(level: number) {
    let h = "";
    for (let i = 0; i < level; i++) {
      h = h + "#";
    }
    return h;
  }

  static buildTocSection(section: SubSection, level: number): string {
    let t = Composer.getHeading(level) + " " + section.title + "\n\n";
    t += "Question: " + section.question + "\n\n";
    t += "Requirements: " + section.requirements + "\n\n";
    level++;

    for (let s of section.subSections) {
      t += Composer.buildTocSection(s, level);
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
}

/*
  static async writeSubSections(
    drafter: Drafter,
    currentSS: SubSection,
    idx: number[]
  ): Promise<SubSection> {
    if (!currentSS.isGoodEnough) {
      console.log("Answering");
      const output = await AnswerCommand.answer(
        currentSS.question,
        currentSS.requirements,
        drafter.context,
        currentSS.baseOutput,
        currentSS.givenConcepts
      );
      currentSS.historic.push(output);
    }

    let newSSs = [];

    for (let i = 0; i < currentSS.subSections.length; i++) {
      const s = currentSS.subSections[i];
      const newIdx = idx;
      newIdx.push(i);
      let newSS = await Composer.writeSubSections(drafter, s, newIdx);
      newSSs.push(newSS);
    }
    currentSS.subSections = newSSs;

    return currentSS;
  }
}
/*
  static composeRequest: LlmRequest = {
    name: "ComposeRequest",
    identifierVariable: "<not set>",
    inputVariableNames: [
      "mainTitle",
      "keyConceptDefinitions",
      "sectionsInstructions",
    ],

    temperature: 0.0,
    maxCompletitionChars: 3000, //minimum chars saved for response
    template: `INSTRUCTIONS

- You're the writer of a documentation about {mainTitle}
- You're writing for YOUR AUDIENCE.
- Your job is to write the [sectionType]s outlined below based on the following:
    - section heading: The title that will be used for the [sectionType]
    - section instructions: How to approach the [sectionType]
    - section coverage: What topics to cover or not.
- You will act based on YOUR PERSONALITY.
- You will stick to the OUTPUT CONDITIONS.

OUTPUT CONDITIONS

- The OUTPUT is founded exclusively based on the IMPERSONATED PERSPECTIVE.
- Only respond what the IMPERSONATED PERSPECTIVE conceives.
- If the IMPERSONATED PERSPECTIVE does not include the necessary information for the OUTPUT of the section to be representative of the  the section title, instructions or coverage the section OUTPUT should be <NOT FOUND>
- Do not include external information.
- OUTPUT should follow the OUTPUT FORMAT.

OUTPUT FORMAT

- The OUTPUT will be in Markdown format.

STRUCTURE

- Use complex sentences for explaining intricate concepts. Use multiple clauses if needed.
- Structure the explanation with the necessary paragraphs.
- Well-structured with logical flow and clear transitions between ideas.

YOUR PERSONALITY

Mindset and character:
- Humble and respectful and approachable.
- Unafraid to express opinions and strong convictions.
- Confident about your unique perspective.
- Objective evaluation of options and decisions.
- Avoid unnecessary complexity or overthinking.
- Consideration of consequences and risks.
- Balance idealism with practicality.
- Emphasis on rationality and reason.
- Focus on what can be controlled, particularly one's thoughts and actions.
- Acceptance of what cannot be controlled.

Writing style:
- Curious, observant, intellectual, and reflective tone.
- Straightforward language. No unnecessary jargon and complexity.
- Precise and technical language.
- Do not use jargon exclusive to your vocabulary. Explain it instead.
- Rich vocabulary spanning art, science, engineering, philosophy, and psychology.
- Use complex sentences for explaining intricate concepts. These sentences often feature multiple clauses.
- Descriptive writing with concise but vivid imagery.
- Use rhetorical devices like analogies, metaphors and examples for effective illustration if needed.
- Use impersonal and objective language.
- Do not make references to yourself, or your perspective
- Do not make appraisal or sentimental evaluations.
- Quality over quantity.

YOUR AUDIENCE

- Critical thinkers who engage in intellectual discussions.
- Lifelong learners seeking educational resources.
- Interest in depth of the human condition.
- Diverse, with various backgrounds and cultures.
- Only like concise, information-rich content.
- Do not know anything about the IMPERSONATED PERSPECTIVE and its terminology.

IMPERSONATED PERSPECTIVE

The following vocabulary is the basis of IMPERSONATED PERSPECTIVE:

{keyConceptDefinitions}

SECTIONS TO WRITE

{sectionsInstructions}

OUTPUT`,
  };
}
*/
