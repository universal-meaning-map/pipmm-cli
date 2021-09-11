// @ts-ignore
import validatorFunction from "@ipld/schema-validation";
// @ts-ignore
import { parse as parser } from "ipld-schema";

export default class IpmmType {
  defaultName: string = "";
  represents: string = "";
  constrains: string = "";
  ipldSchema: string = "";
  validate: any;
  static typeDefinitionSchema = `type root struct {
      defaultName defaultName
      represents represents
      constrains  optional constrains
      typeDependencies optional typeDependencies
      ipldSchema  ipldSchema
    }   

    type defaultName string
    type represents string
    type constrains [string]
    type typeDependencies [string]
    type ipldSchema string`;

  constructor(typeObj: any, errorCallback: (error: string) => void) {
    try {
      if (this.isTypeDefinitionValid(typeObj, errorCallback)) {
        this.defaultName = typeObj.defaultName;
        this.represents = typeObj.represents;
        this.constrains = typeObj.constrains;
        this.ipldSchema = typeObj.ipldSchema;
      }
      const parsedSchema = parser(this.ipldSchema);
      this.validate = validatorFunction(parsedSchema);
    } catch (e) {
      errorCallback(
        "Fail to parse schema for " +
          this.defaultName +
          ". Schema: " +
          this.ipldSchema +
          " Error: " +
          e
      );
    }
  }

  isTypeDefinitionValid(typeDefinition: any, errorCallabck: (error: string) => void): boolean {
    try {
      const parsedSchema = parser(IpmmType.typeDefinitionSchema);
      this.validate = validatorFunction(parsedSchema);
      this.validate(typeDefinition, "root");
      return true;
    } catch (e) {
      if (errorCallabck)
        errorCallabck("Fail to validate " + this.defaultName + " - " + e);
      return false;
    }
  }

  isDataValid(data: any, errorCallabck: (error: string) => void): boolean {
    try {
      this.validate(data, "root");
      return true;
    } catch (e) {
      if (errorCallabck)
        errorCallabck("Fail to validate " + this.defaultName + " - " + e);
      return false;
    }
  }

  /*
  constructor(
    defaultName: string,
    represents: string,
    constrains: string,
    ipldSchema: string,
    errorCallback: (error:string) => void
  ) {
    this.defaultName = defaultName;
    this.represents = represents;
    this.constrains = constrains;
    this.ipldSchema = ipldSchema;
    
    try{
      const parsedSchema = parser(this.ipldSchema);
      this.validate = validatorFunction(parsedSchema);

    }
    catch(e){
      errorCallback("Fail to parse schema for "+defaultName+". Schema: "+this.ipldSchema+" Error: "+e)
    }
  }
  */
}
