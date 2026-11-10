import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePosts} from '../src/analyzer.js';
import {buildAIPacket,createAIPrompt,validateAIResponse} from '../src/ai.js';
const report=()=>analyzePosts([{date:'2020-03-02',text:'Secret Name email@example.com garden tomatoes',source:'sensitive-file.json'}]);
const response=r=>({packetId:buildAIPacket(r).packetId,summary:'A small sample.',observations:[{title:'A recurring topic',analysis:'One post matches a cooking keyword; that says little about personality.',roast:'A one-post cooking show.',evidenceIds:['archive:count']}]});
test('AI packet excludes raw posts, words, filenames and private report fields',()=>{const s=createAIPrompt(report());for(const secret of ['Secret Name','email@example.com','sensitive-file','2020-03-02'])assert.ok(!s.includes(secret));assert.ok(s.includes('Food & cooking'));});
test('AI response citations checked against current packet',()=>{const r=report(),v=response(r);assert.equal(validateAIResponse(JSON.stringify(v),r).observations.length,1);v.observations[0].evidenceIds=['invented'];assert.throws(()=>validateAIResponse(JSON.stringify(v),r),/evidence/);});
test('AI clinical labels, stale packet and oversized response rejected',()=>{const r=report(),v=response(r);v.summary='You are bipolar';assert.throws(()=>validateAIResponse(JSON.stringify(v),r),/clinical/);v.summary='A small sample.';v.packetId='old';assert.throws(()=>validateAIResponse(JSON.stringify(v),r),/different timeline/);assert.throws(()=>validateAIResponse('x'.repeat(40001),r),/40,000/);});
