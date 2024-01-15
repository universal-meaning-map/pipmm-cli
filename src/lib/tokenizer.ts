import { run } from "..";
import { Res } from "./errorController";
import Compiler from "./compiler";
import Referencer from "./referencer";
import ConfigController from "./configController";

export default class Tokenizer {
  static splitToken = "<split>";
  static hyphenToken = "-";
  static unknownTermToken = "ɑ";
  static beginingOfStatementToken = "►";
  static wikilinkWithTokens = /\[{2}(.*?)\]{2}/g; //matches [[ ]]
  static dynamicTransclusion = /\({2}(.*?)\){2}/g; //matches (( ))

  static wikilinksToInterplanetaryText = async (
    text: string,
    requesterFoamId: string,
    compileInterplanetaryTextArefs: boolean
  ): Promise<string[]> => {
    const splitReplaced = await Tokenizer.wikilinksToTransclusions(
      text,
      requesterFoamId,
      compileInterplanetaryTextArefs
    );
    return splitReplaced.split(Tokenizer.splitToken);
  };

  static wikilinksToTransclusions = async (
    text: string,
    requesterFoamId: string,
    compileInterplanetaryTextArefs: boolean
  ): Promise<string> => {
    let wikilinkFoundCallback = async (
      match: string,
      wikilink: string,
      offset: string,
      original: string
    ) => {
      const exp = await Tokenizer.wikilinkToTransclusionExp(
        wikilink,
        true,
        requesterFoamId,
        compileInterplanetaryTextArefs
      );
      const transclusionExp = Tokenizer.transclusionExpToJson(exp);
      return Tokenizer.addSplitTokens(transclusionExp);
    };

    let transformFoundCallback = async (
      match: string,
      transform: string,
      offset: string,
      original: string
    ) => {
      const transclusionExp = await Tokenizer.transformToTransclusionExp(
        transform,
        requesterFoamId,
        compileInterplanetaryTextArefs
      );
      transclusionExp;
      return Tokenizer.addSplitTokens(transclusionExp);
    };

    let withDynamicTransclusions = await Tokenizer.replaceAsync(
      text,
      Tokenizer.dynamicTransclusion,
      transformFoundCallback
    );

    let withStaticTransclusion = await Tokenizer.replaceAsync(
      withDynamicTransclusions,
      Tokenizer.wikilinkWithTokens,
      wikilinkFoundCallback
    );
    return withStaticTransclusion;
  };

  static transformToTransclusionExp = async (
    transform: string,
    requesterFoamId: string,
    compileInterplanetaryTextArefs: boolean
  ): Promise<string> => {
    // ((wikilink, asdf, 1)) --> ["iid","asdf","1"]
    let wikilinkFoundCallback = async (
      match: string,
      wikilink: string,
      offset: string,
      original: string
    ) => {
      const transclusionExp = await Tokenizer.wikilinkToTransclusionExp(
        wikilink,
        false,
        requesterFoamId,
        compileInterplanetaryTextArefs
      );
      return transclusionExp;
    };

    let wikilinksReplaced = await Tokenizer.replaceAsync(
      transform,
      Tokenizer.wikilinkWithTokens,
      wikilinkFoundCallback
    );

    let runs = wikilinksReplaced.split(",");
    let runsTrimmed = runs.map((run: string) => run.trim());

    const transclusionExp = JSON.stringify(runsTrimmed);
    return transclusionExp;
  };

  static wikilinkToTransclusionExp = async (
    wikilink: string,
    assumeAbstractionPointer: boolean,
    requesterFoamId: string,
    compileInterplanetaryTextArefs: boolean
  ): Promise<string> => {
    //folder/foamid|property/subProperty --> mid:iid/tiid/subProperty

    let runs = wikilink.split("|");

    /*let foamId = Referencer.updaterFoamIdWithFriendFolder(
      runs[0],
      requesterFoamId
    );*/

    let fileName = runs[0];

    let iid = await Referencer.getIidByFileName(fileName);

    if (!iid) {
      return "<" + wikilink + ">(doesn't exist)";
    }

    /*
    await Tokenizer.checkFoamId(fileName, requesterFoamId);
    const fid = Referencer.getFID(fileName);

    if (compileInterplanetaryTextArefs) {
      if (!Referencer.iidToNoteWrap.has(iid))
        await Compiler.makeNote(fileName, false, false, requesterFoamId);
    }
    */

    let exp = iid;

    if (runs.length == 1) {
      if (assumeAbstractionPointer) {
        let deafultPointerName =
          ConfigController._configFile.interplanetaryText
            .defaultAbstractionPointer;
        let abstractionPointer = await Referencer.getIidByFileName(
          deafultPointerName
        );

        exp = exp + "/" + abstractionPointer;
      }
    } else if (runs.length > 1) {
      //let tiid = await Referencer.makeIid(backRuns[0]);
      let tiid = await Referencer.getIidByFileName(runs[1]);
      if (!tiid) {
        tiid = await Referencer.getIidByFileName(Referencer.PROP_NAME_FILENAME);
      }
      exp = exp + "/" + tiid;

      /*  let backRuns = runs[1].split("/");
      if (backRuns.length > 1) {
        for (let i = 1; i < backRuns.length; i++) {
          //We only assume the first property to be an iid, the rest is an IPLD path
          exp = exp + "/" + backRuns[i];
        }
      }
      */
    }

    return exp;
  };

