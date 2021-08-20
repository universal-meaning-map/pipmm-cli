//const Ipld = require("ipld");
//const IpfsRepo = require("ipfs-repo");
//const IpfsBlockService = require("ipfs-block-service");
//import  Ipld = require("ipld");

import * as Block from "multiformats/block"
import * as dagCbor from "@ipld/dag-cbor"
//import * as dagJSON from "@ipld/dag-json"  //doesn't exist yet?
import {sha256 as hasher} from "multiformats/hashes/sha2"

export default class IpldController {
   static ipld: any;

   static put = async (note:any):Promise <string> =>{
     //console.log(Block)
     const value = note;
     const codec = dagCbor

     let block = await Block.encode({value, codec, hasher})

     console.log(block.cid, block.value, block.cid)

     //return block.cid
    return ""
   }

  /*static init = async (ipfsRepoPath: string): Promise<void> => {
    console.log(IpfsRepo)
    //const repo =  new IpfsRepo(ipfsRepoPath);
    //await repo.init({});
    //await repo.open();
    //const blockService = new IpfsBlockService(repo);
    //sIpldController.ipld = Ipld({ blockService: blockService });
  };
  */
/*
  static put = async (node:any):Promise<string> =>{
    const cid = (await IpldController.ipld.put(node, { format: 'dag-cbor', hashAlg: 'sha2-256' })).toString()
    return cid 
 }
  static get = async (cid:string):Promise<any>=> {
      return {}

  }
  */

}
