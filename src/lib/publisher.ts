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
import Chunker from "./chunker";

export default class Publisher {
  static async toTwitter(fileName: string) {
    await Compiler.compileFile(
      ConfigController._configFile.resources.ipmmRepo,
      ConfigController._configFile.resources.notesRepo,
      fileName
    );

    let iid = await Referencer.makeIid(fileName);
    const namesWithHyphen = false;
    let body = await Publisher.makePublishElement(
      iid,
      ConfigController._configFile.publish.twitter.body,
      namesWithHyphen
    );

    if (!body) {
      console.log("Twitter body did not produce a valid output");
      return;
    }

    let chunks = Chunker.chunkItAll(body, 280);

    for (let c of chunks) {
      console.log(c);
      console.log("\n");
    }

    // Publisher.sendTwitterRequest(body);
  }

  static async toTelegram(fileName: string) {
    await Compiler.compileFile(
      ConfigController._configFile.resources.ipmmRepo,
      ConfigController._configFile.resources.notesRepo,
      fileName
    );

    let iid = await Referencer.makeIid(fileName);
    const namesWithHyphen = false;

    let body = await Publisher.makePublishElement(
      iid,
      ConfigController._configFile.publish.telegram.body,
      namesWithHyphen
    );

    if (!body) {
      console.log("Telegram body did not produce a valid output");
      return;
    }

    let chunks = Chunker.chunkItAll(body, 10000);
    /*
    for (let c of cs) {
      console.log(c.length);
      console.log(c);
      console.log("---");
    }
*/
    console.log(chunks);
    for (let c of chunks) {
      //console.log(c);
      //console.log("/n");
      await Publisher.sendTelegramRequest(c);
    }
  }

  static async toButtondown(fileName: string) {
    await Compiler.compileFile(
      ConfigController._configFile.resources.ipmmRepo,
      ConfigController._configFile.resources.notesRepo,
      fileName
    );

    let iid = await Referencer.makeIid(fileName);
    let namesWithHyphen = false;

    let subject = await Publisher.makePublishElement(
      iid,
      ConfigController._configFile.publish.buttondown.subject,
      namesWithHyphen
    );
    let body = await Publisher.makePublishElement(
      iid,
      ConfigController._configFile.publish.buttondown.body,
      namesWithHyphen
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

    console.log(subject);
    console.log("\n\n");
    console.log(body);
    // API access is now a paid feature
    //this.sendButtonDownRequest("https://api.buttondown.email/v1/emails", email);
  }

  static async makePublishElement(
    iid: string,
    elementConfig: PublishExportRun[],
    namesWithHyphen: boolean
  ) {
    let element = "";

    for (let runConfig of elementConfig) {
      element =
        element +
        (await Publisher.makePublishRun(iid, runConfig, namesWithHyphen));
    }
    return element;
  }

  static async makePublishRun(
    iid: string,
    runConfig: PublishExportRun,
    namesWithHyphen: boolean
  ) {
    let tiid = await Referencer.makeIid(runConfig.property);
    let expr = Referencer.makeExpr(iid, tiid);
    let exportTemplate = Publisher.getExportTemplate(
      runConfig.exportTemplateId
    );
    let filterArefLinks = true;
    let outuput = await InterplanetaryText.transclude(
      expr,
      exportTemplate!,
      iid,
      namesWithHyphen,
      filterArefLinks,
      "",
      ""
    );

    return outuput;
  }

  static async sendButtonDownRequest(endpoint: string, obj: any) {
    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    axios.defaults.headers.common = {
      Authorization:
        "Token " + ConfigController._configFile.publish.buttondown.apiKey,
    };

    await axios
      .post(endpoint, obj, config)
      .then(function (response) {
        console.log(response.data);
      })
      .catch(function (error) {
        Publisher.handleAxiosError(error);
      });
  }

  static async sendTwitterRequest(body: string) {
    //WIP
    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };
    axios.defaults.headers.common = {
      Authorization:
        "OAuth " + ConfigController._configFile.publish.buttondown.apiKey,
    };
    const endpoint =
      "https://api.twitter.com/2/tweets" +
      ConfigController._configFile.publish.telegram.apiKey +
      "/sendMessage";

    await axios
      .post(
        endpoint,
        {
          text: body,
        },
        config
      )
      .then(function (response) {
        console.log(response.data);
      })
      .catch(function (error) {
        Publisher.handleAxiosError(error);
      });
  }

  static async sendTelegramRequest(body: string) {
    const endpoint =
      "https://api.telegram.org/bot" +
      ConfigController._configFile.publish.telegram.apiKey +
      "/sendMessage";

    await axios
      .post(endpoint, {
        chat_id: ConfigController._configFile.publish.telegram.channelUserName,
        text: body,
        parse_mode: "Markdown",
      })
      .then(function (response) {
        console.log(response.data);
      })
      .catch(function (error) {
        Publisher.handleAxiosError(error);
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

  static handleAxiosError(error: any) {
    if (error.response) {
      // Request made and server responded
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.log(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log("Error", error.message);
    }
  }
}
