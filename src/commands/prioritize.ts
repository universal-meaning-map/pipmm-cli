import { Command, flags } from "@oclif/command";
import ConfigController from "../lib/configController";
import Utils from "../lib/utils";
import Compiler from "../lib/compiler";
import DefinerStore, { Definition } from "../lib/definerStore";
import RequestConceptHolder from "../lib/requestConceptHolder";

interface Rel {
  nameA: string;
  nameB: string;
  strength: number;
}

export default class PrioritizeCommand extends Command {
  static description = "Uses LLMs to write about a topic in a specific format";

  static flags = {
    help: flags.help({ char: "h" }),

    unidirectional: flags.boolean({
      char: "u",
      name: "unidirectional",
      description: "only shows the strongest link between two nodes",
    }),

    repoPath: flags.string({
      name: "repoPath",
      char: "p",
      description:
        "Executes the command relative to the specified path as oppose to the working directory",
    }),
  };

  static args = [
    {
      name: "keyConcepts",
      required: true,
      description:
        "Comma separated list of meaning unit names. Its definitions will be included in the context. ",
      hidden: false,
    },
  ];

  async run() {
    console.warn = () => {};

    const { args, flags } = this.parse(PrioritizeCommand);

    let workingPath = process.cwd();

    if (flags.repoPath) {
      workingPath = Utils.resolveHome(flags.repoPath);
    }

    if (!ConfigController.load(workingPath)) return;

    // Compile
    await Compiler.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );

    let givenConcepts: string[] = args.keyConcepts.split(", ");

    await DefinerStore.load();

    let rch = new RequestConceptHolder(givenConcepts, "", []);
    await rch.proces();

    //If there is only one concept, we use its conccept dependencies
    if (givenConcepts.length == 1) {
      const def = await DefinerStore.getDefinition(
        givenConcepts[0],
        false,
        false,
        true,
        false
      );

      if (def) {
        let dependencies: string[] = [];
        for (let c of def.keyConceptsScores) {
          dependencies.push(c.c);
        }
        givenConcepts = givenConcepts.concat(dependencies);
      }
    }

    //Fetch scores
    const processScores = givenConcepts.map(async (c: string) => {
      const d = await DefinerStore.getDefinition(c, false, false, true, false);

      if (!d) {
        console.log(c + "Doesn't exist. Removing it from the list");
        givenConcepts = givenConcepts.filter((item) => item !== c);
      }
    });

    await Promise.all(processScores);
    DefinerStore.save();

    const relationships = this.buildRelationships(
      givenConcepts,
      flags.unidirectional
    );
    const sortedNames = this.sortByStrengthVolume(relationships);
    const graph = this.drawFlowGraph(sortedNames, relationships);
    //const graph = this.drawZankeyGraph(sortedNames, relationships);

