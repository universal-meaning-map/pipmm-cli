import WebSocket from "ws";
import ConfigController from "./configController";
import chokidar from "chokidar";
import Path from "path";
import FoamController from "./foamController";
import Referencer from "./referencer";
import axios from "axios";
import { NoteWrap } from "./ipmm";
import Utils from "./utils";

//const WebSocket = require('isomorphic-ws')

export default class WatchController {
  webSocket: any;

  start = async (): Promise<any> => {
    await this.startWs();
    await this.startFileWatcher();
    await this.startClientServer();
  };

  startClientServer = async (): Promise<any> => {
    const connect = require("connect");
    const serveStatic = require("serve-static");
    const port = 8082;
    const path = "~/dev/ipfoam_client/build/web";
    const fullPath = Utils.resolveHome(path);

    connect()
      .use(serveStatic(fullPath))
      .listen(port, () => console.log("Serving client on: " + port));
  };

  startIpfoamServer = async (): Promise<any> => {
    var child_process = require("child_process");
    const path = "~/dev/ipfoam_server/";
    const fullPath = Utils.resolveHome(path);
    const command = "node --prefix " + fullPath + "run dev";
    let log = child_process.execSync("echo Hello World");
    console.log(log);
  };

  startWs = async (): Promise<any> => {
    const that = this;
    const port = 1234;
    console.log("Creating WS connection on " + port);
    const wss = new WebSocket.Server({ port: port });

    wss.on("connection", function connection(ws: any) {
      that.webSocket = ws;
      that.webSocket.on("message", function message(data: any) {
        console.log("received: %s", data);
      });

      that.webSocket.send("something");
    });
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
    console.log(res.data);
    return true;
  };

  notifyClient = async (iid: String): Promise<void> => {
    this.webSocket.send(iid);
  };

  reload = async (foamId: string): Promise<void> => {
    let note = await this.importFile(foamId);
    await this.updateServer(note);
    await this.notifyClient(note.iid);
  };
}
