import { Document } from "langchain/document";
import DirectSearch from "./directSearch";
import {
  LlmRequest,
  LlmRequest2,
  SEARCH_ORIGIN_BACKLINK,
  SEARCH_ORIGIN_DIRECT,
  SEARCH_ORIGIN_SEMANTIC,
  buildContextPromptFromDocs,
  callLlm,
  callLlm2,
  filterDocsByConfindence,
  getContextDocsForConcept,
  openAIMaxTokens,
  openAITokenPerChar,
  sortDocsByConfidence,
} from "./llm";
import SemanticSearch from "./semanticSearch";
import Tokenizer from "./tokenizer";
import Utils from "./utils";
import DefinerStore, { Definition, KeyValuePair } from "./definerStore";
import { uniqBy } from "@oclif/plugin-help/lib/util";

export default class Definer {
  /* static getLiteralIntensionsByIid = async (
    nameWithoutHyphen: string,
    withHyphen: boolean
  ): Promise<string[]> => {
    const iid = await DirectSearch.getIidByName(nameWithoutHyphen);

    const contextDocs = await DirectSearch.getAllDocsOfIid(iid, withHyphen);

    if (contextDocs.length == 0) {
      console.log("🔴 " + nameWithoutHyphen + " not found");
      return [];
    }

    console.log("JERE");
    console.log(contextDocs.length);
    console.log(contextDocs);

    if (contextDocs.length == 1) {
      if ((contextDocs[0].pageContent = "")) {
        console.log("🟡 " + nameWithoutHyphen + " exists but not is defined");
        return [];
      }
    }

    console.log("HELLO");
    console.log("🟢 " + nameWithoutHyphen + "  defined. ");
    console.log("BYE");
    //let contextPrompt = buildContextPromptFromDocs(contextDocs);
    let intensions = Definer.docsToIntensions(contextDocs);
    return intensions;
  };
  */

  static docsToIntensions(docs: Document<Record<string, any>>[]): string[] {
    let intensions: string[] = [];

    docs.forEach((r) => {
      intensions.push(r.pageContent);
    });

    return intensions;
  }

  static getInferredIntenionsFromBacklinks = async (
    concept: string
  ): Promise<string> => {
    const inferMeaningRequest: LlmRequest = {
      nameId: "inferMeaning",
      temperature: 0.2,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `- In the following occurrances an unknown term ${Tokenizer.unknownTermToken} is used.
- Find commonalities betwen X usage in occurance and abstract them.
- Use one bullet point per abstraction to define what ${Tokenizer.unknownTermToken} is.
- Rely strictly on the provided occurrences, without including external information.
- Be technical. Preserve used jargon. Preserve "${Tokenizer.hyphenToken}". Don't start sentences with uppercase.    
Ocurrances:
###
{context}
        
${Tokenizer.unknownTermToken}:`,
    };

    const contextDocs = await getContextDocsForConcept(
      concept,
      [SEARCH_ORIGIN_BACKLINK] //searchOrigins
    );

    if (contextDocs.length == 0) {
      console.log("No backlink statements for " + concept);
      return "";
    }

    let contextPrompt = buildContextPromptFromDocs(contextDocs);

    //Anonimize concept
    const conceptWithHyphen = Utils.renameToHyphen(concept);

    //Replace concept with X
    contextPrompt = contextPrompt.replace(
      new RegExp(conceptWithHyphen, "g"),
      Tokenizer.unknownTermToken
    );

    let llmRequest = inferMeaningRequest;

    let out = await callLlm(llmRequest, concept, contextPrompt);

    out = out.replace(
      new RegExp(Tokenizer.unknownTermToken, "g"),
      conceptWithHyphen
    );
    return "Backlinks\n" + out;
  };

  static getDefinitionKeyConcepts = async (
    concept: string,
    definition: string
  ): Promise<string[]> => {
    const keyConceptsRequest: LlmRequest = {
      nameId: "definitionKeyConcepts",
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `- The following is a particular definition of "{mu}"
- List the top words in the definition that are prerequisits to understand "{mu}".
- Prioritize words that are rare, use "${Tokenizer.hyphenToken}" or are fundamental to have a comprehensive understanding.
- Be technical. Preserve used jargon. Preserve "${Tokenizer.hyphenToken}".
- Output a comma separated list without. Do not put a "." at the end.
- Transform the words to its singular form.

Definition of "{mu}":
{context}

Top words:`,
    };

    let out = await callLlm(keyConceptsRequest, concept, definition);
    return out.split(", ");
  };

