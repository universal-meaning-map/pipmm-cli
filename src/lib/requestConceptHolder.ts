import DefinerStore, { ConceptScore, Definition } from "../lib/definerStore";
import Definer from "./definer";
import { GPT35TURBO, GPT4TURBO } from "./llm";
import Utils from "./utils";

export default class RequestConceptHolder {
  given: ConceptScore[];
  givenParents: ConceptScore[];
  guessed: ConceptScore[];
  guessedParents: ConceptScore[];
  all: ConceptScore[];
  text1: string;
  text1Dependencies: string[];
  text2: string;

  constructor(
    _given: string[],
    _text1: string,
    _text1Dependencies: string[],
    _questionText: string = ""
  ) {
    this.given = _given.map((c) => {
      return { c: c, s: 1 };
    });

    this.givenParents = [];
    this.guessed = [];
    this.guessedParents = [];
    this.all = [];
    this.text1 = _text1;
    this.text1Dependencies = _text1Dependencies;
    this.text2 = _questionText;
  }
  async proces() {
    await Promise.all([this.processGiven(), this.processGuesed()]);
    this.all = Definer.removeRepeatsCutOffAndNormalizeScore(
      (this.all = this.given.concat(
        this.givenParents,
        this.guessed,
        this.guessedParents
      ))
    );

    this.all = Definer.sortConceptScores(this.all);

    console.log("GIVEN");
    console.log(this.given);
    console.log("GIVEN PARENTS");
    console.log(this.givenParents);
    console.log("GUESSED");
    console.log(this.guessed);
    console.log("GUESSED PARENTS");
    console.log(this.guessedParents);
    console.log("FINAL");
    console.log(this.all);
  }

  async processGiven(): Promise<void> {
    this.givenParents = await this.getCloneParentScoresForConcepts(
      this.given,
      0.9
    );

    this.givenParents = Definer.removeRepeatsCutOffAndNormalizeScore(
      this.givenParents
    );
  }

  async processGuesed(): Promise<void> {
    // WHY GUESSES DON'T SHOW

    //Todo parallelize these text1 and text2

    if (this.text1)
      if (this.text1Dependencies.length != 0) {
        this.guessed.push(
          ...(await Definer.getDefinitionScoredConcepts(
            this.text2,
            this.text1,
            this.text1Dependencies
          ))
        );
      } else {
        this.guessed.push(
          ...(await Definer.guessMuFromText(GPT4TURBO, this.text1))
        );
      }

    if (this.text2)
      this.guessed.push(
        ...(await Definer.guessMuFromText(GPT4TURBO, this.text2))
      );

    this.guessed = Definer.removeRepeatsCutOffAndNormalizeScore(this.guessed);

    this.guessed = this.penalizeConceptScores(this.guessed, 0.85);
    this.guessedParents = await this.getCloneParentScoresForConcepts(
      this.guessed,
      0.8
    );
    this.guessedParents = Definer.removeRepeatsCutOffAndNormalizeScore(
      this.guessedParents
    );
  }

  async getCloneParentScoresForConcepts(
    conceptScores: ConceptScore[],
    compensation: number
  ): Promise<ConceptScore[]> {
    const process = conceptScores.map(async (cs: ConceptScore) => {
      console.log(cs);

      const d = await DefinerStore.getDefinition(
        cs.c,
        true,
        false,
        true,
        false
      );

      if (d) {
        let pcs = this.penalizeConceptScores(d.keyConceptsScores, cs.s);
        pcs = this.penalizeConceptScores(pcs, compensation);
        return pcs;
      } else {
        console.log(cs.c + " not found");
        return [] as ConceptScore[]; // Return an empty array with the correct type
      }
    });

    const all = await Promise.all(process);
    let concatenatedArray: ConceptScore[] = ([] as ConceptScore[]).concat(
      ...all
    );

    return Definer.sortConceptScores(concatenatedArray);
  }

  penalizeConceptScores(conceptScores: ConceptScore[], penalty: number) {
    let cs: ConceptScore[] = [];
    for (let c of conceptScores) {
      let newCS: ConceptScore = {
        c: c.c,
        s: c.s * penalty,
      };
      cs.push(newCS);
    }
    return cs;
  }
}
