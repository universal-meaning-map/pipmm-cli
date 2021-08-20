const Ipld = require("ipld");
const IpfsRepo = require("ipfs-repo");
const IpfsBlockService = require("ipfs-block-service");
//import  Ipld = require("ipld");

export default class IpldController {
   static ipld: any;

  static init = async (ipfsRepoPath: string): Promise<void> => {
    console.log(IpfsRepo)
    //const repo =  new IpfsRepo(ipfsRepoPath);
    //await repo.init({});
    //await repo.open();
    //const blockService = new IpfsBlockService(repo);
    //sIpldController.ipld = Ipld({ blockService: blockService });
  };
/*
  static put = async (node:any):Promise<string> =>{
    const cid = (await IpldController.ipld.put(node, { format: 'dag-cbor', hashAlg: 'sha2-256' })).toString()
    return cid 
 }
  static get = async (cid:string):Promise<any>=> {
      return {}

  }
  */s

}
