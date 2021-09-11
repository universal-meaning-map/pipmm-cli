// @ts-ignore
import validatorFunction from "@ipld/schema-validation";
// @ts-ignore
import { parse as parser } from "ipld-schema";
import FoamController from "./foamController";
import Referencer from "./referencer";

export default class IpmmType {
  defaultName: string = "";
  represents: string = "";
  constrains: string[] = [];
  typeDependencies: string[] = [];
  ipldSchema: string = "";
  validate: any;
  static typeDefinitionSchema = `type TypeDefinition struct {
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

  static create = async (
    typeObj: any,
    errorCallback: (error: string) => void
  ): Promise<IpmmType> => {
    let type = new IpmmType();
    try {
      if (IpmmType.isTypeDefinitionValid(typeObj, errorCallback)) {
        type.defaultName = typeObj.defaultName;
        type.represents = typeObj.represents;
        type.constrains = typeObj.constrains;
        type.typeDependencies = typeObj.typeDependencies;
        type.ipldSchema = typeObj.ipldSchema;
      }
      if (type.typeDependencies && type.typeDependencies.length > 0)
        type.ipldSchema = await type.makeCompiledSchema();
      const parsedSchema = parser(type.ipldSchema);
      type.validate = validatorFunction(parsedSchema);
    } catch (e) {
      errorCallback(
        "Fail to parse schema for " +
          type.defaultName +
          ". Schema: " +
          type.ipldSchema +
          " Error: " +
          e
      );
    }
    return type;
  };

  static isTypeDefinitionValid(
    typeDefinition: any,
    errorCallabck: (error: string) => void
  ): boolean {
    try {
      const parsedSchema = parser(IpmmType.typeDefinitionSchema);
      const validate = validatorFunction(parsedSchema);
      validate(typeDefinition, "TypeDefinition");
      return true;
    } catch (e) {
      if (errorCallabck) errorCallabck("Fail to validate type definition:" + e);
      return false;
    }
  }

  makeCompiledSchema = async (): Promise<string> => {
    let compiledSchema = this.ipldSchema;
    for (const foamId of this.typeDependencies) {
      const typeIid = await Referencer.makeIId(foamId);
      if (!Referencer.typeExists(typeIid))
        await FoamController.makeNote(foamId, true);
      if (!Referencer.typeExists(typeIid))
        throw "Type for " + foamId + " should exist already";
      const type = Referencer.getType(typeIid);
      compiledSchema += "\n" + type.ipldSchema;
    }
    console.log("COMPILED");
    console.log(compiledSchema);
    return compiledSchema;
  };

  isDataValid(data: any, errorCallabck: (error: string) => void): boolean {
    try {
      this.validate(data, this.defaultName);
      return true;
    } catch (e) {
      console.log("PRoblema", this.defaultName);
      console.log(this.ipldSchema);
      console.log(data);
      if (errorCallabck)
        errorCallabck("Fail to validate " + this.defaultName  +" - " + e);
      return false; 
    }
  }
}
