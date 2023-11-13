import { Key } from "readline";
import DefinerStore, { KeyValuePair, Definition } from "../lib/definerStore";
import Definer from "./definer";

export default class RequestConceptHolder {
  given: KeyValuePair[];
  givenParents: KeyValuePair[];
  guessed: KeyValuePair[];
  guessedParents: KeyValuePair[];
  final: KeyValuePair[];
  text: string;

  constructor(_given: string[], _text: string) {
    this.given = _given.map((c) => {
      return { k: c, v: 1 };
    });
    this.givenParents = [];
    this.guessed = [];
    this.guessedParents = [];
    this.final = [];
    this.text = _text;
  }
  async proces() {
    await Promise.all([this.processGiven(), this.processGuesed()]);
    this.final = Definer.removeRepeatsAndNormalizeScore(
      this.given.concat(this.givenParents, this.guessed, this.guessedParents)
    );

    this.final = Definer.sortConceptScores(this.final);

    console.log("GIVEN");
    console.log(this.given);
    console.log("GIVEN PARENTS");
    console.log(this.givenParents);
    console.log("GUESSED");
    console.log(this.guessed);
    console.log("GUESSED PARENTS");
    console.log(this.guessedParents);
    console.log("FINAL");
    console.log(this.final);
  }

  async processGiven(): Promise<void> {
    this.givenParents = await this.getParentScoresForConcepts(this.given, 0.85);
    this.givenParents = Definer.removeRepeatsAndNormalizeScore(
      this.givenParents
    );
  }

  async processGuesed(): Promise<void> {
    this.guessed = await Definer.guessTextKeyConcepts(this.text);
    this.guessedParents = await this.getParentScoresForConcepts(
      this.guessed,
      0.8
    );
    this.guessedParents = Definer.removeRepeatsAndNormalizeScore(
      this.guessedParents
    );
  }

  async getParentScoresForConcepts(
    conceptScores: KeyValuePair[],
    compensation: number
  ): Promise<KeyValuePair[]> {
    const process = conceptScores.map(async (cs: KeyValuePair) => {
      const d = await DefinerStore.getDefinition(
        cs.k,
        true,
        false,
        true,
        false
      );
      if (d) {
        let pcs = this.penalizeConceptScores(d.keyConceptsScores, cs.v);
        pcs = this.penalizeConceptScores(pcs, compensation);
        return pcs;
      } else {
        console.log(cs.k + " failed");
        return [] as KeyValuePair[]; // Return an empty array with the correct type
      }
    });

    const all = await Promise.all(process);
    let concatenatedArray: KeyValuePair[] = ([] as KeyValuePair[]).concat(
      ...all
    );

    return Definer.sortConceptScores(concatenatedArray);
  }

  penalizeConceptScores(conceptScores: KeyValuePair[], penalty: number) {
    for (let c of conceptScores) {
      c.v = c.v * penalty;
    }
    return conceptScores;
  }

  getFinalDefinitions(): Definition[] {
    let definitions: Definition[] = [];
    for (let cs of this.final) {
      const d = DefinerStore.getDefinition(cs.k, false, false, false, false);
      if (d) definitions.push(d);
    }
    return definitions;
  }
}
