import * as path from "path";
import * as fs from "fs";
import { NoteWrap } from "./ipmm";
import Referencer from "./referencer";
import { promises as fsPromises, readFile } from "fs";
import ConfigController, {
  ExportTemplate,
  PublishExportRun,
} from "./configController";
import Compiler from "./compiler";
import InterplanetaryText from "./interplanetaryText";
import axios from "axios";

export default class Publisher {
  static async toTelegram(foamId: string) {
    const res = await Compiler.compileFile(
      ConfigController._configFile.resources.ipmmRepo,
      ConfigController._configFile.resources.notesRepo,
      foamId
    );

    let iid = await Referencer.makeIid(foamId);

    let body = await Publisher.makePublishElement(
      iid,
      ConfigController._configFile.publish.telegram.body
    );

    if (!body) {
      console.log("Telegram body did not produce a valid output");
      return;
    }

    Publisher.sendTelegramRequest(body);
  }

  static async toButtonDown(foamId: string) {
    const res = await Compiler.compileFile(
      ConfigController._configFile.resources.ipmmRepo,
      ConfigController._configFile.resources.notesRepo,
      foamId
    );

    let iid = await Referencer.makeIid(foamId);

    let subject = await Publisher.makePublishElement(
      iid,
      ConfigController._configFile.publish.buttonDown.subject
    );
    let body = await Publisher.makePublishElement(
      iid,
      ConfigController._configFile.publish.buttonDown.body
    );

    if (!subject || !body) {
      console.log(
        "Either the subject or the body did not produce a valid output"
      );
      return;
    }

    const email = {
      subject: subject,
      body: body,
    };

    this.sendButtonDownRequest("https://api.buttondown.email/v1/drafts", email);
  }

  static async makePublishElement(
    iid: string,
    elementConfig: PublishExportRun[]
  ) {
    let element = "";

    for (let runConfig of elementConfig) {
      element = element + (await Publisher.makePublishRun(iid, runConfig));
    }
    return element;
  }

  static async makePublishRun(iid: string, runConfig: PublishExportRun) {
    let tiid = await Referencer.makeIid(runConfig.property);
    let expr = Referencer.makeExpr(iid, tiid);
    let exportTemplate = Publisher.getExportTemplate(
      runConfig.exportTemplateId
    );
    let outuput = InterplanetaryText.transclude(
      expr,
      exportTemplate!,
      iid,
      "",
      ""
    );

    return outuput;
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

  static async sendTelegramRequest(body: string) {
    const endpoint =
      "https://api.telegram.org/bot" +
      ConfigController._configFile.publish.telegram.apiKey +
      "/sendMessage";
    const obj = {
      params: {
        chat_id: ConfigController._configFile.publish.telegram.channelUserName,
        text: body,
      },
    };

    axios
      .post(endpoint, {
        chat_id: ConfigController._configFile.publish.telegram.channelUserName,
        text: body,
        parse_mode: "Markdown",
      })
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
