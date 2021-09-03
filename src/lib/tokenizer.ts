import FoamController from "./foamController";

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
    const ir = Tokenizer.wikilinkToIr(wl);
    const te = Tokenizer.makeTransclusionExpression(ir);
    return te;
  }

  static wikilinkToIr(wl: string): string {
    const fn = wl.slice(2, -2);
    const iid = FoamController.getIidFromFoamId(fn);
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