  static addSplitTokens(transclusionExp: string) {
    return Tokenizer.splitToken + transclusionExp + Tokenizer.splitToken;
  }

  static wikilinkToItent = async (wikilink: string): Promise<string> => {
    return await Referencer.makeIid(wikilink);
  };

  static transclusionExpToJson(intentRef: string) {
    const t: string[] = [intentRef];
    const te = JSON.stringify(t);
    return te;
  }

  //from the internets...
  static replaceAsync = async (
    str: string,
    re: any,
    callback: any
  ): Promise<any> => {
    str = String(str);
    var parts = [],
      i = 0;
    if (Object.prototype.toString.call(re) == "[object RegExp]") {
      if (re.global) re.lastIndex = i;
      var m;
      while ((m = re.exec(str))) {
        var args = m.concat([m.index, m.input]);
        parts.push(str.slice(i, m.index), callback.apply(null, args));
        i = re.lastIndex;
        if (!re.global) break; // for non-global regexes only take the first match
        if (m[0].length == 0) re.lastIndex++;
      }
    } else {
      re = String(re);
      i = str.indexOf(re);
      parts.push(str.slice(0, i), callback.apply(null, [re, i, str]));
      i += re.length;
    }
    parts.push(str.slice(i));
    return Promise.all(parts).then(function (strings) {
      return strings.join("");
    });
  };

  static checkFoamId = async (
    foamId: string,
    requesterFoamId: string
  ): Promise<void> => {
    //foamId should not include extension
    let localFoamId = Tokenizer.getLocalFoamId(foamId);
    if (Tokenizer.containsMdExtension(foamId))
      Res.error(
        "Note " +
          requesterFoamId +
          " contains wikilink with .md extension. Wikilink: " +
          foamId,
        Res.saveError
      );

    if (Tokenizer.containsSpaces(foamId))
      Res.error(
        "Note " +
          requesterFoamId +
          " contains a reference with spaces: " +
          foamId,
        Res.saveError
      );
    //new wikilinks should be formated with timestmap in the back.
    //Super crappy check that will last 5 years
    if (Tokenizer.containsUpperCase(localFoamId))
      Res.error(
        "Note " +
          foamId +
          " contains wikilink with upercase. Wikilink: " +
          localFoamId,
        Res.saveError
      );
    //No upper case allowed
    if (Tokenizer.idDoesNotContainTimestamp(localFoamId)) {
      Res.error(
        "Note " +
          requesterFoamId +
          " contains wikilink without timestamp. Wikilink: " +
          localFoamId,
        Res.saveError
      );
    }
  };

  static containsMdExtension(str: string): boolean {
    if (str.indexOf(".md") == -1) return false;
    return true;
  }

  static containsSpaces(str: string): boolean {
    if (str.indexOf(" ") == -1) return false;
    return true;
  }

  static containsUpperCase(str: string): boolean {
    if (str == str.toLowerCase()) return false;
    return true;
  }

  static idDoesNotContainTimestamp(str: string): boolean {
    if (str.length < 10) {
      return true;
    }

    if (
      str.indexOf("16") == str.length - 10 ||
      str.indexOf("17") == str.length - 10
    ) {
      return false;
    }

    return true;
  }

  static getFirstOrDefaultTypeAndValueForContent(str: string) {
    let lines = str.split("\n");
    let expression = /\s*([^:]*?)\s*:\s*([^:\s]*)/g; //matches str in front of semicolon
    let regex = new RegExp(expression);
    let r = regex.exec(lines[0]);

    if (r == null || r[1].indexOf(" ") != -1) {
      return {
        type: ConfigController._configFile.misc.defaultContentProperty,
        value: str,
      };
    } else {
      lines.splice(0, 1); //remove the type line
      let value = lines.join("\n");

      return {
        type: r[1],
        value: value,
      };
    }
  }

  static getContentTypesAndValues(
    str: string,
    fileName: string
  ): { type: string; value: string }[] {
    const res = [];
    const validMatches: RegExpMatchArray[] = [];

    const pattern: RegExp = /^(.*?):\n---/gm; //matches string between new line and ":\n---"
    let match: RegExpMatchArray | null;

    while ((match = pattern.exec(str)) !== null) {
      validMatches.push(match);
    }

    for (let i = 0; i < validMatches.length; i++) {
      console.log("\n" + fileName);

      let endOfValueIndex = undefined; //if undefined will get the content up until the end of it
      if (validMatches[i + 1]) endOfValueIndex = validMatches[i + 1].index;

      let key = validMatches[i][1];
      let value = str.substring(
        validMatches[i].index! + key.length + ":\n---".length,
        endOfValueIndex
      );

      res.push({
        type: key,
        value: value.trim(),
      });
    }
    // if no "prop-x:\n___" we use the default in config and we assume there is only one prop in the document
    if (res.length == 0) {
      res.push({
        type: ConfigController._configFile.misc.defaultContentProperty,
        value: str.trim(),
      });
    }
    return res;
  }

  static getLocalFoamId(foamId: string): string {
    let runs = foamId.split("/");
    if (runs.length == 1) {
      return runs[0];
    } else if (runs.length == 2) {
      return runs[1];
    } else {
      console.log("IPLD paths not supported yet. " + foamId);
      return foamId;
    }
  }
}
