import Referencer from "./referencer";
import { Res } from "./errorController";
import { ExportTemplate } from "./configController";

export default class InterplanetaryText {
  static transclude = (aref: string, exportTemplate:ExportTemplate): string => {
    let runs = aref.split("/");
    let iid = runs[0];
    if (runs.length <= 1) {
      Res.error(
        "Missing Type IID to transclude for expr:" + aref,
        Res.saveError
      );
    }
    let tiid = runs[1];

    if (Referencer.iidToNoteWrap.has(tiid)) {
      let type = Referencer.iidToNoteWrap.get(tiid);
    } else {
      Res.error("Unable to find property for" + aref, Res.saveError);
    }

    let note = Referencer.iidToNoteWrap.get(iid);
    let type = Referencer.iidToNoteWrap.get(tiid);

    let ipt = note?.block.get(tiid);
    if (!ipt) {
      Res.error(
        "Unable to find property " + tiid + " in note " + iid,
        Res.saveError,
        note
      );
      //What to replace it with?
    }

    //We check what type it is (interplanetary-text, string or something else)
    if (type?.block.has("constrains")) {
      let constrains = type?.block.get("constrains");
      if (constrains[0] != Referencer.basicTypeInterplanetaryText) {
       // let linkTemplate ="[{transclusion}](https://xavivives.com/#?expr=%5B%22i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3clzfmhs7a%22,%5B%5B%22i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3ck7dwg62a%22,%22{iid}%22%5D%5D%5D)";
       return InterplanetaryText.buildStringTemplate(exportTemplate.aref, {
          transclusion: ipt,
          iid: iid,
        });
      }
    }

    let compiled = [];

    if (ipt) {
      for (let run of ipt) {
        if (run[0] == "[") {
          let expr = JSON.parse(run);
          if (expr.length == 1) {
            //static transclusion
            compiled.push(InterplanetaryText.transclude(expr[0],exportTemplate));
          } else if (expr.length > 1) {
            //dynamic transclusion
            Res.error(
              "Dynamic transclusion found but still not supported:" + expr,
              Res.saveError
            );
          }
        } else {
          compiled.push(run);
          //Create link?
        }
      }
    }
    let text = compiled.join("");
    console.log(text);
    return text;
  };

  static buildStringTemplate = (template: string, vars: any): string => {
    var format = require("string-template");
    let link = format(template, vars);
    return link;
  };
}
// Format using an object hash with keys matching [0-9a-zA-Z]+
