import {importFiles} from './importer.js';
import {analyzePosts} from './analyzer.js';
self.onmessage=async event=>{
 try{
  const result=await importFiles(event.data.files,{onProgress:progress=>self.postMessage({type:'progress',progress})});
  self.postMessage({type:'progress',progress:{message:'Building your private timeline…'}});
  result.report=analyzePosts(result.posts);
  result.posts=result.report?.posts||result.posts;
  self.postMessage({type:'result',result});
 }catch(error){self.postMessage({type:'error',error:{name:error.name,message:error.message,warnings:error.warnings||[]}});}
};
