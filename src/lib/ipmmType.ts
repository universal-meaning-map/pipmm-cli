// @ts-ignore
import * as validatorFunction from "@ipld/schema-validation";
// @ts-ignore
import { parse as parser } from "ipld-schema";

export default class IpmmType {
  defaultName: string;
  represents: string;
  constrains: string;
  ipldSchema: string;
  validate: any;

  constructor(
    defaultName: string,
    represents: string,
    constrains: string,
    ipldSchema: string
  ) {
    
   

      this.defaultName = defaultName;
      this.represents = represents;
      this.constrains = constrains;
      this.ipldSchema = ipldSchema;
   
    const parsedSchema = parser(this.ipldSchema);
    this.validate = validatorFunction(parsedSchema);
  }

  isDataValid(data: any): boolean {
    try {
      this.validate(data, "root");
      return true;
    } catch (e) {
      console.log("Fail to validate "+this.defaultName)
      console.log(e);
      console.log(data)
      return false;
    }
  }
}
