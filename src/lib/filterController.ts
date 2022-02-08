import { NoteWrap } from "./ipmm";
import Referencer from "./referencer";
import IpmmType from "./ipmmType";
import Utils from "./utils";
import ConfigController from "./configController";

export default class Filter {
  static OR: string = "or";
  static AND: string = "and";
  static NOT: string = "not";
  static CONTAINS: string = "contains";
  static IS_EMPTY: string = "isEmpty";
  static IS_EQUAL: string = "isEqual";
  static IS_BIGGER: string = "isBigger";
  static IS_SMALLER: string = "isSmaller";
  static IS_TYPE: string = "isType";

  static filter = async (
    notesInput: Map<string, NoteWrap>,
    filter: any
  ): Promise<Map<string, NoteWrap>> => {
    let filtered: Map<string, NoteWrap> = new Map();

    for (let [iid, note] of notesInput.entries()) {
      if (await Filter.eval(filter, note)) {
        filtered.set(iid, note);
      }
    }


    filtered = await  Filter.addAlwaysCompileNotes(filtered);

    return filtered;
  };

  
  static addAlwaysCompileNotes = async (
    notesInput: Map<string, NoteWrap>,
    
  ): Promise<Map<string, NoteWrap>> => {
    
    for (let foamId of ConfigController._configFile.compile.alwaysCompile) {
      let iid = await Referencer.makeIid(foamId)
      console.log("adding ", foamId, iid)
      let noteWrap = Referencer.iidToNoteWrap.get(iid);
      if(noteWrap){
        notesInput.set(iid,noteWrap);
      }
      else{
        console.log("Unable to find "+foamId+" when adding 'always compile' notes to the filtered ones");
      }
    }

    return notesInput;
  };
  

  static eval = async (element: any, note: NoteWrap): Promise<Boolean> => {
    try {
      if (Utils.isObject(element)) {
        //NO FILTER
        if (Utils.objectIsEmpty(element)) {
          return true;
        }
        //AND
        if (Filter.AND in element) {
          let ands: Boolean[] = [];
          for (let e of element[Filter.AND]) {
            ands.push(await Filter.eval(e, note));
          }
          return ands.includes(false) ? false : true;
        }
        //OR
        if (Filter.OR in element) {
          let ors: Boolean[] = [];
          for (let e of element[Filter.OR]) {
            ors.push(await Filter.eval(e, note));
          }
          return ors.includes(true) ? true : false;
        }
        //NOT
        if (Filter.NOT in element) {
          let res = !(await Filter.eval(element.not[0], note));
          //console.log(element.not[0])
          return res;
        }

        //FILTER
        return await Filter.matchesCondition(element, note);
      }
    } catch (e) {
      //console.log(e);
    }
    return false;
  };

  static matchesCondition = async (
    fc: FilterCondition,
    note: NoteWrap
  ): Promise<Boolean> => {
    let noteValue = null;
    let tiid = await Referencer.makeIid(fc.tiid);
    if (note.block.has(tiid)) {
      noteValue = note.block.get(tiid);
    }
    let filterValue = fc.value;
    let type = Referencer.getType(tiid);

    //HACK: Fix me.
    if (fc.condition == Filter.IS_TYPE) {
      if (note.block.has("defaultName")) return true;
      return false;
    }

    let res = Filter.checkConditionbyType(
      fc.condition,
      noteValue,
      filterValue,
      type
    );
    //console.log(res);
    return res;
  };

  static checkConditionbyType(
    condition: string,
    noteValue: string,
    filterValue: string,
    type: IpmmType
  ): Boolean {
    //GENERICS
    if (condition == Filter.IS_EMPTY) {
      if (noteValue == null) {
        return true;
      }
      return false;
    }

    if (noteValue == null)
      //Let's not make wierd castings
      return false;

    //STRING
    if (type.constrains[0] == Referencer.basicTypeString) {
      //CONTAINS
      if (condition == Filter.CONTAINS) {
        if (noteValue == null) return false;
        if (noteValue.indexOf(filterValue) == -1) return false;
        else return true;
      }
      //IS EQUAL
      else if (condition == Filter.IS_EQUAL) {
        if (noteValue == filterValue) return true;
        return false;
      }

      return false;
    }

    //INTERPLANETARY TEXT
    else if (type.constrains[0] == Referencer.basicTypeInterplanetaryText) {
      //CONTAINS
      if (condition == Filter.CONTAINS) {
        if (noteValue == null) return false;
        for (let run of noteValue) {
          if (run.indexOf(filterValue) >= 0) {
            return true;
          }
        }
      }
      //IS EQUAL
      else if (condition == Filter.IS_EQUAL) {
        if (noteValue == filterValue) return true;
        return false;
      }
    }
    //NUMBER
    else if (type.constrains[0] == Referencer.basicTypeNumber) {
      //IS EQUAL
      if (condition == Filter.IS_EQUAL) {
        if (noteValue == filterValue) return true;
        return false;
      }
      //IS BIGGER
      else if (condition == Filter.IS_BIGGER) {
        if (noteValue > filterValue) return true;
        return false;
      }
      //IS SMALLER
      else if (condition == Filter.IS_SMALLER) {
        if (noteValue < filterValue) return true;
        return false;
      }
    }

    //BOOLEAN
    else if (type.constrains[0] == Referencer.basicTypeBoolean) {
      //IS EQUAL
      if (condition == Filter.IS_EQUAL) {
        if (noteValue == filterValue) return true;
        return false;
      }
    }
    //
    //console.log("Can't process type " + IpmmType);
    return false;
  }
}

export interface FilterCondition {
  tiid: string;
  condition: string;
  value: string;
}

/*
{
  "and": [
    {
      "or": [
        {
          "tiid": "prop-view-1612698885",
          "condition": "contains",
          "value": "Ipfoam"
        },
        {
          "tiid": "prop-view-1612698885",
          "condition": "contains",
          "value": "LSD"
        }
      ]
    },
    {
        "tiid": "prop-title-1612697362",
        "condition": "contains",
        "value": "Ipfoam"
      }
  ]
}




{
  "and": [
    {
      "tiid": "prop-view-1612698885",
      "condition": "isEmpty"
    },

    {
      "tiid": "prop-title-1612697362",
      "condition": "isEmpty"
    },
    {
      "not": [
        {
          "tiid": "prop-ipfoam-type-1630602741",
          "condition": "isEmpty"
        }
      ]
    }
  ]
}


*/
