//const Ipld = require("ipld");
//const IpfsRepo = require("ipfs-repo");
//const IpfsBlockService = require("ipfs-block-service");
//import  Ipld = require("ipld");

import * as Block from "multiformats/block";
import * as json from "multiformats/codecs/json";
import * as dagCbor from "@ipld/dag-cbor";
//import * as dagJSON from "@ipld/dag-json"  //doesn't exist yet?
import { sha256 as hasher } from "multiformats/hashes/sha2";
import { CID } from "multiformats/cid";

export default class IpldController {
  static ipld: any;

  static anyToDagCborBlock = async (data: any): Promise<any> => {
    //console.log(Block)
    const value = data;
    const codec = dagCbor;
    const block = await Block.encode({ value, codec, hasher });
    return block;
  };
}
