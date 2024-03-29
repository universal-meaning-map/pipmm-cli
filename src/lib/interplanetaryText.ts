import Referencer from "./referencer";
import { Res } from "./errorController";
import ConfigController, { ExportTemplate } from "./configController";
import Filter from "./filterController";
import { NoteWrap } from "./ipmm";
import Utils from "./utils";
import SemanticSearch from "./semanticSearch";

export default class InterplanetaryText {
  static transclude = async (
    aref: string,
    exportTemplate: ExportTemplate,
    requesterIid: string,
    namesWithHyphen: boolean,
    filterArefLinks: boolean,
    v1: string,
    v2: string
  ): Promise<string> => {
    let runs = aref.split("/");
    let iid = runs[0];
    if (runs.length <= 1) {
      Res.error(
        "Missing Type IID to transclude for expr:" + aref,
        Res.saveError
      );
    }
    let tiid = runs[1];

    let repo = Referencer.iidToNoteWrap;
    if (namesWithHyphen) {
      repo = await Referencer.getRepoWithHyphenNames();
    }

    if (repo.has(tiid)) {
      let type = repo.get(tiid);
    } else {
      Res.error("Property type does not exist: " + tiid, Res.saveError);
    }

    let note = repo.get(iid);
    let type = repo.get(tiid);

    let ipt = note?.block.get(tiid);

    let templateVariables = {
      transclusion: ipt,
      iid: iid,
      localIid: Referencer.getLocalIidFromIid(iid),
      requesterIid: requesterIid,
      v1: v1,
      v2: v2,
    };

    if (!ipt) {
      Res.error(
        "Unable to find property " + tiid + " in note " + iid,
        Res.saveError,
        note
      );

      return InterplanetaryText.buildStringTemplate(
        exportTemplate.arefNotFound,
        templateVariables
      );
    }

    //We check what type it is (interplanetary-text, string or something else)
    if (type?.block.has("constrains")) {
      let constrains = type?.block.get("constrains");
      if (constrains[0] != Referencer.basicTypeInterplanetaryText) {
        // let linkTemplate ="[{transclusion}](https://xavivives.com/#?expr=%5B%22i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3clzfmhs7a%22,%5B%5B%22i12D3KooWBSEYV1cK821KKdfVTHZc3gKaGkCQXjgoQotUDVYAxr3ck7dwg62a%22,%22{iid}%22%5D%5D%5D)";
        let passesLinkFilter =
          note != undefined &&
          (await InterplanetaryText.passesLinkFilter(note));

        if (filterArefLinks && passesLinkFilter) {
          //console.log("filter passed💧");
          return InterplanetaryText.buildStringTemplate(
            "{transclusion}",
            templateVariables
          );
        } else {
          // console.log("filter failed💄");
          return InterplanetaryText.buildStringTemplate(
            exportTemplate.aref,
            templateVariables
          );
        }
      }
    }

    let compiled = [];

    if (ipt) {
      for (let run of ipt) {
        if (run[0] == "[") {
          let expr = JSON.parse(run);
          if (expr.length == 1) {
            //static transclusion
            compiled.push(
              await InterplanetaryText.transclude(
                expr[0],
                exportTemplate,
                requesterIid,
                namesWithHyphen,
                filterArefLinks,
                v1,
                v2
              )
            );
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
    return text;
  };

  static buildStringTemplate = (template: string, vars: any): string => {
    var format = require("string-template");
    let link = format(template, vars);
    return link;
  };

  static passesLinkFilter = async (note: NoteWrap): Promise<boolean> => {
    let filterJson = Utils.getFile(
      ConfigController._configFile.resources.arefLinkVisibilityFilter
    );
    let filter = JSON.parse(filterJson);
    return !(await Filter.eval(filter, note));
  };
}
// Format using an object hash with keys matching [0-9a-zA-Z]+