  static getDefinitionScoredConcepts = async (
    concept: string,
    definition: string,
    keyConcepts: string[]
  ): Promise<KeyValuePair[]> => {
    const terms = keyConcepts.join(", ");

    const keyConceptsWithScoreRequest: LlmRequest2 = {
      inputVariableNames: ["concept", "conceptDefinition", "terms"],
      inputVariables: {
        concept: concept,
        conceptDefinition: definition,
        terms: terms,
      },
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `- The following is a particular definition of "{concept}"
- Score the following list of Terms, prerequisits to understand "{concept}".
    - Score from 0 to 1 based on their prerequisit-score.
    - The prerequisit-score is higher if:
        - It uses "${Tokenizer.hyphenToken}" (hyphen).
        - It is rare.
        - It is fundamental to have a comprehensive understanding of {concept}.
        - It is technical.
        - Are used more than once
    - The prequisit-score is lower if:
        - It is used as example.
- Output a list JSON array of objects with terms (k) and its prerequist-score (v).
    - Be technical. Preserve used jargon. Preserve "${Tokenizer.hyphenToken}".
    - Transform each word to its singular form.
    - Use the format: {{"k": "apple", "v": 0.7}}

Definition of "{concept}":
{conceptDefinition}

Terms to score:
{terms}

JSON array of terms with prerequisit-score:
[`,
    };

    let out = "[" + (await callLlm2(keyConceptsWithScoreRequest));
    console.log(out);
    return JSON.parse(out) as KeyValuePair[];
  };

  static getTextRelatedConceptsRequest = async (
    context: string
  ): Promise<KeyValuePair[]> => {
    const guessedScoredConcepts: LlmRequest2 = {
      inputVariableNames: ["context"],
      inputVariables: {
        context: context,
      },
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `"INSTRUCTIONS
Suggest:
- concepts and ideas that may be related to the TEXT.
- concepts and ideas in the TEXT.
- key words in the TEXT
- concepts and ideas that can capture the meaning of the TEXT in different words.

Output a list JSON array of objects with concept (k) and its prerequist-score (v).
- Write in singular and lower-case.
- Score from 0 to 1 based on its relevancy to the TEXT.
- Use the format: {{"k": "apple", "v": 0.7}}

TEXT
{context}
.
CONCEPTS`,
    };

    let json = await callLlm2(guessedScoredConcepts);
    let out = JSON.parse(json) as KeyValuePair[];
    for (let kv of out) {
      kv.v = Utils.mapRange(kv.v, 0, 1, 0.5, 1);
    }
    return out;
  };

  static guessTextKeyConcepts = async (
    text: string
  ): Promise<KeyValuePair[]> => {
    //Get scored list of related concepts
    const relatedConceptScored = await Definer.getTextRelatedConceptsRequest(
      text
    );

    console.log("Guessed key words");
    console.log(relatedConceptScored);

    let allDocs: Document<Record<string, any>>[] = [];
    for (let concept of relatedConceptScored) {
      //We get all the docs related to the semantic search
      let docsForConcept = await getContextDocsForConcept(concept.k, [
        SEARCH_ORIGIN_SEMANTIC,
      ]);

      // we give the doc the score
      // we recalculate confidence based on that.
      for (let d of docsForConcept) {
        d.metadata.textRelevanceScore = concept.v;
        d.metadata.confidence = d.metadata.confidence * concept.v;
      }

      allDocs = allDocs.concat(docsForConcept);
    }

    allDocs = sortDocsByConfidence(allDocs);
    allDocs = filterDocsByConfindence(allDocs, 0.6);

    let guessedConcepts: KeyValuePair[] = [];

    for (let d of allDocs) {
      guessedConcepts.push({ k: d.metadata.name, v: d.metadata.confidence });
    }

    //guessedConcepts = [...new Set(guessedConcepts)]; //remove duplicates
    return Definer.removeRepeatsAndNormalizeScore(guessedConcepts);
  };

