import WebSocket from "ws";
import ConfigController from "./configController";
import chokidar from "chokidar";
import Path from "path";
import FoamController from "./foamController";
import Referencer from "./referencer";
import axios from "axios";
import { NoteWrap } from "./ipmm";

//const WebSocket = require('isomorphic-ws')

export default class WatchController {
  startWs = async (): Promise<any> => {
    const port = 1234;
    console.log("Creating WS connection on " + port);
    const wss = new WebSocket.Server({ port: port });

    wss.on("connection", function connection(ws: any) {
      ws.on("message", function message(data: any) {
        console.log("received: %s", data);
      });

      ws.send("something");
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
    console.log(watcher.getWatched());
  };

  importFile = async (foamId: string): Promise<NoteWrap> => {
    const res = await FoamController.importFile(
      ConfigController.ipmmRepoPath,
      ConfigController.foamRepoPath,
      foamId
    );

    let note: NoteWrap = res.value;
    console.log("Note");
    console.log(note);
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

  reload = async (foamId: string): Promise<void> => {
    let note = await this.importFile(foamId);
    await this.updateServer(note);
  };
}
