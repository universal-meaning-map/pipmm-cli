import Referencer from "./referencer";

export default class Tokenizer {
  
  static wikilinksToTransclusions = async (text: string): Promise<string> => {
    const wikilinkWithTokens = /\[{2}(.*?)\]{2}/g;
    //let wikilinkWithoutTokens = /[^[\]]+(?=]])/g;

    let doneCallback = async (
      match: string,
      wikilink: string,
      offset: string,
      ori: string
    ) => await Tokenizer.wikilinkToTransclusionExp(wikilink);

    return await Tokenizer.replaceAsync(text, wikilinkWithTokens, doneCallback);
  };

  static wikilinkToTransclusionExp = async (
    wikilink: string
  ): Promise<string> => {
    const intentRef = await Tokenizer.wikilinkToItentRef(wikilink);
    const transclusionExp = Tokenizer.makeTransclusionExp(intentRef);
    return transclusionExp;
  };

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
}
