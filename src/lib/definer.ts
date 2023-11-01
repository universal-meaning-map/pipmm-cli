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
} from "./llm";
import SemanticSearch from "./semanticSearch";
import Tokenizer from "./tokenizer";
import Utils from "./utils";
import DefinerStore, { Definition, KeyValuePair } from "./definerStore";

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
    definition: string
  ): Promise<KeyValuePair[]> => {
    const keyConceptsRequest: LlmRequest = {
      nameId: "definitionKeyConcepts",
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `- The following is a particular definition of "{mu}"
- Score the top words in the definition that are prerequisits to understand "{mu}".
    - Score from 0 to 1 based on their prerequisit-score.
    - The prerequisit-score is higher if:
        - It uses "${Tokenizer.hyphenToken}" (hyphen).
        - It is rare.
        - It is fundamental to have a comprehensive understanding of {mu}.
        - It is technical.
        - Are used more than once
    - The prequisit-score is lower if:
        - It is used as example.
- Output a list JSON array of objects with words (k) and its prerequist-score (v).
    - Be technical. Preserve used jargon. Preserve "${Tokenizer.hyphenToken}".
    - Transform each word to its singular form.
    - Use the format: {{"k": "apple", "v": 0.7}}

Definition of "{mu}":
{context}

JSON array of words with prerequisit-score:
[`,
    };

    let out = "[" + (await callLlm(keyConceptsRequest, concept, definition));
    return JSON.parse(out) as KeyValuePair[];
  };

  static getQuestionKeyConcepts = async (
    definition: string
  ): Promise<string[]> => {
    const keyConceptsRequest: LlmRequest = {
      nameId: "questionKeyConcepts",
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `"INSTRUCTIONS
- List the key words in the following text.
- Output a comma separated list without. Do not put a "." at the end.

TEXT:
{context}

KEY IDEAS:`,
    };

    let out = await callLlm(keyConceptsRequest, "", definition);
    return out.split(", ");
  };

  static getTextKeyMeaningUnits = async (text: string): Promise<string[]> => {
    let docs: Document<Record<string, any>>[] = [];

    //KEY CONCEPTS
    const keyWords = await Definer.getQuestionKeyConcepts(text);

    for (let word of keyWords) {
      let wordDocs = await getContextDocsForConcept(word, [
        SEARCH_ORIGIN_SEMANTIC,
      ]);

      wordDocs = filterDocsByConfindence(wordDocs, 0.7);
      docs = docs.concat(wordDocs);
    }

    let keyMus: string[] = [];

    for (let d of docs) {
      keyMus.push(d.metadata.name);
    }
    keyMus = [...new Set(keyMus)]; //remove duplicates
    return keyMus;
  };

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
      nameId: "respond",
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

  static getCompiledFriendlyDefinitionRequest = async (
    term: string,
    termDefiningIntensions: string,
    termUsageContext: string,
    termKeyConceptsDefinitions: string
  ): Promise<string> => {
    const compiledFriendlyRequest: LlmRequest2 = {
      nameId: "respond",
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

You job is to provide the most extensive definition of TERM based on the following instructions.
- You will act based on YOUR PERSONALITY.
- Infer the meaning of TERM only based on a deep conceptual comprehension of:
    - The TERM DEFINING INTENSIONS which are the more defining qualities of TERM.
    - The TERM KEY CONCEPTS DEFINITIONS which are definitions of concepts that are integral to the understanding of TERM.
    - TERM USAGE CONTEXT. Which are examples of how TERM is used
- Give a full comprehensive definition of TERM based on the inferred meaning.

STRUCTURE

1. Start the RESPONSE a general and accessible idea of what TERM is.
2. Proceed by adding more resolution,
3. Continue adding details until all the nuances and details of TERM are covered.

- Use a logical flow and clear transitions between ideas.
- Use complex sentences for explaining intricate concepts. Use multiple clauses if needed.
- Structure the explanation with the necessary paragraphs.

EXTENSION

- The RESPONSE is founded exclusively based on: 
    - TERM DEFINING INTENSIONS
    - TERM KEY CONCEPTS DEFINITIONS
    - TERM USAGE CONTEXT
- Do not include external information.
- Quality over quantity.
- Delve deep into the QUESTION to provide in-depth, thoughtful RESPONSE.

WRITING STYLE

- Curious, observant, intellectual, and reflective tone.
- Straightforward language. No unnecessary jargon and complexity.
- Precise and technical language.
- Do not use jargon exclusive to your vocabulary. Explain it instead.
- Rich vocabulary spanning art, science, engineering, philosophy, psychology, semantics, semiotics and others.
- Descriptive writing with concise but vivid imagery.
- Occasionally use rhetorical devices like analogies and metaphors for effective illustration.
- Use impersonal and objective language. Do not make references to yourself, or your perspective
- Do not make appraisal or sentimental evaluations.

YOUR AUDIENCE

- Critical thinkers who engage in intellectual discussions.
- Lifelong learners seeking educational resources.
- Interest in depth of the human condition.
- Diverse global community with various backgrounds and cultures.
- Only like concise, information-rich content.
- Do not know anything about your particular perspective and vocabulary.

TERM

{term}

TERM DEFINING INTENSIONS

{termDefiningIntensions}

TERM USAGE CONTEXT

{termUsageContext}

TERM KEY CONCEPTS DEFINITIONS

The following vocabulary is the basis of TERM KEY CONCEPTS DEFINITIONS:

{termKeyConceptsDefinitions}

QUESTION

What is {term}?

RESPONSE`,
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
