import FoamController from "./foamController";
import IpldController from "./ipldController";

export default class Tokenizer {
  static wikilinksToTransclusions(text: string): string {
    const wikilinkWithTokens = /\[{2}(.*?)\]{2}/g;
    //let wikilinkWithoutTokens = /[^[\]]+(?=]])/g;
    const res = text.replace(
      wikilinkWithTokens,
      this.wikilinkToTransclusionExpression
    );
    return res;
  }

  static wikilinkToTransclusionExpression(wl: string): string {
    const ir = Tokenizer.wikilinkToItentReference(wl);
    const te = Tokenizer.makeTransclusionExpression(ir);
    return te;
  }

  static wikilinkToItentReference(wikilink: string): string {
    const fileName = wikilink.slice(2, -2);//removes square brackets
    const iid = IpldController.makeIIdFromFoamIdOrFileName(fileName);
    const propTitleIid = FoamController.PROP_TITLE_FOAMID
    // console.log(iid);
    const ir = iid + "/prop-Title-1612697362";
    return ir;
  }

  static makeTransclusionExpression(ir: string) {
    const t: string[] = [ir];
    const te = JSON.stringify(t);
    return te;
  }
}
