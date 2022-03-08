import * as path from "path";
import * as fs from "fs";
import { NoteWrap } from "./ipmm";
import { runInNewContext } from "vm";
import Referencer from "./referencer";
import { Res } from "./errorController";

export default class InterplanetaryText {
  static transclude = (aref: string): string => {
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
      Res.error("Unable to find property in note: " + iid, Res.saveError, note);
    }

    //We check what type it is (interplanetary-text, string or something else)
    if (type?.block.has("constrains")) {
      let constrains = type?.block.get("constrains");
      if (constrains[0] != Referencer.basicTypeInterplanetaryText) {
        return ipt;
      }
    }

    let compiled = [];

    if (ipt) {
      for (let run of ipt) {
        if (run[0] == "[") {
          let expr = JSON.parse(run);
          if (expr.length == 1) {
            //static transclusion
            compiled.push(InterplanetaryText.transclude(expr[0]));
          } else if (expr.length > 1) {
            //dynamic transclusion
            console.log(
              Res.error(
                "Dynamic transclusion found but still not supported:" + expr,
                Res.saveError
              )
            );
          }
        } else {
          compiled.push(run);
        }
      }
    }
    let text = compiled.join("");

    console.log(text);
    return text;
  };
}
