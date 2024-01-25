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
    
Your goal as background researcher is to address the QUESTION by rewriting the DRAFT, expanding it and enriching with incredible depth with insights found within the UMM FRAMEWORK.

GUIDELINES for the REWRITE

- The REWRITE must be objective, technical and descriptive.
    - Use precise and concise language. Preserve technical terms. Preserve the use of hyphen.
    - Provide detailed and vivid descriptions of concepts, processes, or phenomena.
    - Never do subjective evaluations. Utilize a third-person omniscient perspective.
    - Do not write a conclusion.

- Ensure that the REWRITE is thorough and highly comprehensive
    - The REWRITE should be etremely extensive! (double the needed length). It should cover all aspects comprehensively.
    - Ensure specific focus on addressing all aspects of the QUESTION.
    - Many elements withing UMM FRAMEWORK are unrelated to the QUESTION, discard the ones that do not address the QUESTION.
    - Dive deep into all relevant domains and nuances related to the QUESTION
    - Strive for accuracy and depth, leaving no detail unexplored.
    
- Organize information in a structured manner.
    - Synthesise key ideas between concepts.
    - Ensure clear reasoning where each idea logically leads to the next.

QUESTION

{question}

DRAFT

{draft}
{known}

UMM FRAMEWORK

{perspective}

REWRITE
`,
  };

  static Style: LlmRequest = {
    identifierVariable: "<not set>",
    name: "Style",
    inputVariableNames: ["question", "draft", "style"],
    temperature: 0.0,
    maxCompletitionChars: 3000, //minimum chars saved for response,
    maxPromptChars: 0,
    template: `INSTRUCTIONS

- Synthesise the DRAFT into a short OUTPUT ensuring that it addresses the QUESTION.
- Strictly adhere to the OUTPUT REQUIREMENTS.

OUTPUT REQUIREMENTS

{style}

QUESTION

{question}

DRAFT

# {question}

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
