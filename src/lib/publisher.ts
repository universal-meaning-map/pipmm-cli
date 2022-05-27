import * as path from "path";
import * as fs from "fs";
import { NoteWrap } from "./ipmm";
import Referencer from "./referencer";
import { promises as fsPromises, readFile } from "fs";
import ConfigController, { ExportTemplate } from "./configController";
import Compiler from "./compiler";
import InterplanetaryText from "./interplanetaryText";
import axios from "axios";

export default class Publisher {
  static async toButtonDown(foamId: string) {
    const res = await Compiler.compileFile(
      ConfigController._configFile.resources.ipmmRepo,
      ConfigController._configFile.resources.notesRepo,
      foamId
    );

    let iid = await Referencer.makeIid(foamId);

    let subjectTiid = await Referencer.makeIid(
      ConfigController._configFile.publish.buttonDown.subjectProperty
    );

    //subject
    let subjectExpr = Referencer.makeExpr(iid, subjectTiid);
    let subjectExportTemplate = Publisher.getExportTemplate(
      ConfigController._configFile.publish.buttonDown.subjectExportTemplate
    );
    let subject = InterplanetaryText.transclude(
      subjectExpr,
      subjectExportTemplate!,
      iid,
      "",
      ""
    );

    //body
    let bodyTiid = await Referencer.makeIid(
      ConfigController._configFile.publish.buttonDown.bodyProperty
    );
    let bodyExpr = Referencer.makeExpr(iid, bodyTiid);
    let bodyExportTemplate = Publisher.getExportTemplate(
      ConfigController._configFile.publish.buttonDown.bodyExportTemplate
    );
    let body = InterplanetaryText.transclude(
      bodyExpr,
      bodyExportTemplate!,
      iid,
      "",
      ""
    );

    if(!subject || !body){
        console.log("Either the subject or the body did not produce a valid output");
        return;
    }

    const email = {
      subject: subject,
      body: body,
    };

    this.sendButtonDownRequest("https://api.buttondown.email/v1/drafts", email);
  }

  static sendButtonDownRequest(endpoint: string, obj: any) {
    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    axios.defaults.headers.common = {
      Authorization:
        "Token " + ConfigController._configFile.publish.buttonDown.apiKey,
    };

    axios
      .post(endpoint, obj, config)
      .then(function (response) {
        console.log(response.data);
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  static getExportTemplate(exportId: string): ExportTemplate | null {
    let existingExportIds = [];

    for (let t of ConfigController._configFile.export.stringTemplates) {
      if (t.exportId == exportId) {
        return t;
      }
      existingExportIds.push(t.exportId);
    }

    console.log(
      "The exportId '" +
        exportId +
        "' does not match any of the defined in " +
        ConfigController.configPath +
        " > export > stringTemplates"
    );
    console.log("Available exportIds: " + existingExportIds.join(", "));
    return null;
  }
}
