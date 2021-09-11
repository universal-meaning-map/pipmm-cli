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
        type.ipldSchema = typeObj.ipldSchema;// await IpmmType.replaceFoamIdForTypeIid(typeObj.ipldSchema, type.typeDependencies)
      }
      
      if (type.typeDependencies && type.typeDependencies.length > 0)
      {
        try{ 

          type.ipldSchema = await type.makeCompiledSchema();
        }
        catch(e){
          console.log(e)
        }

      }

        console.log("making", type.defaultName)
        console.log("schema", type.ipldSchema)
      const parsedSchema = parser(type.ipldSchema);
      type.validate = validatorFunction(parsedSchema);
    } catch (e) {
      errorCallback(
        "Fail to parse schema for " +
          type.defaultName +
          "\nSchema: " +
          type.ipldSchema +
          "\nError: " +
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
      const typeIid = await Referencer.makeTypeIid(foamId);
      if (!Referencer.typeExists(typeIid))
        await FoamController.makeNote(foamId, true);
      if (!Referencer.typeExists(typeIid))
        throw "Type for " + foamId + " "+typeIid+" should exist already";
      const type = Referencer.getType(typeIid);
      compiledSchema += "\n" + type.ipldSchema;
    }
    compiledSchema = await IpmmType.replaceFoamIdForTypeIid(compiledSchema,this.typeDependencies);


    return compiledSchema;
  };

  isDataValid(data: any, errorCallabck: (error: string) => void): boolean {
    try {
      this.validate(data, this.defaultName);
      return true;
    } catch (e) {

      if (errorCallabck)
        errorCallabck("Fail to validate " + this.defaultName  +" - " + e);
      return false; 
    }
  }

  static replaceFoamIdForTypeIid = async(schema:string, typeDependencies:string[]):Promise<string> =>{
    let foamIdToIdMap: { [iid: string]: string } = {};
    for (const foamId of typeDependencies) {
      const typeIid= await Referencer.makeTypeIid(foamId)
      foamIdToIdMap[foamId] =typeIid //necessary to prevent ids starting with number
     }
     for (const foamId of typeDependencies) {
     schema = schema.split(foamId).join(foamIdToIdMap[foamId])
     }
     console.log(schema)
     return schema
  }

  
  
}
