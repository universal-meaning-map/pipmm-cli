
import * as Block from "multiformats/block";
import * as json from "multiformats/codecs/json";
import * as dagCbor from "@ipld/dag-cbor";
//import * as dagJSON from "@ipld/dag-json"  //doesn't exist yet?
import { sha256 as hasher } from "multiformats/hashes/sha2";

// @ts-ignore
import * as validator from "@ipld/schema-validation";
// @ts-ignore
import { parse as parser } from "ipld-schema";

export default class IpldController {
  static ipld: any;

  static anyToDagCborBlock = async (data: any): Promise<any> => {
    const value = data;
    const codec = dagCbor;
    const block = await Block.encode({ value, codec, hasher });
    return block;
  };  

  static geIidForFoamId = async (foamId: string): Promise<any> => {
    const block = await IpldController.anyToDagCborBlock(foamId.toLowerCase())
    return block.cid.toString();
  };

  static dataMatchesType = async (
    data: any,
    typeName: string,
    schema: string
  ): Promise<any> => {
    const parsedSchema = parser(schema);
    const validate = validator(parsedSchema);
    try {
      validate(data, typeName);
      return true;
    } catch (e) {
      console.log(e);
      return false;
    }
  };
}
