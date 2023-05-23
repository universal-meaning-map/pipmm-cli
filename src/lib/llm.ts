import Utils from "./utils";

export interface LlmRequest {
  nameId: string; //identifier of the request template
  temperature: number; //model temperature
  template: string; //langchain prompt template
  minCompletitionChars: number; //minimum chars saved for response
  minSimilarityScore: number; //0-1, usually between 0.15 and 0.2
  minConfidenceScore: number; //0-1, confidence filter
}

export function getConfidenceScore(relevance: number, pir: number) {
  const accuracyPenalty = Utils.mapRange(pir, 0.5, 0.9, 0.7, 1);
  return relevance * accuracyPenalty;
}
