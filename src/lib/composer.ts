import AnswerCommand from "../commands/answer";
import Utils from "./utils";

export interface SubSection {
  isGoodEnough: boolean;
  title: string;
  request: string;
  guidelines: string;
  givenConcepts: string[];
  baseOutput: string;
  historic: string[];
  subSections: SubSection[];
}

export interface Drafter {
  context: string;
  subSections: SubSection[];
}

export default class Composer {
  static loadDrafter(uri: string) {
    const drafterStr = Utils.getFile(uri);
    const drafter: Drafter = JSON.parse(drafterStr) as Drafter;
    return drafter;
  }

  static async writeSubSections(
    drafter: Drafter,
    currentSS: SubSection,
    idx: number[]
  ): Promise<SubSection> {
    console.log("Here " + idx);
    if (!currentSS.isGoodEnough) {
      console.log("Answering");
      const output = await AnswerCommand.answer(
        currentSS.request,
        currentSS.guidelines,
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
