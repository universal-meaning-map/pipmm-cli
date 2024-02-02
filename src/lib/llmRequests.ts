import { LlmRequest, GPT4TURBO } from "./llm";
export default class LlmRequests {
  static Enrich: LlmRequest = {
    identifierVariable: "<not set>",
    name: "Enrich",
    inputVariableNames: ["question", "draft", "perspective"],
    temperature: 0.0,
    maxCompletitionChars: 10000, //minimum chars saved for response,
    maxPromptChars: 0,
    template: `INSTRUCTIONS
    
Your goal as background researcher is to enrich and amplify the DRAFT into a fleshed out EXPOSITORY ESSAY.
The EXPOSITORY ESSAY must at least double the DRAFT length (pontentially way more) with more accurate nounances and new insights.
 
GUIDELINES for the EXPOSITORY ESSAY

- The expansion of the EXPOSITORY ESSAY is based on the insights found within the Umm framework and the comments in the DRAFT itself.

- Organize information in a structured manner based on the DRAFT.
    - Build upon the  DRAFT's structure, content and comments.
    - Extend with content beyond what's in the DRAFT if it can add new insights to the QUESTION.
    - Cover extensively each section (if any).
    - The caracter ">" is used to indicate comments and instructions that should be followed for the EXPOSITORY ESSAY.
    - Ensure clear reasoning where each idea logically leads to the next.
    
- The EXPOSITORY ESSAY must be objective, technical and descriptive.
    - Be extremely concise and direct. Never use unnecessary wording.   
    - Synthesise key ideas between concepts.
    - Be precise. Use technical language. Preserve technical terms. Preserve the use of hyphen.
    - Provide detailed and vivid descriptions of concepts, processes, or phenomena.
    - Never do subjective evaluations. Utilize a third-person omniscient perspective.
    - Do not write a conclusion.
    
- Ensure that the EXPOSITORY ESSAY is thorough and highly comprehensive
    - The EXPOSITORY ESSAY MUST at least double the length of the DRAFT.
    - Ensure specific focus on addressing all aspects of the QUESTION and all its sections with high accuracy.
    - Aim for an extremely extensive coverage, delving deeply into all aspects present in the DRAFT with detail.
    - Many elements withing Umm Framework are unrelated to the QUESTION, discard the ones that do not address the QUESTION.
    
QUESTION

{question}

DRAFT

# {question}

{draft}
{known}

UMM FRAMEWORK

{perspective}

EXPOSITORY ESSAY
`,
  };

  static Style: LlmRequest = {
    identifierVariable: "<not set>",
    name: "Style",
    inputVariableNames: ["question", "draft", "style", "unkwown"],
    temperature: 0.0,
    maxCompletitionChars: 3000, //minimum chars saved for response,
    maxPromptChars: 0,
    template: `INSTRUCTIONS

Generate an OUTPUT based on the OUTPUT REQUIREMENTS.

OUTPUT REQUIREMENTS

{style}{unknown}

QUESTION

{question}

DRAFT

{draft}

OUTPUT
`,
  };
}

/*



INSTRUCTIONS

- Synthesise the DRAFT into a short OUTPUT ensuring that it addresses the QUESTION.
- Strictly adhere to the OUTPUT REQUIREMENTS.

OUTPUT REQUIREMENTS

Focus:
- Generate a succint and focused response to the provided QUESTION.
- The OUTPUT length must be 25% of the DRAFT
- Ensure content exclusively addresses the question.

Writing Style and Perspective:
- Mimic Leonardo Da Vinci writting style.
- Craft output to be objective, technical, and descriptive.
- Use concise and clear language that facilitate understanding.
- Show don't tell.
- Utilize a third-person omniscient perspective.
- Prioritize writing excellence over the quantity of ideas.
- Avoid comma splices; structure each phrase with a subject and predicate.
- Maintain brevity with very short sentences.

Structure:
- Organize ideas into well-structured paragraphs.
- Ensure a logical flow from familiar to unfamiliar, and from abstract to concrete.
- Create a cohesive argument with clear reasoning.

Technical Documentation:
- Tailor output for technical documentation.
- Preserve key technical terms but prevent the usage of unfamilar or key concepts unless they are essential.
- Incorporate bullet points and highlight essential information if needed.

Approach to Synthesis:
- Synthesize key relationships instead of explaining concepts.
- Explain key concepts if needed
- Focus on presenting interconnectedness of ideas for better understanding.

QUESTION

{question}

DRAFT

# {question}

{draft}




- It must be 4 paragraphs long.
- The OUTPUT must be objective, technical and descriptive.
- Prioritizing the excellence of writing is more crucial than sheer quantity of ideas.
- Synthesise the key relationships rather than explaining concepts.
- Generate a concise and focused response to the QUESTION.
- Ensure that the content remains exclusively relevant to the QUESTION. Avoid unnecessary details or tangents.
- Adopt a third-person omniscient perspective
- Don't use comma splices. Each phrase has a subject, a predicate, and concludes with a full stop
- Use very short sentences
- The OUTPUT is for technical documentation
    - Preserve the usage of key technical terms but prevent using them for non-key words (minimize the amount of unfamiliar concepts)
    - Add bullet points and highlight key points  as needed.
- Organise information in a structured manner
    - Ensure clear reasoning where each idea logically leads to the next
    - Flow from the familiar to the unfamiliar
    - Flow from abstract to concrete
    - Create a cohesive argument


    ---

        - Use Markdown headings only when document structure is exceptionally clear.
    - Emphasize a streamlined structure; use headings sparingly.
    - Assess to incorporate bullet points, and highligh to increase overall readability.
    */
