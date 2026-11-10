// Executable browser regression suite. Fixtures are synthetic and exist in memory.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium,devices} from '@playwright/test';
import '../vendor/jszip.min.js';
import {analyzePosts} from '../src/analyzer.js';
import {buildAIPacket} from '../src/ai.js';

const port=4183,origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['scripts/serve.js','--dist'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',chunk=>{serverLog+=chunk;});server.stderr.on('data',chunk=>{serverLog+=chunk;});
let browser;
try {
 let ready=false;
 for(let attempt=0;attempt<50;attempt++){
  try{const response=await fetch(origin);if(response.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(ready,`Preview did not start: ${serverLog}`);
 browser=await chromium.launch();
 const raw='PRIVATE_QA_MARKER <img src=x onerror=alert(1)> garden tomatoes';
 const records=[{timestamp:1609459200,data:[{post:raw}]},{timestamp:1640995200,data:[{post:'A coding game project!'}]}];
 const zip=new globalThis.JSZip();zip.file('your_facebook_activity/posts/your_posts_1.json',JSON.stringify(records));
 zip.file('messages/inbox/qa/message_1.json',JSON.stringify([{timestamp:1609459200,message:'MESSENGER_SECRET'}]));
 const payload=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 for(const [name,options] of [['desktop',{viewport:{width:1440,height:1000}}],['iphone',{...devices['iPhone 13']}]]){
  const context=await browser.newContext({...options,acceptDownloads:true});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&url.origin!==origin)external.push(request.url());});
  await page.goto(origin);
  await page.locator('#sample').click();
  await page.locator('#reset').waitFor();
  assert.match(await page.locator('.demo-banner').first().innerText(),/invented sample posts/);
  await page.locator('#year-filter').selectOption('2020');
  assert.equal(await page.locator('.timeline-post').count(),3);
  await page.locator('#post-search').fill('sauce');
  assert.equal(await page.locator('.timeline-post').count(),1);
  await page.locator('#reset').click();
  await page.locator('.paste summary').click();
  await page.locator('#pasted').fill('2021-01-01: PASTED_PRIVATE_MARKER <img src=x onerror=alert(1)> garden');
  await page.locator('#analyze-paste').click();
  await page.locator('#reset').waitFor();
  assert.match(await page.locator('#post-results').innerText(),/PASTED_PRIVATE_MARKER/);
  assert.equal(await page.locator('.timeline-post img').count(),0);
  await page.locator('#reset').click();
  await page.locator('#file').setInputFiles({name:'facebook-qa.zip',mimeType:'application/zip',buffer:payload});
  await page.locator('#reset').waitFor();
  assert.equal(await page.locator('.timeline-post').count(),2);
  assert.match(await page.locator('#post-results').innerText(),/PRIVATE_QA_MARKER/);
  assert.equal(await page.locator('.timeline-post img').count(),0);
  assert.ok(!(await page.locator('body').innerText()).includes('MESSENGER_SECRET'));
  const share=await page.locator('#share-caption').innerText();
  assert.ok(!share.includes('PRIVATE_QA_MARKER')&&!share.includes('garden tomatoes'));
  assert.ok(!share.includes('Top detected topics'));
  const downloadEvent=page.waitForEvent('download');
  await page.locator('#card').click();
  const download=await downloadEvent;
  assert.equal(download.suggestedFilename(),'20-years-of-me-share-card.png');
  const image=await readFile(await download.path());
  assert.equal(image.subarray(1,4).toString(),'PNG');
  await page.locator('#download').click();
  await page.locator('#export-dialog').waitFor({state:'visible'});
  await page.locator('#close-export').click();
  const r=analyzePosts(records.map(post=>({date:new Date(post.timestamp*1000).toISOString(),text:post.data[0].post})));
  const valid={packetId:buildAIPacket(r).packetId,summary:'A small sample.',observations:[{title:'Two represented years',analysis:'Two posts span two calendar years, a sparse sample.',roast:'The timeline took its time.',evidenceIds:['archive:count']}]};
  await page.locator('#ai-details summary').click();
  await page.locator('#ai-response').fill(JSON.stringify(valid));
  await page.locator('#ai-import').click();
  await page.locator('.ai-result').waitFor();
  assert.match(await page.locator('.ai-result').innerText(),/claims are unverified/);
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dimensions.scroll<=dimensions.width+2,`${name} horizontal overflow ${JSON.stringify(dimensions)}`);
  await page.locator('#reset').click();
  assert.equal(await page.locator('#share-preview').count(),0);
  assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_QA_MARKER'));
  await page.reload();
  assert.equal(await page.locator('#reset').count(),0);
  assert.deepEqual(external,[],`${name} unexpected outgoing data request`);
  assert.deepEqual(errors,[],`${name} uncaught browser errors`);
  console.log(`Browser smoke passed: ${name}; worker ZIP, secret exclusion, XSS, filters, PNG, private export, AI, clear/reload, layout.`);
  await context.close();
 }
} finally {
 await browser?.close();server.kill('SIGTERM');
}
