import {extractPosts,isPrivatePath} from './analyzer.js';

const MB=1024*1024;
export const IMPORT_LIMITS=Object.freeze({inputBytes:100*MB,jsonBytes:24*MB,expandedBytes:90*MB,candidateFiles:150,zipEntries:10000,selectedFiles:150,compressionRatio:250});
const bytesOf=text=>new TextEncoder().encode(text).length;
const abort=signal=>{if(signal?.aborted)throw new DOMException('Import canceled.','AbortError');};
export function isPostJsonPath(path){
 const clean=String(path).replace(/\\/g,'/');
 if(isPrivatePath(clean)||!clean.toLowerCase().endsWith('.json'))return false;
 return /(?:^|\/)(?:posts|your_posts|profile_posts|timeline|statuses|status_updates|posts_and_comments)(?:\/|\.|_)/i.test(clean);
}

// Inspect central-directory sizes before JSZip allocates/inflates data. ZIP64,
// encrypted and split archives are deliberately unsupported in this browser app.
export function inspectZip(buffer){
 const view=new DataView(buffer),length=view.byteLength;
 let eocd=-1;
 for(let i=length-22;i>=Math.max(0,length-65557);i--){if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===length){eocd=i;break;}}
 if(eocd<0)throw Error('This ZIP is incomplete or unsupported. Download the archive again.');
 const entries=view.getUint16(eocd+10,true),size=view.getUint32(eocd+12,true),offset=view.getUint32(eocd+16,true);
 if(view.getUint16(eocd+4,true)||view.getUint16(eocd+6,true)||view.getUint16(eocd+8,true)!==entries)throw Error('Split ZIP archives are unsupported. Import each downloaded archive separately.');
 if(entries===65535||size===0xffffffff||offset===0xffffffff)throw Error('ZIP64 archives are unsupported. Export only your posts.');
 if(entries>IMPORT_LIMITS.zipEntries)throw Error('This archive contains too many entries. Export only your posts.');
 if(offset+size>eocd)throw Error('Invalid ZIP directory. Download the archive again.');
 const candidates=[];let at=offset,total=0;
 for(let i=0;i<entries;i++){
  if(at+46>offset+size||view.getUint32(at,true)!==0x02014b50)throw Error('Invalid ZIP directory entry.');
  const compressed=view.getUint32(at+20,true),expanded=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),extraLength=view.getUint16(at+30,true),commentLength=view.getUint16(at+32,true);
  const end=at+46+nameLength+extraLength+commentLength;
  if(end>offset+size)throw Error('Invalid ZIP entry lengths.');
  const name=new TextDecoder().decode(new Uint8Array(buffer,at+46,nameLength));
  if(isPostJsonPath(name)){
   if(view.getUint16(at+8,true)&1)throw Error('Encrypted post archives are unsupported. Use an unencrypted Facebook export.');
   if(![0,8].includes(view.getUint16(at+10,true)))throw Error('Unsupported ZIP compression method.');
   if(expanded===0xffffffff||expanded>IMPORT_LIMITS.jsonBytes)throw Error('A post file exceeds the 24 MB expanded limit. Export smaller date ranges.');
   total+=expanded;
   if(total>IMPORT_LIMITS.expandedBytes)throw Error('Post JSON exceeds the 90 MB expanded limit. Export smaller date ranges.');
   if(expanded>MB&&expanded/Math.max(1,compressed)>IMPORT_LIMITS.compressionRatio)throw Error('Archive compression ratio exceeds the safety limit. Export smaller date ranges.');
   candidates.push({name,expanded,compressed});
   if(candidates.length>IMPORT_LIMITS.candidateFiles)throw Error('More than 150 candidate post files. Export smaller date ranges.');
  }
  at=end;
 }
 return {candidates,expandedBytes:total,entries};
}

async function defaultZipLoader(buffer){
 if(!globalThis.JSZip)await import('../vendor/jszip.min.js');
 if(!globalThis.JSZip)throw Error('ZIP reader could not load. Refresh and try again.');
 return globalThis.JSZip.loadAsync(buffer,{checkCRC32:false,createFolders:false});
}

async function readZipTextBounded(item,declaredSize,signal){
 if(typeof item.internalStream!=='function')return item.async('string');
 return new Promise((resolve,reject)=>{
  const stream=item.internalStream('uint8array'),decoder=new TextDecoder(),parts=[];let bytes=0,done=false;
  const fail=error=>{if(done)return;done=true;stream.pause();parts.length=0;reject(error);};
  stream.on('data',chunk=>{
   if(done)return;
   if(signal?.aborted){fail(new DOMException('Import canceled.','AbortError'));return;}
   bytes+=chunk.byteLength;
   if(bytes>declaredSize||bytes>IMPORT_LIMITS.jsonBytes){fail(Error('Expanded ZIP entry does not match its declared size.'));return;}
   parts.push(decoder.decode(chunk,{stream:true}));
  });
  stream.on('error',fail);
  stream.on('end',()=>{if(done)return;done=true;if(bytes!==declaredSize){reject(Error('Expanded ZIP entry does not match its declared size.'));return;}parts.push(decoder.decode());resolve(parts.join(''));});
  stream.resume();
 });
}

