import { NoteWrap } from "./ipmm";
import Referencer from "./referencer";
import IpmmType from "./ipmmType";
import Utils from "./utils";

export default class Filter {
  static OR: string = "or";
  static AND: string = "and";
  static NOT: string = "not";
  static CONTAINS: string = "contains";
  static IS_EMPTY: string = "isEmpty";

  static filter = async (
    notesInput: { [iid: string]: NoteWrap } = {},
    filter: any
  ): Promise<NoteWrap[]> => {
    let filtered: NoteWrap[] = [];
    for (let iid in notesInput) {
      if (await Filter.eval(filter, notesInput[iid])) {
        filtered.push(notesInput[iid]);
      }
    }
    return filtered;
  };

  static eval = async (element: any, note: NoteWrap): Promise<Boolean> => {
    try {
      
      if (Utils.isObject(element)) {
        //NO FILTER
        if(Utils.objectIsEmpty(element)){
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
          let res = ! (await Filter.eval(element.not[0], note));
          //console.log(element.not[0])
          return res
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
    let tiid = await Referencer.makeMiid(fc.tiid);
    if (tiid in note.block) {
      noteValue = note.block[tiid];
    }
    let filterValue = fc.value;
    let type = Referencer.getType(tiid);

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

    //STRING
    if (type.constrains[0] == Referencer.basicTypeString) {
      //CONTAINS
      if (condition == Filter.CONTAINS) {
        if (noteValue == null) return false;
        if (noteValue.indexOf(filterValue) == -1) return false;
        else return true;
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
    }
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