    console.log(graph);
  }

  buildZankey(givenConcepts: string[]): Rel[] {
    let children: Rel[] = [];
    let parents: Rel[] = [];
    for (let nameA of givenConcepts) {
      let defA = DefinerStore.definitions.get(nameA);
      if (!defA) {
        console.log(nameA + " doesn't exist");
        continue;
      }

      for (let csB of defA.keyConceptsScores) {
        if (csB.c == nameA) continue; //
        children.push({ nameA: nameA, nameB: csB.c, strength: csB.s * 10 });
      }
    }
    return children;
  }

  makeId(name: string): string {
    if (name == "graph") name = "graph_";
    let id = name.split("-").join("");
    return id;
  }

  //TODO:
  // - style nodes based on volume of dependencies
  //

  drawFlowGraph(givenConcepts: string[], relationships: Rel[]): string {
    let mermaid = "flowchart LR";
    //let mermaid = "stateDiagram-v2";

    let maxStrength = 0;
    for (let c of givenConcepts) {
      let dependedStrength = 0;
      for (let rel of relationships) {
        if (rel.nameB == c) {
          dependedStrength += rel.strength;
        }
      }
      console.log(c, dependedStrength, maxStrength);
      let id = this.makeId(c);
      mermaid += "\n\t" + id + "(" + c + ")";
      mermaid +=
        "\n\tclassDef class" +
        id +
        "  font-size: " +
        (12 + dependedStrength) +
        "px, stroke:#000, fill:#fff, color:#000, fill-opacity:" +
        Utils.mapRange(dependedStrength, 0.7, 5, 0.5, 1);
      mermaid += "\n\t class " + id + " class" + id + ";";

      // classDef classbook  font-size: 10.55px, stroke:#000, fill:#fff, color:#000, fill-opacity:0.5
      //mermaid += "\n\t" + id + ":" + c;
    }

    let i = 0;
    for (let rel of relationships) {
      mermaid +=
        "\n\t" + this.makeId(rel.nameA) + " --> " + this.makeId(rel.nameB);
      mermaid +=
        "\n\tlinkStyle " +
        i +
        " stroke:#fff,stroke-width:" +
        this.strechStrength(rel.strength, 2) +
        "px,opacity:" +
        this.strechStrength(rel.strength, 1);

      i++;
    }
    return mermaid;
  }

  drawZankeyGraph(givenConcepts: string[], relationships: Rel[]): string {
    let mermaid = `---
config:
  sankey:
    showValues: false
---
sankey-beta
`;

    for (let rel of relationships) {
      mermaid += "\n" + rel.nameA + ", " + rel.nameB + ", " + rel.strength;
    }
    return mermaid;
  }

  strechStrength(score: number, max: number) {
    if (score == 0) {
      return 0;
    }
    //they have been normalized to a min of 0.5
    return Utils.mapRange(score, 0.8, 1, 0, max);
  }

  sortByStrengthVolume(relationships: Rel[]) {
    const occurrances: Map<string, number> = new Map();
    relationships.forEach((rel) => {
      const strengthVolume = occurrances.get(rel.nameB) || 0;
      occurrances.set(rel.nameB, strengthVolume + rel.strength);
    });

    //Can be: most dependencies, most needed
    const sortedEntries: [string, number][] = Array.from(
      occurrances.entries()
    ).sort((a, b) => a[1] - b[1]);

    let list: string[] = [];
    for (let r of sortedEntries) {
      console.log(r);
      list.push(r[0]);
    }
    return list;
  }

  buildRelationships(givenConcepts: string[], uniDirectional: boolean): Rel[] {
    let relationships: Rel[] = [];

    for (let nameA of givenConcepts) {
      let defA = DefinerStore.definitions.get(nameA);
      if (!defA) {
        console.log(nameA + " doesn't exist");
        continue;
      }

      for (let nameB of givenConcepts) {
        if (nameB == nameA) break; // we compute both relationships at the same time

        let defB = DefinerStore.definitions.get(nameB);

        if (!defB) {
          continue;
        }

        let abStrength = 0;
        let abConceptScore = defA.keyConceptsScores.find((c) => c.c === nameB);
        if (abConceptScore) abStrength = abConceptScore.s;

        let baStrength = 0;
        let baConceptScore = defB.keyConceptsScores.find((c) => c.c === nameA);
        if (baConceptScore) baStrength = baConceptScore.s;

        if (abStrength == 0 && baStrength == 0) continue;

        const bStrengthIsLarger = abStrength - baStrength < 0;

        console.log(nameA, nameB, bStrengthIsLarger, abStrength);
        console.log(nameB, nameA, bStrengthIsLarger, baStrength);

        let columnRel = {
          nameA: nameA,
          nameB: nameB,
          strength: abStrength,
        };

        let rowRel = {
          nameA: nameB,
          nameB: nameA,
          strength: baStrength,
        };

        if (uniDirectional) {
          if (bStrengthIsLarger) {
            relationships.push(rowRel);
          } else {
            relationships.push(columnRel);
          }
        } else {
          relationships.push(columnRel);
          relationships.push(rowRel);
        }
      }
    }

    return relationships;
  }
}
