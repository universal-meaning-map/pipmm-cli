import * as Block from "multiformats/block";
import * as dagCbor from "@ipld/dag-cbor";
import * as dagJSON from "@ipld/dag-json"; //doesn't exist yet?
import { sha256 as hasher } from "multiformats/hashes/sha2";

export default class IpldController {
  static ipld: any;

  static anyToDagJsonBlock = async (data: any): Promise<any> => {
    const value = data;
    const codec = dagJSON;
    const block = await Block.encode({ value, codec, hasher });
    return block;
  };
}
