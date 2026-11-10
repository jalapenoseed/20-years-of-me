import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPosts,parseDate,parsePasted} from '../src/analyzer.js';
import {importFiles,inspectZip,isPostJsonPath,IMPORT_LIMITS} from '../src/importer.js';
import '../vendor/jszip.min.js';
const post=(text='My tomato garden!',timestamp=1609459200)=>({timestamp,data:[{post:text}]});
const file=(name,text)=>({name,size:new TextEncoder().encode(text).length,text:async()=>text});
const zipFile=async(entries)=>{const zip=new globalThis.JSZip();for(const [name,value] of Object.entries(entries))zip.file(name,value);const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});return {name:'facebook.zip',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};

test('varied date and Meta export structures import authored text, never activity titles',()=>{
 const values=[1609459200,1609459200000,'1609459200','2021-01-01T00:00:00Z'];
 for(const timestamp of values){const posts=extractPosts({your_posts:[post('Useful authored text',timestamp),{timestamp,title:'Person updated their profile photo'}]});assert.equal(posts.length,1);assert.equal(posts[0].date,'2021-01-01T00:00:00.000Z');}
 assert.equal(extractPosts([{created_time:'2021-01-01',post:'Top level Graph-style text'}]).length,1);
 assert.equal(extractPosts([{creation_timestamp:1609459200,status:'A status update'}]).length,1);
});

test('private containers, comments and tagged-content paths are excluded',()=>{
 const data={posts:[post()],messages:[{timestamp:1609459200,message:'Secret chat'}],comments_v2:[post('Private comment')],tagged_posts:[post('Someone else said this')],posts_you_are_tagged_in:[post('Tagged secret')]};
 assert.equal(extractPosts(data).length,1);
 for(const path of ['messages/inbox/thread/message_1.json','comments_1.json','posts/comments/your_comments.json','posts_you_are_tagged_in.json'])assert.equal(extractPosts([post()],path).length,0);
 assert.equal(isPostJsonPath('your_facebook_activity/posts/your_posts_1.json'),true);
 assert.equal(isPostJsonPath('posts_and_comments/comments_1.json'),false);
 assert.equal(isPostJsonPath('messages/posts_1.json'),false);
});

test('invalid and impossible calendar dates and undated records are rejected',()=>{
 for(const date of ['2021-02-29','2024-02-30','2021-13-01','January 1 2021','garbage',null,''])assert.equal(parseDate(date),null);
 assert.equal(parsePasted('2021-02-30: Invalid date\n2020-02-29: Leap-day garden post').length,1);
 assert.equal(extractPosts([{data:[{post:'No timestamp'}]},{timestamp:1609459200,title:'Only metadata'}]).length,0);
});

test('traversal caps are deterministic and produce a warning',()=>{
 const warnings=[];extractPosts({posts:Array.from({length:100},()=>post())},'posts.json',{maxNodes:10,warnings});
 assert.match(warnings.join(' '),/safety limit/);
});

test('JSON batch keeps good files and reports malformed files',async()=>{
 const result=await importFiles([file('posts.json',JSON.stringify({status_updates:[post()]})),file('broken.json','{oops'),file('comments.json',JSON.stringify([post('Do not read')]))]);
 assert.equal(result.posts.length,1);assert.equal(result.filesRead,1);assert.equal(result.filesSkipped,2);assert.match(result.warnings.join(' '),/Malformed JSON/);
});

test('ZIP imports split Facebook files, ignores unrelated secrets, and skips malformed JSON',async()=>{
 const selected=await zipFile({'your_facebook_activity/posts/your_posts_1.json':JSON.stringify([post()]),'posts/your_posts_2.json':JSON.stringify({status_updates:[post('Another useful post',1640995200)]}),'messages/inbox/a/message_1.json':JSON.stringify([post('Secret text')]),'posts/comments_1.json':JSON.stringify([post('Comment secret')]),'posts/bad.json':'not json'});
 const result=await importFiles([selected]);assert.equal(result.posts.length,2);assert.equal(result.filesRead,2);assert.equal(result.filesSkipped,1);assert.match(result.warnings.join(' '),/Malformed JSON/);
});

test('deduplication compares exact timestamp and complete text',async()=>{
 const prefix='x'.repeat(13000);const result=await importFiles([file('posts.json',JSON.stringify([post(prefix+'A'),post(prefix+'B'),post(prefix+'A'),post(prefix+'A',1609459300)]))]);
 assert.equal(result.posts.length,3);assert.match(result.warnings.join(' '),/1 duplicate/);
});

test('combined input limits reject before reading and cancellation rejects',async()=>{
 await assert.rejects(importFiles([{name:'huge.zip',size:IMPORT_LIMITS.inputBytes+1}]),/combined 100 MB/);
 const controller=new AbortController();controller.abort();await assert.rejects(importFiles([file('posts.json','[]')],{signal:controller.signal}),{name:'AbortError'});
});

test('preflight rejects damaged, encrypted, ZIP64 and oversized directories',async()=>{
 assert.throws(()=>inspectZip(new ArrayBuffer(4)),/incomplete/);
 const selected=await zipFile({'posts/your_posts_1.json':JSON.stringify([post()])});
 const buffer=await selected.arrayBuffer();const view=new DataView(buffer);let central=-1;
 for(let i=0;i<view.byteLength-4;i++)if(view.getUint32(i,true)===0x02014b50&&view.getUint32(i+24,true)>0){central=i;break;}
 assert.ok(central>=0);
 const encrypted=buffer.slice(0);new DataView(encrypted).setUint16(central+8,1,true);assert.throws(()=>inspectZip(encrypted),/Encrypted/);
 const expanded=buffer.slice(0);new DataView(expanded).setUint32(central+24,IMPORT_LIMITS.jsonBytes+1,true);assert.throws(()=>inspectZip(expanded),/24 MB/);
 const zip64=buffer.slice(0);new DataView(zip64).setUint16(buffer.byteLength-22+10,65535,true);assert.throws(()=>inspectZip(zip64),/Split|ZIP64/);
});

test('decompression results exceeding declared size never become posts',async()=>{
 const selected=await zipFile({'posts/your_posts_1.json':JSON.stringify([post()])});
 await assert.rejects(importFiles([selected],{zipLoader:async()=>({file:()=>({async:async()=>JSON.stringify([post('a'.repeat(1000))])})})}),error=>{assert.match(error.warnings.join(' '),/declared size/);return true;});
});

test('bounded stream pauses on oversized output before processing authored text',async()=>{
 const selected=await zipFile({'posts/your_posts_1.json':JSON.stringify([post()])});let paused=false;
 const stream={handlers:{},on(name,fn){this.handlers[name]=fn;return this;},pause(){paused=true;},resume(){this.handlers.data(new Uint8Array(1024));if(!paused)this.handlers.end();}};
 await assert.rejects(importFiles([selected],{zipLoader:async()=>({file:()=>({internalStream:()=>stream})})}),error=>{assert.equal(paused,true);assert.match(error.warnings.join(' '),/declared size/);return true;});
});
