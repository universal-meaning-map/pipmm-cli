import { Res } from "./errorController";
import Referencer from "./referencer";

export default class Tokenizer {
  static splitToken = "<split>";

  static wikilinksToInterplanetaryText = async (
    text: string,
    foamId: string
  ): Promise<string[]> => {
    const splitReplaced = await Tokenizer.wikilinksToTransclusions(
      text,
      foamId
    );
    return splitReplaced.split(Tokenizer.splitToken);
  };

  static wikilinksToTransclusions = async (
    text: string,
    foamId: string
  ): Promise<string> => {
    const wikilinkWithTokens = /\[{2}(.*?)\]{2}/g;
    //let wikilinkWithoutTokens = /[^[\]]+(?=]])/g;

    let doneCallback = async (
      match: string,
      wikilink: string,
      offset: string,
      original: string
    ) => {
      await Tokenizer.checkFoamId(wikilink, foamId);
      const transclusionExp = await Tokenizer.wikilinkToTransclusionExp(
        wikilink
      );
      return Tokenizer.addSplitTokens(transclusionExp);
    };

    return await Tokenizer.replaceAsync(text, wikilinkWithTokens, doneCallback);
  };

  static wikilinkToTransclusionExp = async (
    wikilink: string
  ): Promise<string> => {
    const intentRef = await Tokenizer.wikilinkToItentRef(wikilink);
    const transclusionExp = Tokenizer.makeTransclusionExp(intentRef);
    return transclusionExp;
  };

  static addSplitTokens(transclusionExp: string) {
    return Tokenizer.splitToken + transclusionExp + Tokenizer.splitToken;
  }

  static wikilinkToItentRef = async (wikilink: string): Promise<string> => {
    const fileName = wikilink.slice(2, -2); //removes square brackets
    const iid = await Referencer.makeIid(fileName);
    const propTitleIid = await Referencer.makeIid(Referencer.PROP_TITLE_FOAMID);
    const intentRef = iid + "/" + propTitleIid;
    return intentRef;
  };

  static makeTransclusionExp(intentRef: string) {
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
        "Note " + requesterFoamId + " contains spaces: " + wikilink,
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
}
