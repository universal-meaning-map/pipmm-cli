import { NoteType } from "./ipmm";
import * as ipc from "node-ipc";

export default class DaemonServer {
  private static repo: NoteType[];
  static ipcId: string = "ipmmm-daemon";

  public static init = async () => {
    ipc.config.id = DaemonServer.ipcId;
    ipc.config.retry = 1500;
    ipc.config.silent = true;
    ipc.serve(() =>
      ipc.server.on("isRunning", (message) => {
        console.log(message);
      })
    );
    ipc.server.start();
    console.log("Ipmm-daemon started and listening...");
  };
}
