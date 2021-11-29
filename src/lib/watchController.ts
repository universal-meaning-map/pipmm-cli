import WebSocket from "ws";
import ConfigController from "./configController";
import chokidar from "chokidar";
import Path from "path";
import FoamController from "./foamController";
import Referencer from "./referencer";
import axios from "axios";
import { NoteWrap } from "./ipmm";
import Utils from "./utils";
import { Server as IpfoamServer } from "/home/xavings/dev/ipfoam-server";

//const WebSocket = require('isomorphic-ws')
export default class WatchController {
  webSocket: any;
  bridgeConnected = false;
  ipfoamServerPort = 8080;
  clientServerPort = 8081;
  clientWebsocketPort = 1234;

  start = async (): Promise<any> => {
    await this.startIpfoamServer();
    await this.restoreIpfoamServer();
    await this.startClientServer();
    await this.startFileWatcher();
    await this.startWs();
  };

  startClientServer = async (): Promise<any> => {
    const connect = require("connect");
    const serveStatic = require("serve-static");
    const path = "~/dev/ipfoam_client/build/web";
    const fullPath = Utils.resolveHome(path);

    connect()
      .use(serveStatic(fullPath))
      .listen(this.clientServerPort, () =>
        console.log(
          "Serving client on: " + "http://localhost:" + this.clientServerPort
        )
      );
  };

  /*startIpfoamServer = async (): Promise<any> => {
    var child_process = require("child_process");
    const path = "~/dev/ipfoam-server/";
    const fullPath = Utils.resolveHome(path);
    const command = "node --prefix " + fullPath + "run dev";
    let log = child_process.execSync("echo Hello World");
    console.log(log);
  };*/

  startIpfoamServer = async (): Promise<any> => {
    let server = new IpfoamServer(this.ipfoamServerPort);
    await server.startServer();
  };

  restoreIpfoamServer = async (): Promise<any> => {
    let repo = Utils.getFile(ConfigController.ipmmRepoPath);
    let data = JSON.parse(repo);
    const res = await axios.put(
      "http://localhost:" + this.ipfoamServerPort + "/restore/x",
      data
    );
  };

  startWs = async (): Promise<any> => {
    const that = this;
    console.log("Attempting WS connection on " + this.clientWebsocketPort);
    const wss = new WebSocket.Server({ port: this.clientWebsocketPort });

    //return new Promise((resolve, reject) => {
    wss.on("connection", function connection(ws: any) {
      console.log("Websocket connection to client established");
      that.webSocket = ws;
      that.bridgeConnected = true;
      that.webSocket.on("message", function message(data: any) {
        console.log("received: %s", data);
      });
      // resolve("Connected");
    });
    //});
  };

  notifyClient = async (iid: String): Promise<void> => {
    if (this.bridgeConnected) {
      this.webSocket.send(iid);
    } else {
      console.log(
        "Can't connecto to client. Try to reload http://localhost:" +
          this.clientServerPort
      );
    }
  };

  startFileWatcher = async (): Promise<any> => {
    let foamRepo = ConfigController.foamRepoPath;
    let that = this;
    console.log("Watching: " + foamRepo);

    const watcher = chokidar.watch(foamRepo, {
      ignoreInitial: true,
      interval: 1000,
      depth: 0,
      followSymlinks: false,
    });

    const onFileChanged = function (path: any): void {
      console.log(`File ${path} has been changed`);
      let foamId = Path.basename(path, Path.extname(path));
      that.reload(foamId);
    };

    watcher
      .on("add", onFileChanged)
      .on("change", onFileChanged)
      .on("unlink", (path) => console.log(`File ${path} has been removed`));
  };

  importFile = async (foamId: string): Promise<NoteWrap> => {
    const res = await FoamController.importFile(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath,
      foamId
    );

    let note: NoteWrap = res.value;
    if (res.isOk()) {
      // console.log(note.value);
    }

    return note;
  };

  updateServer = async (note: NoteWrap): Promise<Boolean> => {
    let notes: { [iid: string]: any } = {};
    notes[note.iid] = note;
    const res = await axios.put("http://localhost:8080/update/x", notes);
    return true;
  };

  reload = async (foamId: string): Promise<void> => {
    let note = await this.importFile(foamId);
    await this.updateServer(note);
    await this.notifyClient(note.iid);
  };
}
