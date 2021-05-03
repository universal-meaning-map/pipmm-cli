import { NoteType } from "./ipmm";
import * as ipc from "node-ipc";
import DaemonServer from "./daemonServer";

export default class DaemonClient {
 
  static ipcId =  "ipmmm-cli-client"


  public static init = () => {
    console.log(DaemonServer.ipcId)
    ipc.config.id = DaemonClient.ipcId;
    ipc.config.retry = 15000;
    ipc.config.silent = false;
    ipc.connectTo(DaemonServer.ipcId, () => {
      ipc.of[DaemonServer.ipcId].on('connect', () => {
        console.log("Connected to ipmm-daemon")
        ipc.of[DaemonServer.ipcId].emit('isRunning', "ID123");
      });
    });
  };
}
