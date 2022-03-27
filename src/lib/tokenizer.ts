import { run } from "..";
import { Res } from "./errorController";
import Compiler from "./compiler";
import Referencer from "./referencer";
import ConfigController from "./configController";

export default class Tokenizer {
  static splitToken = "<split>";
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
      await Tokenizer.checkFoamId(wikilink, requesterFoamId);
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
    assumeTitleTransclusion: boolean,
    requesterFoamId: string,
    compileInterplanetaryTextArefs: boolean
  ): Promise<string> => {
    //folder/foamid|property/subProperty --> mid:iid/tiid/subProperty
    let runs = wikilink.split("|");

    let foamId = Referencer.updaterFoamIdWithFriendFolder(
      runs[0],
      requesterFoamId
    );

    let iid = await Referencer.makeIid(foamId);

    if (compileInterplanetaryTextArefs) {
      if (!Referencer.iidToNoteWrap.has(iid))
        await Compiler.makeNote(foamId, false, false, requesterFoamId);
    }

    let exp = iid;

    if (runs.length == 1) {
      if (assumeTitleTransclusion) {
        exp =
          exp +
          "/" +
          (await Referencer.makeIid(
            Referencer.makeFoamIdRelativeToXaviIfIsNotXavi(
              Referencer.PROP_NAME_FOAMID
            )
          ));
      }
    } else if (runs.length > 1) {
      let backRuns = runs[1].split("/");
      let tiid = await Referencer.makeIid(backRuns[0]);
      exp = exp + "/" + tiid;
      if (backRuns.length > 1) {
        for (let i = 1; i < backRuns.length; i++) {
          //We only assume the first property to be an iid, the rest is an IPLD path
          exp = exp + "/" + backRuns[i];
        }
      }
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
    wikilink: string,
    requesterFoamId: string
  ): Promise<void> => {
    //wikilinks should not include extension
    if (Tokenizer.containsMdExtension(wikilink))
      Res.error(
        "Note " +
          requesterFoamId +
          " contains wikilink with .md extension. Wikilink: " +
          wikilink,
        Res.saveError
      );

    if (Tokenizer.containsSpaces(wikilink))
      Res.error(
        "Note " +
          requesterFoamId +
          " contains a reference with spaces: " +
          wikilink,
        Res.saveError
      );
    //new wikilinks should be formated with timestmap in the back.
    //Super crappy check that will last 5 years
    if (Tokenizer.containsUpperCase(wikilink))
      Res.error(
        "Note " +
          requesterFoamId +
          " contains wikilink with upercase. Wikilink: " +
          wikilink,
        Res.saveError
      );
    //No upper case allowed
    if (Tokenizer.foamIdDoesNotContainTimestamp(wikilink))
      Res.error(
        "Note " +
          requesterFoamId +
          " contains wikilink without timestamp. Wikilink: " +
          wikilink,
        Res.saveError
      );
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

  static foamIdDoesNotContainTimestamp(str: string): boolean {
    if (str.indexOf("-16") == -1 || str.indexOf("-17") == -1) return false;
    return true;
  }

  static getTyeForContent(str: string) {
    let expression = /\s*([^:]*?)\s*:\s*([^:\s]*)/g; //matches str in front of semicolon
    let regex = new RegExp(expression);
    let firstLine = str.split("\n", 1)[0];
    let r = regex.exec(firstLine);
    if (r == null) {
      return Referencer.PROP_VIEW_FOAMID;
    } else {
      return r[1];
    }
  }
}