  static removeRepeatsAndNormalizeScore(
    concepts: KeyValuePair[]
  ): KeyValuePair[] {
    concepts.sort((a, b) => {
      let A = a.k.split(Tokenizer.hyphenToken).join();
      let B = b.k.split(Tokenizer.hyphenToken).join();
      if (A < B) return -1;
      if (A > B) return 1;
      return 1;
    });

    let uniques: KeyValuePair[] = [];
    let prevKey = "";
    let count = 1;
    let hv = 0;

    console.log(concepts);

    //increases k.v base on repetitions, taking the highest score as base
    let prevC = { k: "", v: 0 };
    for (let i = 0; i < concepts.length; i++) {
      let c = concepts[i];
      if (c.k != prevC.k || i == concepts.length - 1) {
        //calculate the previous
        if (prevC.v > hv) hv = prevC.v; // get the highest score
        let f = 1 + Math.log(count) * 0.1; // 2x = 1.0693, 10x = 1.2
        let v = hv * f;
        if (v > 1) v = 1;

        //console.log(prevC);
        //console.log(count + " " + v);
        uniques.push({ k: prevC.k, v: v });
        prevC = c;
        count = 1;
        hv = 0;
      } else {
        count++;
      }
    }

    return uniques;
  }

  static respondQuestion = async (
    mu: string, // question
    context: string // allDefintions
  ): Promise<string> => {
    const questionWithDefinitions: LlmRequest = {
      nameId: "respond",
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `INSTRUCTIONS

- You will give a RESPONSE to YOUR AUDIENCE about the QUESTION they asked.
- You will act based on YOUR PERSONALITY.
- Your RESPONSE is founded exclusively based on the IMPERSONATED PERSPECTIVE.
- You will stick to the RESPONSE CONDITIONS.

RESPONSE CONDITIONS

- Only respond what the IMPERSONATED PERSPECTIVE concieves.
- If you don't have a meaningful insight, do not respond. Suggest to frame the question differently instead.
- Respond strictly based on the IMPERSONATED PERSPECTIVE.
- Exclude from the RESPONSE elements of the IMPERSONATED PERSPECTIVE that are no relevant to the QUESTION.
- Do not include external information.
- Quality over quantity.
- Delve deep into the QUESTION.
- Strictly respond to the QUESTION.
- Extend the response only if a mentioned requires clarification.
- Your goal is to bring clarity to the QUESTION through reasoning based on IMPERSONATED PERSPECTIVE.
- Provide in-depth, thoughtful RESPONSE.

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
- Acceptance of what cannot be controlled.
- Focus on what can be controlled, particularly one's thoughts and actions.

Structure
1. Start the RESPONSE general and accessible ideas.
2. Proceed by adding more resolution,
3. Continue adding details until all the nuances and details of QUESTION are fully covered.

- Use a logical flow and clear transitions between ideas.
- Use complex sentences for explaining intricate concepts. Use multiple clauses if needed.
- Structure the explanation with the necessary paragraphs.


Writing style:
- Curious, observant, intellectual, and reflective tone.
- Straightforward language. No unnecessary jargon and complexity.
- Precise and technical language.
- Do not use jargon exclusive to your vocabulary. Explain it instead.
- Rich vocabulary spanning art, science, engineering, philosophy, and psychology.
- Use complex sentences for explaining intricate concepts. These sentences often feature multiple clauses.
- Well-structured with logical flow and clear transitions between ideas.
- Descriptive writing with concise but vivid imagery.
- Occasionally use rhetorical devices like analogies and metaphors for effective illustration.
- Use impersonal and objective language.
- Do not make references to yourself, or your perspevtive
- Do not make appraisal or sentimental evaluations.

YOUR AUDIENCE

- Critical thinkers who engage in intellectual discussions.
- Lifelong learners seeking educational resources.
- Interest in depth of the human condition.
- Diverse global community with various backgrounds and cultures.
- Only like concise, information-rich content.
- Do not know anything about your particular perspective and vocabulary.

IMPERSONATED PERSPECTIVE

The following vocabulary is the basis of IMPERSONATED PERSPECTIVE:

{context}

QUESTION

{mu}

RESPONSE`,
    };

    let out = await callLlm(questionWithDefinitions, mu, context);
    return out;
  };

