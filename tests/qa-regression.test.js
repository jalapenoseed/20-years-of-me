import test from 'node:test';
import assert from 'node:assert/strict';
import '../vendor/jszip.min.js';
import {importFiles} from '../src/importer.js';
import {analyzePosts} from '../src/analyzer.js';
import {createAIPrompt,buildAIPacket,validateAIResponse} from '../src/ai.js';

const record=(text,timestamp=1609459200)=>({timestamp,data:[{post:text}]});
const jsonFile=(name,value)=>{const text=JSON.stringify(value);return {name,size:Buffer.byteLength(text),text:async()=>text};};
const zipFile=async value=>{const zip=new globalThis.JSZip();zip.file('posts/your_posts_1.json',JSON.stringify(value));const buffer=await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});return {name:'synthetic.zip',size:buffer.byteLength,arrayBuffer:async()=>buffer};};

test('real inflater rejects a forged expanded-size directory without accepting content',async()=>{
 const file=await zipFile([record('Garden '+ 'x'.repeat(300000))]);
 const buffer=await file.arrayBuffer(),view=new DataView(buffer);
 let central=-1;
 for(let i=0;i<buffer.byteLength-46;i++)if(view.getUint32(i,true)===0x02014b50&&view.getUint32(i+24,true)>0){central=i;break;}
 assert.ok(central>=0);view.setUint32(central+24,64,true);
 await assert.rejects(importFiles([file]),error=>{
  assert.ok(error.warnings.some(w=>/declared size|size mismatch/i.test(w)),error.warnings.join(' '));
  return true;
 });
});

test('multiple archives deduplicate originals while malformed companion remains visible',async()=>{
 const good=await zipFile([record('Fresh tomato garden update')]);
 const imported=await importFiles([good,good,{name:'broken.json',size:7,text:async()=>'{broken'}]);
 assert.equal(imported.posts.length,1);
 assert.equal(imported.filesRead,2);
 assert.equal(imported.filesSkipped,1);
 assert.ok(imported.warnings.some(w=>/duplicate/.test(w)));
 assert.ok(imported.warnings.some(w=>/Malformed JSON/.test(w)));
});

test('private examples and adversarial text never enter optional AI packet',()=>{
 const secret='HIDDEN_EMAIL alice@example.com <img src=x onerror=alert(1)> SECRET_FILENAME';
 const r=analyzePosts([{date:'2021-01-01',text:secret+' garden tomatoes',source:'SECRET_FILENAME.json'}]);
 const prompt=createAIPrompt(r);
 for(const value of ['HIDDEN_EMAIL','alice@example.com','<img','SECRET_FILENAME','onerror'])assert.ok(!prompt.includes(value));
 const valid={packetId:buildAIPacket(r).packetId,summary:'A limited sample.',observations:[{title:'A cooking reference',analysis:'One post matches a cooking keyword.',roast:'The shortest cooking show.',evidenceIds:['archive:count']}]};
 assert.equal(validateAIResponse(JSON.stringify(valid),r).observations.length,1);
 valid.observations[0].evidenceIds.push('P000001');
 assert.throws(()=>validateAIResponse(JSON.stringify(valid),r),/valid evidence/);
});
