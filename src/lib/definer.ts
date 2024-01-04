import { Document } from "langchain/document";
import {
  LlmRequest,
  ModelConfig,
  GPT4,
  SEARCH_ORIGIN_BACKLINK,
  SEARCH_ORIGIN_SEMANTIC,
  callLlm,
  GPT4TURBO,
} from "./llm";
import Tokenizer from "./tokenizer";
import Utils from "./utils";
import { ConceptScore } from "./definerStore";
import { ChainValues } from "langchain/dist/schema";
import DocsUtils from "./docsUtils";
export default class Definer {
  static docsToIntensions(docs: Document<Record<string, any>>[]): string[] {
    let intensions: string[] = [];
    if (docs == undefined) return [];

    docs.forEach((r) => {
      intensions.push(r.pageContent);
    });

    return intensions;
  }

  static getInferredIntenionsFromBacklinks = async (
    concept: string
  ): Promise<string> => {
    const contextDocs = await DocsUtils.getContextDocsForConcept(
      concept,
      [SEARCH_ORIGIN_BACKLINK] //searchOrigins
    );

    if (contextDocs.length == 0) {
      console.log("No backlink Notions for " + concept);
      return "";
    }

    let contextPrompt = DocsUtils.buildContextPromptFromDocs(contextDocs);

    //Anonimize concept
    const conceptWithHyphen = Utils.renameToHyphen(concept);

    //Replace concept with X
    contextPrompt = contextPrompt.replace(
      new RegExp(conceptWithHyphen, "g"),
      Tokenizer.unknownTermToken
    );

    const inputVariables: ChainValues = {
      contextPrompt: contextPrompt,
    };
    const request: LlmRequest = {
      name: "Infer intensions",
      identifierVariable: concept,
      inputVariableNames: ["context"],
      temperature: 0.2,
      maxCompletitionChars: 3000,
      maxPromptChars: 0,
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

    let out = await callLlm(GPT4, request, inputVariables);

    out = out.replace(
      new RegExp(Tokenizer.unknownTermToken, "g"),
      conceptWithHyphen
    );
    return "Backlinks\n" + out;
  };

  /*
  static getDefinitionKeyConcepts = async (
    concept: string,
    definition: string
  ): Promise<string[]> => {
    const inputVariables: ChainValues = {
      concept: concept,
      conceptDefinition: definition,
    };
    const keyConceptsRequest: LlmRequest2 = {
      inputVariableNames: ["concept", "conceptDefinition"],
      temperature: 0.0,
      minCompletitionChars: 3000, //minimum chars saved for response
      template: `- The following is a particular definition of "{concept}"
- List the top words in the definition that are prerequisits to understand "{concept}".
- Prioritize words that are rare, use "${Tokenizer.hyphenToken}" or are fundamental to have a comprehensive understanding.
- Be technical. Preserve used jargon. Preserve "${Tokenizer.hyphenToken}".
- Output a comma separated list without. Do not put a "." at the end.
- Transform the words to its singular form.

Definition of "{concept}":
{definition}

Top words:`,
    };

    let out = await ca  lm2(GPT4, keyConceptsRequest, inputVariables);
    return out.split(", ");
  };
*/
  static getDefinitionScoredConcepts = async (
    concept: string,
    definition: string,
    keyConcepts: string[]
  ): Promise<ConceptScore[]> => {
    const terms = keyConcepts.join(", ");
    const inputVariables: ChainValues = {
      concept: concept,
      conceptDefinition: definition,
      terms: terms,
    };

    if (definition == "") {
      console.log("Score  " + concept + " " + "had empty definition");
      return [];
    }

    const request: LlmRequest = {
      name: "Score def concepts",
      identifierVariable: concept,
      inputVariableNames: ["concept", "conceptDefinition", "terms"],
      temperature: 0.0,
      maxCompletitionChars: 8000, //minimum chars saved for response
      maxPromptChars: 0,
      template: `- The following is a particular definition of "{concept}"
- Score the following list of Terms, prerequisits to understand "{concept}".
    - Score from 0 to 1 based on their prerequisit-score (2 decimal precision).
    - The prerequisit-score is higher if:
        - It uses "${Tokenizer.hyphenToken}" (hyphen).
        - It is rare.
        - It is fundamental to have a comprehensive understanding of {concept}.
        - It is technical.
        - Are used more than once
    - The prequisit-score is lower if:
        - It is used as example.
- Output a valid JSON object with an array of objects named "scores" with concept (c) and its prerequist-score (s).
    - Do not write the JSON object inside Markdown code syntax.
    - Be technical. Preserve used jargon. Preserve "${Tokenizer.hyphenToken}".
    - Transform each word to its singular form.
    - Use the format: {{"c": "apple", "s": 0.75}}

Definition of "{concept}":
{conceptDefinition}

Terms to score:
{terms}

JSON array of terms with prerequisit-score:
`,
    };

    let j = await callLlm(GPT4TURBO, request, inputVariables);

    try {
      const scores = JSON.parse(j).scores as ConceptScore[];
      for (let cs of scores) {
        cs.s = Utils.mapRange(cs.s, 0, 1, 0.5, 1);
      }

      return scores;
    } catch (e) {
      console.log(e);
      return [];
    }
  };

  static getTextRelatedConceptsRq = async (
    model: ModelConfig, //USE GPT3.5TURBO or GPT4. GPT4Turbo can't recongize unique terms like "minfromation"
    text: string
  ): Promise<ConceptScore[]> => {
    if (!text) return [];
    const inputVariables: ChainValues = {
      text: text,
    };
    const guessedScoredConcepts: LlmRequest = {
      name: "Score text rel. concepts",
      identifierVariable: text,
      inputVariableNames: ["text"],
      temperature: 0.0,
      maxCompletitionChars: 3000, //minimum chars saved for response
      maxPromptChars: 0,
      template: `"INSTRUCTIONS
- Your goal is to rate concepts and ideas that important in TEXT.
- TEXT uses unique unusual words. They are not misspelled. 

1. Suggest key ideas in the TEXT
- A key idea is:
    - important words in TEXT.
    - a technical term.
    - an unusual or strange or misspelled word.
    - ideas that are not in the text but maybe releated.
    - concepts contained in the TEXT.
    - ideas that can capture the meaning of the TEXT in different words.
2. Score each idea.
    - Score from 0 to 1 based on its relevancy to the TEXT (2 decimal precision).
    - Relevancy is calculated based:
        - How much of a prerequisit is to understand TEXT
        - How unique the idea is.

Output:
- A JSON object with an "scores" object containing an array of objects with concept (c) and its relevancy score (s) as fields.
- JSON signature:
    {{
        "scores":[
            {{ "c": "apple", "s": 0.75 }}
        ]
    }} 
- Do not write the JSON object inside Markdown code syntax.
- Write in singular and lower-case.

TEXT
{text}
.
JSON`,
    };

    let json = await callLlm(model, guessedScoredConcepts, inputVariables);

    try {
      const out = JSON.parse(json);
      const scores = out.scores as ConceptScore[];
      for (let cs of scores) {
        cs.s = Utils.mapRange(cs.s, 0, 1, 0.5, 1);
      }
      return scores;
    } catch (e) {
      console.log(json);
      console.log(e);
      return [];
    }
  };

  static guessMuFromText = async (
    model: ModelConfig,
    text: string
  ): Promise<ConceptScore[]> => {
    //Get scored list of related concepts
    const relatedConceptScored = await Definer.getTextRelatedConceptsRq(
      model,
      text
    );

    console.log("Guessed key words");
    console.log(relatedConceptScored);

    let allDocs: Document<Record<string, any>>[] = [];
    for (let concept of relatedConceptScored) {
      //We get all the docs related to the semantic search
      let docsForConcept = await DocsUtils.getContextDocsForConcept(concept.c, [
        SEARCH_ORIGIN_SEMANTIC,
      ]);

      // we give the doc the score
      // we recalculate confidence based on that.
      for (let d of docsForConcept) {
        d.metadata.textRelevanceScore = concept.s;
        d.metadata.confidence = d.metadata.confidence * concept.s;
      }

      allDocs = allDocs.concat(docsForConcept);
    }

    allDocs = DocsUtils.sortDocsByConfidence(allDocs);
    allDocs = DocsUtils.filterDocsByConfindence(allDocs, 0.6);

    let guessedConcepts: ConceptScore[] = [];

    for (let d of allDocs) {
      guessedConcepts.push({ c: d.metadata.name, s: d.metadata.confidence });
    }

    //guessedConcepts = [...new Set(guessedConcepts)]; //remove duplicates
    return Definer.sortConceptScores(
      Definer.removeRepeatsAndNormalizeScore(guessedConcepts)
    );
  };

  static sortConceptScores(conceptScores: ConceptScore[]): ConceptScore[] {
    conceptScores.sort((a, b) => {
      if (a.s < b.s) return 1;
      return -1;
    });
    return conceptScores;
  }

  static removeRepeatsAndNormalizeScore(
    concepts: ConceptScore[]
  ): ConceptScore[] {
    concepts.sort((a, b) => {
      let A = a.c.split(Tokenizer.hyphenToken).join();
      let B = b.c.split(Tokenizer.hyphenToken).join();
      if (A < B) return -1;
      if (A > B) return 1;
      return 1;
    });

    let uniques: ConceptScore[] = [];
    let count = 1;
    let hv = 0;

    //increases k.v base on repetitions, taking the highest score as base
    let prevC = { c: "", s: 0 };
    for (let i = 0; i < concepts.length; i++) {
      let c = concepts[i];
      if (c.c != prevC.c || i == concepts.length - 1) {
        //calculate the previous
        if (prevC.s > hv) hv = prevC.s; // get the highest score
        let f = 1 + Math.log(count) * 0.1; // 2x = 1.0693, 10x = 1.2
        let s = hv * f;
        if (s > 1) s = 1;

        //console.log(prevC);
        //console.log(count + " " + v);
        uniques.push({ c: prevC.c, s: s });
        prevC = c;
        count = 1;
        hv = 0;
      } else {
        count++;
      }
    }

    return Definer.sortConceptScores(uniques);
  }

  static respondToQuestionRequest: LlmRequest = {
    identifierVariable: "<not set>",
    name: "Respond",
    inputVariableNames: ["question", "definitions"],
    temperature: 0.0,
    maxCompletitionChars: 3000, //minimum chars saved for response,
    maxPromptChars: 0,
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

{definitions}

QUESTION

{question}

RESPONSE`,
  };

  static respondQuestion2 = async (
    model: ModelConfig,
    textType: string,
    topic: string,
    targetAudience: string,
    style: string,
    perspective: string
  ): Promise<string> => {
    const inputVariables: ChainValues = {
      textType: textType,
      topic: topic,
      targetAudience: targetAudience,
      style: style,
      perspective: perspective,
    };
    const writeWithStyle: LlmRequest = {
      name: "!Respond to question (not defined well)",
      identifierVariable: topic,
      inputVariableNames: [
        "textType",
        "topic",
        "targetAudience",
        "style",
        "perspective",
      ],

      temperature: 0.0,
      maxCompletitionChars: 3000, //minimum chars saved for response
      maxPromptChars: 0,
      template: `
Write {textType} about: {topic}.
Do it for {targetAudience} in the style of {style}, capturing its tone, voice, vocabulary and sentence structure.
The {textType} is exclusively based on your unique understanding of certain topics (perspective) outlined below.
      
YOUR PERSPECTIVE
{perspective}

RESPONSE`,
    };

    let out = await callLlm(GPT4, writeWithStyle, inputVariables);
    return out;
  };

  static intensionsToText(intensions: string[]): string {
    let text = "";
    intensions.forEach((i) => {
      if (!i) console.log("Fix me. Intensions to text");
      text = text + Tokenizer.beginingOfStatementToken + " " + i + "\n";
    });
    return text;
  }

  static defBackgroundSynthesisRequest: LlmRequest = {
    name: "Def. Background syntesis",
    identifierVariable: "<not set>",
    inputVariableNames: [
      "term",
      "termDefiningIntensions",
      "termUsageContext",
      "termKeyConceptsDefinitions",
      "perspective",
    ],
    temperature: 0.0,
    maxCompletitionChars: 3000, //minimum chars saved for response

    maxPromptChars: 0,
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
  //You will generate increasingly, entity-dense and relevant to the REQUEST versions of the ORIGINAL TEXT.

  static codRequest: LlmRequest = {
    name: "Increase significance",
    identifierVariable: "<not set>",
    inputVariableNames: ["text", "request", "perspective"],
    temperature: 0.0,
    maxCompletitionChars: 15000, //minimum chars saved for response
    maxPromptChars: 0,
    template: `INSTRUCTIONS

The ORIGINAL TEXT is a response to the REQUEST
Your job is to improve the density of relevant content to meet the REQUEST based the information in the IMPERSONATED PERSPECTIVE.

Rewrite ORIGINAL TEXT to:
- Increase relevancy of information and accuracy to better match the REQUEST.
- Increase entity density.

Repeat the following 2 steps 5 times.
Step 1. Write a PIECE that matches the REQUEST and covers every entity and detail from the previous PIECE plus the missing entities.
Step 2. Identify 1-5 informative entities from the IMPERSONATED PERESPECTIVE which are missing from the previously generated PIECE and are relevant to successfully meet the REQUEST.
A missing entity is:
- relevant to meet the REQUEST,
- specific yet concise (5 words or fewer),
- novel (not in the previous PIECE),
- faithful (present in the IMPERSONATED PERSPECTIVE),
- anywhere (can be located anywhere in the IMPERSONATED PERSPECTIVE).

GUIDELINES:
- Each PIECE should have the same length as the ORIGINAL TEXT. It can be a little longer but never shorter.
- Make every word count: rewrite the previous PIECE to improve flow and make space for additional entities.
- Make space with fusion, compression, and removal of uninformative phrases and fillers.
- The PIECE should become highly information dense and self-contained, i.e., easily understood without the IMPERSONATED PERSPECTIVE.
- Missing entities can appear anywhere in the new PIECE.
- Never drop entities from the previous PIECE. If space cannot be made, add fewer new entities.
- Answer in JSON. The JSON should be a list (length 5) of dictionaries whose keys are "Piece" and "Missing_Entities".

REQUEST

{request}

ORIGINAL TEXT

{text}

IMPERSONATED PERSPECTIVE

The following vocabulary is the basis of IMPERSONATED PERSPECTIVE:

{perspective}`,
  };

  static successionRequest: LlmRequest = {
    name: "Succession",
    identifierVariable: "<not set>",
    inputVariableNames: ["request", "perspective"],
    temperature: 0.0,
    maxCompletitionChars: 20000, //minimum chars saved for response
    maxPromptChars: 0,
    template: `GOAL
- The ultimate goal is to create a writing composition in response to the REQUEST. COMPOSITION from now on.
    
INSTRUCTIONS
- You will follow all the STEPS (8) to progressively create the foundations of the COMPOSITION.
- All your responses are based on IMPERSONATED PERSPECTIVE, unless explicitly said the opposite.
- IMPERSONATED PERSPECTIVE may contain some information that is not relevant to the request and you need to discard.
- The relevant information may be anywhere in the IMPERSONATED PERSPECTIVE.
- Only write what is instructed under the "Output:" section of each Step.
- Answer with a JSON object.
- The JSON object should not be inside Makrdown code.
- The JSON object will have with the following signature:
{{
    "Output 0":{{<Step 0 object>}},
    "Output 1":{{<Step 1 object>}},
    "Output 2":{{<Step 2 object>}},
    "Output 3":{{<Step 3 object>}},
    "Output 4":{{<Step 4 object>}},
    "Output 5":{{<Step 5 object>}},
    "Output 6":{{<Step 6 object>}},
    "Output 7":{{<Step 7 object>}},
    "Output 8":{{<Step 8 object>}},
}}

STEPS

Step 0. Rewrite REQUEST as a single question
    Guidelines:
    - It will serve as a title and main question.
    - A title must be in a question form.
    - The title can be a complex clause if needed, but cannot be over complicated.
    Output:
    - Write the main question.
    Format:
    - A string

Step 1. Generate Refinement Questions
    Guidelines:
    - Generate good Refinement Questions about the REQUEST.
    - Do not base them on IMPERSONATED PERSPECTIVE.
    Output:
    - A list of 7 Refinement Questions.
    Format:
    - An array of strings.

Step 2. Synthesise questions
    Guidelines:
    - Missing Question: If one single foundational Refinement Question can be added into Output 1 what will it be? to 
    - Rewrite questions:
        - Rewrite Output 1 in order to accomodate Missing Question
        - The list should cover the same scope as Output 1 and Missing Question together in just 7 questions without simply combining multiple questions into one.
        - Synthesise questions to abstract the relevant patterns in one or more questions into a new patter that capture them all.
    
    Output:
    - Missing Question and Rewriten Questions .
    Format:
    - A JSON object with the fields "Missing Question"(string) and  "Rewriten Questions" (string array)

Step 3. Synthesise questions
    Guidelines:
    - Missing Question: If one single foundational Refinement Question can be added into Output 2 Rewritten Questions what will it be? to 
    - Rewrite questions:
        - Rewrite  "Output 2 Rewritten Questions" in order to accomodate Missing Question
        - The list should cover the same scope as "Output 2 Rewritten Questions" and Missing Question together in just 7 questions without simply combining multiple questions into one.
        - Synthesise questions to abstract the relevant patterns in one or more questions into a new patter that capture them all.
    
    Output:
    - Missing Question and Rewriten Questions .
    Format:
    - A JSON object with the fields "Missing Question"(string) and  "Rewriten Questions" (string array)


Step 4. Synthesise questions
    Guidelines:
    - Missing Question: If one single foundational Refinement Question can be added into Output 3 Rewritten Questions what will it be? to 
    - Rewrite questions:
        - Rewrite  "Output 3 Rewritten Questions" in order to accomodate Missing Question
        - The list should cover the same scope as "Output 2 Rewritten Questions" and Missing Question together in just 7 questions without simply combining multiple questions into one.
        - Synthesise questions to abstract the relevant patterns in one or more questions into a new patter that capture them all.
    
    Output:
    - Missing Question and Rewriten Questions .
    Format:
    - A JSON object with the fields "Missing Question"(string) and  "Rewriten Questions" (string array)


Step 5. Generate a narrative outline
    Guidelines:
    - Output 4 Rewriten Questions is the body of knowledge necessary t comply with the REQUEST.
    Th narrative goal is to organize the body of knowledge to to create an outline that complies with the REQUEST and maximizes the integration of the body of knowledge.
    - Generate the outline of a narrative that covers all the questions of Ouput 5.
    - The goal of the narrative is to connect all the body of knowledge in a coherent and smooth way.
    - Rewrite the questions if it helps to improve the flow of ideas.
    - The narrative will combine the Output 4 Rewriten Questions  with "connectors"
    - A connector is a question or Notion used to logically connect two questions of Output 4 Rewriten Questions .
    - A connector is not a literary element but a logical one founded on IMPERSONATED PERSPECTIVE.
    - The goal of the connector is to create a logica flow of information.
    - Evaluate if is necessary to ad connectors to introduce the topic or to draw conclusions.
    - Add elements that may be necessary to facilitate the reading flow.
    
    Output:
    - A narrative made of a list of clauses (questions, connectors, Notions...)
    Format:
    - An array of strings

Step 6. Write the final composition
    Guidelines:
    - Write a comprehensive piece about REQUEST
    - Use Output 0 as title.
    - Use the Output 4 Rewriten Questions as background knowledge to cover.
    - Use Output Output5 as guiding narrative.
    - Use paragraphs headings and sub-headings to organize the text and improve readability.
    
    Output:
    - Final writing composition
    Format:
    - A Markdown text.

GENERAL GUIDELINES

Refinement Question:
- It aims to extend the REQUEST in order to extract more detailed and focused information to provide a nuanced and comprehensive response.
- Good Refinement Questions qualities:
    - Synthetic. Is able to capture many different patterns into one.
    - Contextual Alignment: Tailored to fit REQUEST CONTEXT.
    - Dedicated and simple: Address one specific aspect in a single query.
    - Purposeful Clarity: Formulated to enhance understanding and eliminate ambiguity.
    - Strategic Detailing: Aimed at uncovering specific, relevant facts for a comprehensive view.
    - Logical Flow: Structured to progress logically, from broader inquiries to finer details.
    - Open-Ended Nature: Encourages elaboration and additional information for a thorough exploration.
    - Neutrality: Crafted to be unbiased, avoiding leading language for genuine responses.
    - Application Focus: Serve a purpose in problem-solving, decision-making, or deepening comprehension.
    
REQUEST
    
{request}

REQUEST CONTEXT


IMPERSONATED PERSPECTIVE
    
The following terminology is the basis of IMPERSONATED PERSPECTIVE:
    
JSON`,
  };

  static questionAnalysisRequest: LlmRequest = {
    //USE GPT3.5TURBO or GPT4. GPT4Turbo can't recongize unique terms like "minfromation"
    name: "Analize request",
    identifierVariable: "<not set>",
    inputVariableNames: ["request"],
    temperature: 0.0,
    maxCompletitionChars: 20000, //minimum chars saved for response
    maxPromptChars: 80000,
    template: `INSTRUCTIONS
- You will follow all the STEPS(2)
- Only write what is instructed under the "Output:" section of each Step.
- Use precise, technical and straightforward language. No unnecessary jargon and complexity.
- REQUEST uses unusual terms. They are critical and may look similar from common words. They are not misspelled.
- Be concise, don't use fillers.
- Answer with a JSON object (no Markdown code)
- The JSON object will have with the following signature:
{{
    "Output1": "",
    "Output2": "",
    "Output2": "",
}}

STEPS

Step 1. Separate request into multiple subrequest
    Guidelines:
    - Preserve
    - The REQUEST may hide multiple request. Identify each of them.
    - Analize the deep meaning behind.
    - Rehrase subrequest as concise question, without missing important details.

    Output:
    - A list of subrequest questions.
    - Output goes into "Ouput1".
    Format:
    - An array of strings.

Step 2. Summarize REQUEST as one question.
    Guidelines:
    - Create a question that captures the REQUEST intent based on Output1.
    - The question is a summary of the request.
    Ouput
    - Summary question.
    - Output goes into "Ouput2".
    Format:
    - string

REQUEST
    
{request}
    
JSON`,
  };

  //Assumes: Explicit questions, narrow focused responses.
  static meaningMakingRq: LlmRequest = {
    name: "Meaning making",
    identifierVariable: "<not set>",
    inputVariableNames: ["request", "perspective", "continue"],
    temperature: 0.0,
    maxCompletitionChars: 10000, //minimum chars saved for response
    maxPromptChars: 0,
    template: `INSTRUCTIONS
- You will follow 3 STEPS, writing the Output of each Step.
- Only write what is instructed under the "Output:" section of each Step.
- The final outcome will have the following signature:

--- Output1:Last draft
<Step 1 output>
--- Output2:Improvements
<Step 2 output>
--- Output3:Final text
<Step 3 output>
---


STEPS

Step 1:
    Instructions:
    - Craft the section text for each "SectionSpecification" in "SECTION SPECIFICATIONS" by:
        - Addressing each "SectionSpecification question" with precision.
        - Adhering strictly to the specified "SectionSpecification guidelines" and "SectionSpecification length".
        - Following rigorously the "SECTION WRITING GUIDELINES."
        - If some section texts are already written, continue writing the missing ones based its "SectionSpecifications".

    Output: 
    - "--- Output1:Last draft"
    - The writing of each section in Markdown format.

Step 2.
    Instructions:
    - Assess each section in "Output1: Last draft" against ALL criteria in "ISSUES CRITERION."
    - If an issue arises according to the "ISSUES CRITERION," propose a clear improvement.
        - Specify the fragment under evaluation.
        - Provide precise instructions for issue resolution.
        - Ensure thoroughness in the improvement suggestions.
        - Offer multiple improvements per issue if needed.

    Output:
   - "--- Output2:Improvements"
   - Under each section title, a bullet point list with all the necessary improvements.

Step 3.
    Instructions:
    - Revise "Output1: Last draft" using suggestions from "Output2: Improvements" and adhere to "SECTION WRITING GUIDELINES".
    - Aim to retain original wording, tone, and flow as much as possible.
    - Perform a complete rewrite of "Output1: Last draft" only if necessary to meet "SectionSpecification guidelines" or length criteria.

    Output: 
    - "--- Output3:Final text"
    - The improved writing of each section in Markdown format.
    - "---"


SECTION SPECIFICATIONS FORMAT

A "SectionSpecification" serves as an entity delineating the specifications for the written output.

Structure of a "SectionSpecification":
- title: The title of the section.
- question: The question that the written output should address.
- length: The required length of the section text.
- guidelines: A list of specific criteria that each section text should follow.
- subSections: An array of "SectionSpecification" objects, each representing a subsection within the current section.


SECTION WRITING GUIDELINES

Logic Guidelines:

- Synthesize the key relationships, focusing on relationships rather than concepts or definitions within "TERMINOLOGY," to form a cohesive argument.
- Prioritize conveying key relationships and insights over introducing numerous ideas.
- Utilize a logical flow with clear transitions between ideas for a coherent and structured presentation.

Flow:

- Maintain the hierarchy outlined in "SECTION SPECIFICATIONS."
- Within each section, structure the logic flow from the familiar to the unfamiliar.
- Organize information in a structured manner, ensuring clear reasoning where each idea logically leads to the next.
- Minimize abrupt shifts; ensure each idea seamlessly transitions into the next for a smooth and cohesive narrative flow.

Perspective:

- Extract insights from "TERMINOLOGY" to address the "SectionSpecification question," filtering relevant content and disregarding extraneous details.
- Adopt a Third Person Omniscient perspective, with "TERMINOLOGY" serving as the lens through which you comprehend the world.

Content:

- Adhere to the specified length outlined in "SectionSpecification length" for each section text.
- Directly address the "SectionSpecification question" and adhere strictly to the "SectionSpecification guidelines," avoiding tangential topics unless explicitly mentioned in the question.
- Ensure comprehensiveness, capturing all essential nuances within the defined "SectionSpecification length."
- Maintain self-contained content, allowing for understanding without the need for terminology reference.

Style:

- Utilize straightforward and simple language.
- Maintain an impersonal and neutral style, refraining from subjective evaluations.
- Choose words precisely, aiming for minimal yet nuanced expression.
- Avoid comma splices; construct each phrase with a clear subject, predicate, and a concluding full stop.
- Prioritize brevity with exceptionally short phrases for conciseness.

Paragraphs:

- Always include a blank line between two paragraphs.
- Utilize paragraphs to delineate distinct ideas.
- Ensure each paragraph is self-contained, expressing a complete thought.
- Emphasize the frequent use of paragraphs to enhance clarity and readability.


ISSUES CRITERION

- Are each of the "SectionSpecification guidelines" met?
- Is the "SectionSpecification length" respected?
- Is it adhering to the "SECTION WRITING GUIDELINES"?
- Are all the statements really true, and there is no exagerations or subjective evaluations?
- Is there any stement that can be phrased more accurately?
- Is there a phrase that is too long or need and is rewritten without comma splice?


SECTION SPECIFICATIONS

{request}


TERMINOLOGY
    
{perspective}


OUTPUTS

--- Output1:Last draft

{continue}`,
  };

  static async getFinalOutcomeOrRetry(
    keyword: string,
    priorOutcome: string,
    model: ModelConfig,
    llmRequest: LlmRequest,
    priorInputVariables: ChainValues,
    retry: number
  ): Promise<string> {
    console.log("ATTEMPT:  " + retry);
    const keywordIndex = priorOutcome.indexOf(keyword);
    let output = "";
    if (keywordIndex !== -1) {
      const textAfterKeyword = priorOutcome.substring(
        keywordIndex + keyword.length
      );
      output = textAfterKeyword.trim();
      console.log("ATTEMPT SUCCESS");
      /*
      console.log("Final output:");
      console.log(output);
      console.log("---");
      */

      return output;
    } else {
      const accumulatedOutput =
        priorInputVariables.continue + "\n\n" + priorOutcome;
      console.log("ATTEMPT FAIL (" + retry + ")");
      if (retry > 2) {
        console.log("Stopped retrying");
        return "🔴" + accumulatedOutput;
      }
      retry++;
      console.log("Retrying...");
      /*
      console.log("Accumulated output:");
      console.log(accumulatedOutput);
      console.log("---");
*/
      const inputVariables = priorInputVariables;
      inputVariables.continue = accumulatedOutput;

      let continuedOutput = await callLlm(model, llmRequest, inputVariables);

      return await Definer.getFinalOutcomeOrRetry(
        keyword,
        continuedOutput,
        model,
        llmRequest,
        inputVariables,
        retry
      );
    }
  }
}
/*`

    - Prioritize few key relationships and insights over expressing many ideas.


Step 2. Add CSIs to each idea of the last Output.

    Guidelines:
    - PSs are all the ideas of the last Output (regardless of its indentation level).
    - For each PS generate an extensive and comprehensive lists of CSIs that support the PS
    - Add "CONCLUSIVE" as last CSI if you have certainity that no more CSI can be extracted from PERSPECTIVE.

    Output:
    - A bullet list of all the Synthetic Ideas
    - Each CSI goes tabulated, one level indentation deeper in relation to its corresponding PS.

    Format:
    - An string

        - Child Element has a direct relationship with Parent Statement. For instance:
            - Defines a concept in the Parent Statement.
            - Gives additional information or evidence to reinforce and substantiate the Parent Statement.
            - Gives background to enhance understanding of the Parent Statement.
            - Justifies Parent Statement with a coherent and rational sequence of thought.
            - Gives a aluable or perceptive or understanding that enhances the interpretation of the Parent Statement.
            - Draws parallels or makes comparisons with the Parent Statement.
            - Uses symbolic representation in relation to the Parent Statement for emphasis.
            - Highlights differences between concepts mentioned in the Parent Statement.
            - Illustrates similarities or differences in the Parent Statement through comparison.
            - Provides additional details or characteristics related to the Parent Statement.
            - Elicits similar ideas or emotions without a direct logical link to the Parent Statement.
- No comma splice. A phrase should include subject and predicate, and finish with a full stop.

Step 2. Add CSs

    Guidelines:
    - PSs are all the Notions of the last Output as well as the REQUEST, regardless of its indentation level.
    - For each PS list multiple new (2-5) CS.
    - Add "CONCLUSIVE" as last CS if you have certainity that no more CS can be extracted from PERSPECTIVE.

    Output:
    - A bullet list of all the Notions
    - CS go tabulated , one level indentation deeper in relation to their PSs.

    Format:
    - An string

Step 3. Add more CSs

    Guidelines:
    - Repeat Step2 on the previous Output

    Output:
    - A bullet list Notions.
  
    Format:
    - A string

Step 4. Add more CSs

    Guidelines:
    - Repeat Step2 on the previous Output

    Output:
    - A bullet list Notions.
  
    Format:
    - A string
    
Step 4. Explain relevance.
    Guidelines:
    - For each Notion of the last Outuput explain its relevancy:
        - Why this Notion is true?
        - Why this Notion is relevant?
    - Output:
    - Bullet point list of Notions and relevance explanations.

Step 4. Write a rationale 
Guidelines:
- Based on the last Output write a rationale to satisfy REQUEST
- Rewrite general requirements:
    - Rewrite must directly respond to the REQUEST.
    - Uses logical arguments and connections based on PERSPECTIVE.
    - Is exclusively founded on PERSPECTIVE. No outside information can be used.
    - Is extensive and comprehensive.
    - At least 2000 characthers.
    - Does not use filler content or unnecessary wording.
    - The logic flow goes from familiar to unfamiliar.
    - A rewrite should have at least 3 paragraphs.
    - Use short phrases.
    - No comma splice. A phrase should include subject and predicate, and finish with a full stop.
- Ideas requirements
    - Identify each idea in Output 1 explanation
    - Extend each idea deeper.
        - express why the idea is true
        - express why is important
        - use logical arguments in PERSPECTIVE
    - Organize each explanation idea onto it own paragraph.
    - Start with the most familiar idea.
    - Use paragraphs to encapsulate ideas.
    - A paragraph can contain only one idea.
    - Each new idea must be connected with the previous one.
    - Use logical arguments and clear transitions between ideas.
- Concepts requirements:
    - Identify each relevant concept.
    - A phrase can only introduce a single concept at a time.
    - Start with the most familiar concept.
    - Introduce concepts progressively.
    - Do not use a concept if it has not been introduced.
    
Output:
- A rewrite of Output1    
Format:
- A string

Step 3. Analyze Output2 extended rewrites
    Guidelines:
    - Analyze based on General requirements, Ideas requirements, and Concepts requirements in Step 2.
    - Based on Output2 extended rewrite:
        - Make a deep extensive analysis about why it does not satisfy General requirements
        - Suggest improvements.
        - For each idea or paragraph:
            - Make a deep extensive analysis for why it does not satisfy Ideas requirements.
            - Suggest improvements.
            - For each concept or phrase:
                - Make a deep extensive analysis for why it does not satisfy Concepts requirements.
                - Suggest improvements.

    Output:
    - Extended rewrite analysis is a valid JSON object with the following signature:
    {{
        "generalAnalysis": <extended rewrite analyisis>,
        "ideas":[
            {{
                "idea": <idea referring to>,
                "ideaAnalysis": <Idea analyisis>,
                "improvements":[<improvement>],
                "concepts": [
                        {{
                            "concept": <concept referring to>,
                            "conceptAnalysis": <Concept analysis>,
                            improvements:[<improvement>]
                        }}
                    ]
                
            }}
        ]
    }}

    Format:
    - A rewrite analyses objects.

Step 4. Improve extended rewrites
    Guidelines:
    - Improve Output2 rewrite based on Output3 analyses

    Output:
    - Three improved rewrites.

    Format:
    - A string.
---

Step 3. Suggest many key ideas from Output1.
    Guidelines:
    - Key ideas are:
        - A technical term.
        - An unusual, strange or misspelled words..
        - Ideas that are not captured in Outpu1 but may be related.
        - Concepts contained in  Output1.
        - Key words in the Output1.
        - Ideas that can capture the meaning of the REQUEST with different words.
    - Score each key concept
        - From 0 to 1 based on its relevancy to the Output 1.
        - Relevancy is calculated based:
            - How much of a prerequisit is to understand TEXT
            - How unique the idea is.
    Output:
        - A list of JSON objects with concept (c) and its prerequist-score (s) as fields
        - Write key concepts in singular and lower-case.
        - Use the format: {{"c": "apple", "s": 0.7}}


        
- Adaptability: Can be adjusted based on responses or evolving conversation dynamics.

 Clarity: Clearly formulated and easily understood.
- Relevance: Directly related to the REQUEST.
- Open-ended: Encourages detailed responses, avoiding yes/no answers.
- Focused: Targets a specific aspect of the REQUEST.
- Neutral: Phrased in a way that avoids bias.
- Engaging: Sparks interest and involvement.
- Complexity: Thought-provoking without being overly complex.
- Connection to Goals: Aligns with the overall .
- Encourages Reflection: Prompts participants to reflect on thoughts or experiences.
- Unique and diverse: Each question should cover a unique aspect, creating diversity
- Foundational: Reveal background knowledge.

- Elements that a good Refinement Question should uncover:
- Clarify the specific details of the request.
- Explore request's scope and purpose.
- Address any doubts or uncertainties about the request.
- Key questions directly related to the request to gather necessary information.
- Explore the underlying needs or motivations driving the request.
- Evaluate the validity, relevance, and clarity of the request.
- Seek clarification on basic knowledge or background information related to the request.
- Emphasize practical actions or steps that can be taken to fulfill the request.
- Clearly define the essence or nature of the subject matter in the request.


        - Elements that give more resolution and clarity in order to answer the REQUEST.
        - Base understanding of the concepts at play.
        - Doubts that the reader may have in relation to the REQUEST.
        - Essential inquirie in relation to the REQUEST.
        - What needs are behind the REQUEST.
        - Questioning if the REQUEST itself.
        - Clarify background knowledge.
        - Highlights functional actions.


Step 5. Generate an Outline
    Guidelines:
    - Output 3 represents the body of knowledge that should be covered in the COMPOSITION
    - Propose an outline that for the COMPOSITION that covers the full body of knowledge.
    - The outline is a high level representation of what the strcuture of the COMPOSITION should be.
    - The outline is made of nested sections.
    - Use a logical flow and clear transitions between ideas.
    - Add new elements that may be necessary to facilitate the reading flow. (connectors, introduction, ending...)
    - The outline can contain sections and subsections


Step 5. Sort Refinement Questions
    Guidelines:
    - Background understanding / conceptual before practical
    - Abstract before specific
    - Directly responding to the REQUEST before indirect.
    
    Output:
    - A list of sorted questions
    Format:
    - An array of strings

Step 5. Compose the first outline
    Guidelines:
    - The outline is founded on Output 5
    - The outline is a high level representation of what the strcuture of the COMPOSITION should be.
    - The outline is made of nested sections.
    - Each section is represented by a heading.
    - Each headings must be an elaborate clause reflecting the Refinement Questions of Output 5.
    - Each section contains a list of the concepts and ideas that the section should cover.
    - The ideas to be included should be complex caluses based on IMPERSONATED PERSPECTVE.
    - The headings and the contents always should aim to best explain the REQUEST. This is the top priority.
    - Only ideas contained within IMPERSONATED PERSPECTIVE can be used. No external information.
    Output:
    - The outline following the guidelines. 
    Format:
    - A JSON object with the signature:
    {{
        "Title": {{
          "Section1": ["Idea1", "Idea2", ...],
          "Section2": ["Idea1", "Idea2", ...],
          ...
        }}
    }}

Step 6. Compose the second outline
    Guidelines:
    - Rewrite the headings of the Output 5 to better reflect the concepts it contains.
    - For each section add 1-3 new concepts missing in Output 5.

    Output
    -The outline following the guidelines.

    Format: 
    - Same format as Output 5


AUDIENCE
- Critical thinkers who engage in intellectual discussions.
- Interest in depth of the human condition.
- Diverse global community with various backgrounds and cultures.
- Only like concise, information-rich content.
- Do not know anything about IMPERSONATED PERSPECTIVE terminology.

- Context-aware: Tailored to fit the AUDIENCE and context.
*/
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