  static respondQuestion2 = async (
    textType: string,
    topic: string,
    targetAudience: string,
    style: string,
    perspective: string
  ): Promise<string> => {
    const writeWithStyle: LlmRequest2 = {
      inputVariableNames: [
        "textType",
        "topic",
        "targetAudience",
        "style",
        "perspective",
      ],
      inputVariables: {
        textType: textType,
        topic: topic,
        targetAudience: targetAudience,
        style: style,
        perspective: perspective,
      },
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `
Write {textType} about: {topic}.
Do it for {targetAudience} in the style of {style}, capturing its tone, voice, vocabulary and sentence structure.
The {textType} is exclusively based on your unique understanding of certain topics (perspective) outlined below.
      
YOUR PERSPECTIVE
{perspective}

RESPONSE`,
    };

    let out = await callLlm2(writeWithStyle);
    return out;
  };

  static intensionsToText(intensions: string[]): string {
    let text = "";
    intensions.forEach((i) => {
      text = text + Tokenizer.beginingOfStatementToken + " " + i + "\n";
    });
    return text;
  }

  static requestKeyConceptsSynthesis = async (
    term: string,
    termDefiningIntensions: string,
    termUsageContext: string,
    termKeyConceptsDefinitions: string
  ): Promise<string> => {
    const compiledFriendlyRequest: LlmRequest2 = {
      inputVariableNames: [
        "term",
        "termDefiningIntensions",
        "termUsageContext",
        "termKeyConceptsDefinitions",
        "perspective",
      ],
      inputVariables: {
        term: term,
        termDefiningIntensions: termDefiningIntensions,
        termUsageContext: termUsageContext,
        termKeyConceptsDefinitions: termKeyConceptsDefinitions,
      },
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `INSTRUCTIONS

- You act as a resarcher assistant in charge of providing comprehensive background knowledge for YOUR AUDIENCE, so they can fully understand the deep meaning of "{term}" when reading its TERM DEFINITION.
- TERM DEFINITION defines what "{term}" is.
- USED CONCEPTS DEFINITIONS are concepts used to define "{term}".
- Output a non-numerated list of SYNTHESIS IDEAS NOT INCLUDED IN TERM DEFINITION.
    - Include synthesis of the ideas within the USED CONCEPTS DEFINITIONS that are necessary to have a deep conceptual comprehension of "{term}".
    - Include explanations of the relationships and dependencies between "{term} and key concepts and in between key concepts.
    - Do not include ideas that already exist in TERM DEFINITION.
- Do not use any external information.
- Use straightforward language. No unnecessary jargon and complexity.
- Use impersonal and objective language.
- Use precise and technical language.
- A synthesis is made of complex sentences that explain the intricate details, relationships and ideas of the concept relevant to understand "{term}".  Sentences feature as many clauses as needed.

TERM DEFINTIION

{termDefiningIntensions}

USED CONCEPTS DEFINITIONS

The following are definitions of concepts used to define "{term}" that may be prerequisists to understand "{term}".

{termKeyConceptsDefinitions}

SYNTHESIS IDEAS NOT INCLUDED IN TERM DEFINITION`,
    };

    let out = await callLlm2(compiledFriendlyRequest);
    return out;
  };
}
//- Explore interesting ideas in detail but make sure you are responding to the question.

//- Explain the necessary meaning behind concepts when necessary. Express it inline, then continue answering the question.
/*template: `- Identify the top words that are prerequisits to understand "{mu}" based on the following definition.
- Rate the rarity of each word from very common (0), to used in specific domains (0.5), to extremely technical or unnexisten (1), and everything in between.
- Attribute a percentage (from 0 to 1) for how integral is the word in order to comprehend "{mu}" in relation to the rest of the words. The sum of all the top words "integrity" must be 1
- Return a JSON array of objects containing: word, rarity, integral

Definition of "{mu}":
{context}

JSON object of key concepts:`,*/

//Synthesis
//Background knowledge
// conceptual comprehension
