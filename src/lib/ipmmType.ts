// @ts-ignore
import validatorFunction from "@ipld/schema-validation";
// @ts-ignore
import { parse as parser } from "ipld-schema";
import Compiler from "./compiler";
import Referencer from "./referencer";

export default class IpmmType {
  defaultName: string = "";
  represents: string = "";
  constrains: string[] = [];
  typeDependencies: string[] = [];
  enumDependencies: string[] = [];
  ipldSchema: string = "";
  validate: any;

  static foamIdToIdMap: { [iid: string]: string } = {};

  static typeDefinitionSchema = `type TypeDefinition struct {
      defaultName defaultName
      represents represents
      constrains optional constrains
      typeDependencies optional typeDependencies
      enumDependencies optional enumDependencies
      ipldSchema  ipldSchema
    }   

    type defaultName string
    type represents string
    type constrains [string]
    type typeDependencies [string]
    type enumDependencies [string]
    type ipldSchema string`;

  getBlock() {
    let block: Map<string, any> = new Map();
    if (this.defaultName != "" && this.defaultName != null)
      block.set("defaultName", this.defaultName);
    if (this.represents != "" && this.represents != null)
      block.set("represents", this.represents);
    if (this.constrains != [] && this.constrains != null)
      block.set("constrains", this.constrains);
    if (this.typeDependencies != [] && this.typeDependencies != null)
      block.set("typeDependencies", this.typeDependencies);
    if (this.enumDependencies != [] && this.enumDependencies != null)
      block.set("enumDependencies", this.enumDependencies);
    if (this.ipldSchema != "" && this.ipldSchema != null)
      block.set("ipldSchema", this.ipldSchema);

    return block;
  }

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
        type.enumDependencies = typeObj.enumDependencies;
        type.ipldSchema = typeObj.ipldSchema; // await IpmmType.replaceFoamIdForTypeIid(typeObj.ipldSchema, type.typeDependencies)
      }
      /*
      if (type.typeDependencies && type.typeDependencies.length > 0) {
        try {
          type.ipldSchema = await type.replaceTypes();
        } catch (e) {
          errorCallback(String(e));
        }
      }
      */
      if (type.enumDependencies && type.enumDependencies.length > 0) {
        try {
          type.ipldSchema = await type.replaceEnums();
        } catch (e) {
          errorCallback(String(e));
        }
      }

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

  //Fetches the type dependencies. Processess its types. Gets their schema.
  //Compiles all the schemas into one. Replaces all the property keys for their intent ids

  /* //ONLY UDED by Reference type
  replaceTypes = async (): Promise<string> => {
    let compiledSchema = this.ipldSchema;

    for (const foamId of this.typeDependencies) {
      const typeIid = await Referencer.makeIid(foamId);
      if (!Referencer.typeExists(typeIid))
        await Compiler.makeNote(foamId, fileName, true);
      if (!Referencer.typeExists(typeIid))
        throw "Type for " + foamId + " " + typeIid + " should exist already";
      const type = Referencer.getType(typeIid);
      //We replace the "root" for its IId
      const schemaWithRootChanged = type.ipldSchema.replace("root", typeIid);

      compiledSchema += "\n" + schemaWithRootChanged;
    }
    compiledSchema = await IpmmType.replaceFoamIdForTypeIid(
      compiledSchema,
      this.typeDependencies
    );
    return compiledSchema;
  };

  */

  replaceEnums = async (): Promise<string> => {
    let compiledSchema = this.ipldSchema;

    compiledSchema = await IpmmType.replaceFoamIdForTypeIid(
      compiledSchema,
      this.enumDependencies
    );
    return compiledSchema;
  };

  isDataValid(
    data: any,
    errorCallabck: (errorMessage: string, errorContext?: any) => void
  ): boolean {
    try {
      this.validate(data, "root");
      return true;
    } catch (e) {
      if (errorCallabck)
        errorCallabck("Data don't match the schema`" + this.defaultName, {
          data: data,
          schema: this.ipldSchema,
          typesMap: IpmmType.foamIdToIdMap,
        });
      return false;
    }
  }

  static replaceFoamIdForTypeIid = async (
    schema: string,
    typeDependencies: string[]
  ): Promise<string> => {
    let foamIdToIdMap: { [iid: string]: string } =
      await IpmmType.updateFoamIdToTypeIid(typeDependencies);

    for (const foamId of typeDependencies) {
      schema = schema.split(foamId).join(foamIdToIdMap[foamId]);
    }
    return schema;
  };

  static updateFoamIdToTypeIid = async (
    typeDependencies: string[]
  ): Promise<{ [iid: string]: string }> => {
    for (const foamId of typeDependencies) {
      let typeIid = IpmmType.foamIdToIdMap[foamId];
      if (!IpmmType.foamIdToIdMap[foamId]) {
        typeIid = await Referencer.makeIid(foamId);
        IpmmType.foamIdToIdMap[foamId] = typeIid;
      }
    }
    return IpmmType.foamIdToIdMap;
  };
}
