import WebSocket from "ws";
import ConfigController from "./configController";
import chokidar from "chokidar";
import Path from "path";
import FoamController from "./foamController";
import Referencer from "./referencer";
import axios from "axios";
import { NoteWrap } from "./ipmm";
import Utils from "./utils";
import { Server as PipmmmServer } from "pipmm-server";

export default class WatchController {
  webSocket: any;
  bridgeConnected = false;

  start = async (): Promise<any> => {
    await this.startPipmmmServer();
    await this.restorePipmmmServer();
    await this.startClientServer();
    await this.startFileWatcher();
    await this.startWs();
  };

  startClientServer = async (): Promise<any> => {
    const connect = require("connect");
    const serveStatic = require("serve-static");
    const path = Path.join( __dirname +"../../../client");
    console.log("Serving client in: "+ path)
    const fullPath = Utils.resolveHome(path);
    connect()
      .use(serveStatic(fullPath))
      .listen(ConfigController._configFile.network.localClientPort, () =>
        console.log("Serving client at: " + this.buildClientUrl())
      );
  };

  startPipmmmServer = async (): Promise<any> => {
    let server = new PipmmmServer(
      ConfigController._configFile.network.localServerPort
    );
    await server.startServer();
  };

  restorePipmmmServer = async (): Promise<any> => {
    await FoamController.compileAll(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath
    );
    let data = Referencer.iidToNoteWrap;
    const res = await axios.put(
      "http://localhost:" +
        ConfigController._configFile.network.localServerPort +
        "/restore/x",
      Utils.notesWrapToObjs(data)
    );
  };

  buildClientUrl = () => {
    //localhost:8081/#?expr=[%22is6hvlinq2lf4dbua%22,%22is6hvlinqxoswfrpq%22]
    http: return (
      "http://localhost:" +
      ConfigController._configFile.network.localClientPort +
      "/#?websocketsPort=" +
      ConfigController._configFile.network.websocketsPort +
      "&localServerPort=" +
      ConfigController._configFile.network.localServerPort +
      "&expr=" +
      this.buildDefaultRun()
    );
  };
  buildDefaultRun = () => {
    let mid = ConfigController._configFile.identity.mid; //hard code the renders since is not relative to the author
    let liidColumNavigator = mid + "lzfmhs7a";
    let liidSubAbstractionBlock = mid + "2lf4dbua";
    let liidTemp = mid + "sdqwz4ea";
    //let expr = [liidColumNavigator, [liidSubAbstractionBlock, liidTemp]];
    let expr = "http://localhost:56565/#?localServerPort=45454&websocketsPort=34343&expr=[%22QmXPTSJee8a4uy61vhAs35tM5bXDomSmo1BbTMUVAVbAGJlzfmhs7a%22,[[%22QmXPTSJee8a4uy61vhAs35tM5bXDomSmo1BbTMUVAVbAGJ2lf4dbua%22,%22QmXPTSJee8a4uy61vhAs35tM5bXDomSmo1BbTMUVAVbAGJamsdlhba%22]]]"
    return JSON.stringify(expr);

  };

  startWs = async (): Promise<any> => {
    const that = this;
    console.log(
      "Attempting WS connection on " +
        ConfigController._configFile.network.websocketsPort
    );
    const wss = new WebSocket.Server({
      port: ConfigController._configFile.network.websocketsPort,
    });

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

  notifyClient = async (iid: string): Promise<void> => {
    if (this.bridgeConnected) {
      this.webSocket.send(iid);
    } else {
      console.log(
        "Can't connecto to client. Try to reload http://localhost:" +
          ConfigController._configFile.network.localClientPort +
          "/#bridgePort=" +
          ConfigController._configFile.network.websocketsPort
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
    const res = await FoamController.compileFile(
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
    let notes: Map<string, NoteWrap> = new Map();
    notes.set(note.iid, note);
    const res = await axios.put(
      "http://localhost:" +
        ConfigController._configFile.network.localServerPort +
        "/update/x",
      Utils.notesWrapToObjs(notes)
    );
    return true;
  };

  reload = async (foamId: string): Promise<void> => {
    let note = await this.importFile(foamId);
    await this.updateServer(note);
    await this.notifyClient(note.iid);
  };
}