export async function importFiles(files,{onProgress=()=>{},signal,zipLoader=defaultZipLoader}={}){
 const list=Array.from(files||[]);
 if(!list.length)throw Error('Choose at least one Facebook ZIP or JSON file.');
 if(list.length>IMPORT_LIMITS.selectedFiles)throw Error('Select at most 150 files at once.');
 if(list.reduce((sum,file)=>sum+file.size,0)>IMPORT_LIMITS.inputBytes)throw Error('Selected files exceed the combined 100 MB limit. Export smaller date ranges.');
 const result={posts:[],warnings:[],filesRead:0,filesSkipped:0,bytesRead:0};let expanded=0,candidates=0;
 const warn=message=>{if(result.warnings.length<50&&!result.warnings.includes(message))result.warnings.push(message);};
 const consume=(text,name)=>{
  abort(signal);const bytes=bytesOf(text);expanded+=bytes;
  if(bytes>IMPORT_LIMITS.jsonBytes||expanded>IMPORT_LIMITS.expandedBytes)throw Error('Expanded JSON exceeds the import safety limit. Export smaller date ranges.');
  const diagnostics=[];const json=JSON.parse(text.replace(/^\uFEFF/,''));
  const posts=extractPosts(json,name,{warnings:diagnostics});
  diagnostics.forEach(warn);for(const post of posts)result.posts.push(post);result.filesRead++;result.bytesRead+=bytes;
  if(!posts.length)warn(`${name.slice(0,140)}: no dated authored text posts were found.`);
 };
 for(const [index,file] of list.entries()){
  abort(signal);onProgress({message:`Reading file ${index+1} of ${list.length}…`,current:index+1,total:list.length});
  try{
   if(/\.json$/i.test(file.name)){
    if(file.size>IMPORT_LIMITS.jsonBytes)throw Error('JSON exceeds the 24 MB limit.');
    if(isPrivatePath(file.name)){result.filesSkipped++;warn(`${file.name.slice(0,140)}: private message, comment, or tagged-content file skipped.`);continue;}
    if(++candidates>IMPORT_LIMITS.candidateFiles)throw Error('Combined candidate file count exceeds 150.');
    consume(await file.text(),file.name);
   }else if(/\.zip$/i.test(file.name)){
    const buffer=await file.arrayBuffer();abort(signal);const inspected=inspectZip(buffer);
    if(!inspected.candidates.length)throw Error('No recognizable post JSON files. Choose a JSON-format Posts export.');
    candidates+=inspected.candidates.length;
    if(candidates>IMPORT_LIMITS.candidateFiles||expanded+inspected.expandedBytes>IMPORT_LIMITS.expandedBytes)throw Error('Combined archive contents exceed the safety limits. Import smaller date ranges.');
    const zip=await zipLoader(buffer);abort(signal);
    for(const [entryIndex,entry] of inspected.candidates.entries()){
     abort(signal);onProgress({message:`Reading post file ${entryIndex+1} of ${inspected.candidates.length}…`,current:entryIndex+1,total:inspected.candidates.length});
     try{
      const item=zip.file(entry.name);
      if(!item||item.dir)throw Error('ZIP entry is missing or invalid.');
      const text=await readZipTextBounded(item,entry.expanded,signal);abort(signal);
      if(bytesOf(text)>entry.expanded+4)throw Error('Expanded ZIP entry does not match its declared size.');
      consume(text,entry.name);
     }catch(error){if(error.name==='AbortError')throw error;result.filesSkipped++;warn(`${entry.name.slice(0,140)}: ${error instanceof SyntaxError?'Malformed JSON; file skipped.':error.message}`);}
    }
   }else throw Error('Unsupported file type. Choose ZIP or JSON.');
  }catch(error){if(error.name==='AbortError')throw error;result.filesSkipped++;warn(`${file.name.slice(0,140)}: ${error instanceof SyntaxError?'Malformed JSON; file skipped.':error.message}`);}
 }
 abort(signal);
 // Exact dates and complete normalized text prevent collisions between long posts.
 const unique=new Map();for(const post of result.posts)unique.set(post.date+'|'+post.text,post);
 const duplicateCount=result.posts.length-unique.size;result.posts=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(duplicateCount)warn(`${duplicateCount} duplicate post record${duplicateCount===1?' was':'s were'} removed.`);
 if(!result.posts.length){const error=Error('No dated text posts found. Export your Facebook Posts in JSON format, or try the example timeline.');error.warnings=result.warnings;throw error;}
 return result;
}
