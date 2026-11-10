export const STOP=new Set(('the a an and or but with from that this have has had was were are you your for not just like what when where who why how about there their they them then than out into over under again could would should does did all get got its it i me my we our us he she his her on in at to of is am be as by if so do no yes can will up down one two more some much very been being which while here also really because now today yesterday tomorrow something anything everything going even still these those through only dont didn isnt arent ive youre cant im lol lmao haha yeah okay ok damn shit fuck https www com facebook post photo shared link video').split(/\s+/));
const TOPICS={
 'Politics & debate':['politic','president','election','vote','government','congress','senate','democrat','republican','policy','liberal','conservative','politician','war'],
 'Family & friends':['family','mom','mother','dad','father','brother','sister','kid','child','friend','birthday','married','wedding','love'],
 'Food & cooking':['cook','recipe','dinner','lunch','breakfast','food','pizza','chicken','steak','taco','restaurant','jalapeno','pepper','garden','tomato'],
 'Technology & games':['computer','game','gaming','code','coding','software','app','robot','drone','internet','ai','github','program','phone'],
 'Work & money':['work','job','boss','business','money','pay','career','office','customer','school','college'],
 'Sports & outdoors':['baseball','football','basketball','soccer','fishing','hunting','hike','camp','bike','ride','river','mountain'],
 'Music & culture':['music','song','band','concert','movie','film','album','show','tv','book','artist']};
const MATCH=/\b(never|always|everyone|nobody|nothing|everything|literally|obviously|clearly)\b/gi;
// Facebook timestamps appear as Unix seconds, milliseconds, numeric strings, or ISO dates.
export function parseDate(value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value==='string'){
  value=value.trim();
  if(/^\d{9,13}$/.test(value))value=Number(value);
  else if(!/^\d{4}-\d{2}-\d{2}(?:$|[T ])/u.test(value))return null;
 }
 const date=typeof value==='number'?new Date(value<1e11?value*1000:value):new Date(value);
 if(!Number.isFinite(date.getTime()))return null;
 if(typeof value==='string'){
  const ymd=value.slice(0,10),[y,m,d]=ymd.split('-').map(Number);
  const check=new Date(Date.UTC(y,m-1,d));
  if(check.toISOString().slice(0,10)!==ymd)return null;
 }
 return date;
}
const PRIVATE_KEYS=new Set(['comments','comments_v2','your_comments','reactions','messages','messages_v2','message_threads','participants','contacts','friends','likes','messenger','inbox','outbox','chats','chat_history','media','attachments','tags','tagged_posts','posts_you_are_tagged_in','other_people_posts_to_your_timeline']);
export function isPrivatePath(path=''){
 return String(path).replace(/\\/g,'/').split('/').some(part=>PRIVATE_KEYS.has(part.replace(/\.json$/i,'').replace(/_\d+$/,'' ).toLowerCase())||/^(?:message|comment|chat)_?(?:history|threads|activity)$/i.test(part));
}
function textOf(value){
 if(typeof value==='string')return value;
 if(Array.isArray(value))return value.map(textOf).filter(Boolean).join(' ');
 if(!value||typeof value!=='object')return '';
 return typeof value.text==='string'?value.text:(typeof value.post==='string'?value.post:'');
}
export function extractPosts(json,source='import.json',options={}){
 if(isPrivatePath(source))return [];
 const posts=[],visited=new WeakSet(),stack=[{node:json,depth:0}];
 const maxNodes=options.maxNodes??180000,maxDepth=24,maxPosts=100000;
 let nodes=0,queued=1,truncated=false;
 while(stack.length&&nodes<maxNodes){
  const {node,depth}=stack.pop();nodes++;
  if(!node||typeof node!=='object'||visited.has(node))continue;
  visited.add(node);
  if(depth>maxDepth){truncated=true;continue;}
  if(!Array.isArray(node)){
   const rawDate=node.timestamp??node.created_time??node.creation_timestamp??node.date;
   const date=parseDate(rawDate);
   // Titles are Facebook activity metadata, not authored post content.
   const content=[textOf(node.message),textOf(node.text),textOf(node.post),textOf(node.status),textOf(node.data)].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
   if(date&&date.getUTCFullYear()>=2004&&date.getTime()<=Date.now()+86400000&&content.length>2){
    posts.push({date:date.toISOString(),text:content,source:String(source).slice(0,512)});
    if(posts.length>=maxPosts){truncated=true;break;}
   }
  }
  const children=Array.isArray(node)?node:Object.entries(node).filter(([key])=>!PRIVATE_KEYS.has(key.toLowerCase())&&!isPrivatePath(key)).map(([,value])=>value);
  for(let i=children.length-1;i>=0;i--){const child=children[i];if(child&&typeof child==='object'){
   if(queued>=maxNodes){truncated=true;break;}
   stack.push({node:child,depth:depth+1});queued++;
  }}
 }
 if(stack.length||truncated)options.warnings?.push('Some deeply nested or oversized records were skipped by the traversal safety limit.');
 return posts;
}
export function parsePasted(text){
 const lines=String(text).slice(0,24*1024*1024).trim().split(/\n(?=\d{4}-\d\d-\d\d\s*[:|—-])/);
 return lines.flatMap(line=>{const match=line.match(/^(\d{4}-\d\d-\d\d)\s*[:|—-]\s*([\s\S]+)/);if(!match)return [];
  const date=parseDate(match[1]),content=match[2].trim();
  return date&&date.getUTCFullYear()>=2004&&date.getTime()<=Date.now()+86400000&&content.length>2?[{date:date.toISOString(),text:content,source:'pasted'}]:[];
 });
}
const tokens=t=>(t.toLowerCase().match(/[a-z][a-z']{2,}/g)||[]).filter(w=>!STOP.has(w));
export function analyzePosts(input) {
 const dedup=new Map();let rejected=0;
 for(const p of Array.isArray(input)?input:[]) {
  const d=parseDate(p?.date);const text=String(p?.text||'').replace(/\s+/g,' ').trim();
  if(!d||d.getUTCFullYear()<2004||d.getUTCFullYear()>new Date().getUTCFullYear()||text.length<3){rejected++;continue;}
  const date=d.toISOString();const key=date+'|'+text;
  if(!dedup.has(key))dedup.set(key,{date,text,source:String(p.source||'unknown')});
 }
 const posts=[...dedup.values()].sort((a,b)=>a.date.localeCompare(b.date));if(!posts.length)return null;
 posts.forEach((p,i)=>{p.id='P'+String(i+1).padStart(6,'0');});
 // Explicit word forms avoid matching common substrings (AI/air, app/apparently,
 // war/warm). Keyword matches still cannot establish a post's intent.
 const topicPatterns={
  'Politics & debate':['politics?','political(?:ly)?','presidents?','presidential','elections?','electoral','vot(?:e|es|ed|ing|ers?)','governments?','governmental','congress(?:ional)?','senat(?:e|ors?)','democrats?','democratic','republicans?','polic(?:y|ies)','liberals?','liberalism','conservatives?','conservatism','politicians?','wars?','warfare'],
  'Family & friends':['famil(?:y|ies)','moms?','mothers?','dads?','fathers?','brothers?','sisters?','kids?','child(?:ren)?','friends?','friendships?','birthdays?','married','marriage','weddings?','lov(?:e|es|ed|ing)'],
  'Food & cooking':['cook(?:s|ed|ing)?','recipes?','dinners?','lunch(?:es)?','breakfasts?','foods?','pizzas?','chickens?','steaks?','tacos?','restaurants?','jalape(?:n|ñ)os?','peppers?','garden(?:s|ed|ing|ers?)?','tomato(?:es)?'],
  'Technology & games':['computers?','computing','gaming','cod(?:e|es|ed|er|ers|ing)','software','apps?','applications?','robots?','robotics','drones?','internet','ai','github','program(?:s|med|ming|mers?)?','phones?','smartphones?'],
  'Work & money':['work(?:s|ed|ing|ers?)?','jobs?','boss(?:es)?','business(?:es)?','money','pay(?:s|ing|ments?)?','paid','careers?','offices?','customers?','schools?','schooling','colleges?'],
  'Sports & outdoors':['baseball','football','basketball','soccer','fish(?:ing)?','hunt(?:s|ed|ing|ers?)?','hik(?:e|es|ed|ing|ers?)','camp(?:s|ed|ing|ers?)?','bik(?:e|es|ed|ing|ers?)','rid(?:e|es|ing|ers?)','rivers?','mountains?'],
  'Music & culture':['music','musical','musicians?','songs?','bands?','concerts?','movies?','films?','albums?','shows?','tv','books?','artists?']
 };
 const regexFor=patterns=>new RegExp('\\b(?:'+patterns.join('|')+')\\b','i');
 const sportGameContext=/\b(?:baseball|football|basketball|soccer|hockey|tennis|cricket|softball|volleyball|rugby)\b/i;
 const genericGame=/\b(?:game|games)\b/i;
 const topicMatchers=Object.keys(TOPICS).map(topic=>{
  const regex=regexFor(topicPatterns[topic]);
  return [topic,topic==='Technology & games'?{test:text=>regex.test(text)||(genericGame.test(text)&&!sportGameContext.test(text))}:regex];
 });
 const topicCounts=Object.fromEntries(Object.keys(TOPICS).map(k=>[k,0]));
 const wordCounts=Object.create(null),byYear={},years={};let exclaims=0,questions=0,allCaps=0,absolute=0;
 const first=Number(posts[0].date.slice(0,4)),last=Number(posts.at(-1).date.slice(0,4));
 for(let y=first;y<=last;y++){years[y]=0;byYear[y]={count:0,topics:{},posts:[]};}
 const matchesTopic=(post,topic)=>topicMatchers.find(([name])=>name===topic)?.[1].test(post.text);
 for(const p of posts) {
  const y=p.date.slice(0,4);years[y]++;byYear[y].count++;byYear[y].posts.push(p);
  for(const w of tokens(p.text))wordCounts[w]=(wordCounts[w]||0)+1;
  for(const [topic,matcher] of topicMatchers)if(matcher.test(p.text)){topicCounts[topic]++;byYear[y].topics[topic]=(byYear[y].topics[topic]||0)+1;}
  if(p.text.includes('!'))exclaims++;if(p.text.includes('?'))questions++;
  if(/\b[A-Z]{4,}\b/.test(p.text))allCaps++;
  if(/\b(never|always|everyone|nobody|nothing|everything|literally|obviously|clearly)\b/i.test(p.text))absolute++;
 }
 // Spread excerpts over the relevant period instead of always quoting its first posts.
 const evidence=(arr,n=3)=>{
  if(!arr.length)return [];
  const sorted=[...arr].sort((a,b)=>a.date.localeCompare(b.date));
  const indices=sorted.length<=n?sorted.map((_,i)=>i):Array.from({length:n},(_,i)=>Math.round(i*(sorted.length-1)/Math.max(1,n-1)));
  return [...new Set(indices)].map(i=>{const p=sorted[i];return {id:p.id,date:p.date,text:p.text.slice(0,300),source:p.source};});
 };
 const sortedYears=Object.entries(years),topics=Object.entries(topicCounts).sort((a,b)=>b[1]-a[1]);
 const topWords=Object.entries(wordCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,20);
 const topYear=[...sortedYears].sort((a,b)=>b[1]-a[1])[0],leading=topics.filter(x=>x[1]>0).slice(0,3);
 const observations=[];
 if(leading.length){const [topic,count]=leading[0];observations.push({name:'The recurring main character',detail:`${topic} appears in ${count} of ${posts.length} posts (${Math.round(count/posts.length*100)}%). This is a recurring writing topic in this archive; it does not establish a personality trait or diagnosis.`,roast:`You and ${topic.toLowerCase()} have a longer relationship than most television franchises.`,evidence:evidence(posts.filter(p=>matchesTopic(p,topic)))});}
 observations.push({name:'Your most online year',detail:`${topYear[0]} has the most posts in this archive (${topYear[1]}). Missing exports and changes in Facebook use can affect this ranking.`,roast:`In ${topYear[0]}, apparently the internet needed your supervision.`,evidence:evidence(byYear[topYear[0]].posts)});
 if(questions/posts.length>.2)observations.push({name:'A curious public voice',detail:`${questions} posts contain a question mark (${Math.round(questions/posts.length*100)}%). Questions may be rhetorical; punctuation cannot establish personality.`,roast:'At some point your timeline became an unpaid town-hall Q&A.',evidence:evidence(posts.filter(p=>p.text.includes('?')))});
 if(exclaims/posts.length>.25)observations.push({name:'The exclamation era',detail:`${exclaims} posts contain an exclamation point (${Math.round(exclaims/posts.length*100)}%). This describes an expressive punctuation pattern, not your emotional state.`,roast:'Your exclamation-mark key deserves paid vacation.',evidence:evidence(posts.filter(p=>p.text.includes('!')))});
 if(absolute/posts.length>.1)observations.push({name:'Speaking in absolutes',detail:`${absolute} posts use terms like “always,” “never,” or “literally.” They can mark humor or emphasis; this is not evidence of psychological rigidity.`,roast:'Nuance occasionally had to wait outside while you made a point.',evidence:evidence(posts.filter(p=>/\b(never|always|everyone|nobody|nothing|everything|literally|obviously|clearly)\b/i.test(p.text)))});
 const timeline=sortedYears.map(([year,count])=>{
  const ranked=Object.entries(byYear[year].topics).sort((a,b)=>b[1]-a[1]);
  const topic=ranked[0]?.[0]||(count?'Personal updates':'No posts in archive');
  return {year,count,topic,share:count?(ranked[0]?.[1]||0)/count:0,coverage:count?'observed':'no-posts',sample:evidence(byYear[year].posts,3),topicShares:topicMatchers.map(([topic])=>({topic,count:byYear[year].topics[topic]||0,share:count?(byYear[year].topics[topic]||0)/count:0})),caution:count<5?'Sparse sample: avoid strong year-to-year conclusions.':null};
 });
 const phases=timeline;
 const eras=[];
 for(const year of timeline){const prev=eras.at(-1);if(prev&&prev.topic===year.topic&&Number(prev.end)+1===Number(year.year)){prev.end=year.year;prev.count+=year.count;}else eras.push({start:year.year,end:year.year,label:year.count?year.topic+' era':'Archive gap',topic:year.topic,count:year.count,evidence:[]});}
 for(const era of eras)era.evidence=evidence(posts.filter(p=>p.date.slice(0,4)>=era.start&&p.date.slice(0,4)<=era.end),3);
 // Compare represented adjacent calendar years only, and require enough text in each.
 const shifts=[];
 for(let i=1;i<timeline.length;i++){
  const from=timeline[i-1],to=timeline[i];if(from.count<5||to.count<5)continue;
  for(const next of to.topicShares){const prior=from.topicShares.find(x=>x.topic===next.topic);const delta=next.share-prior.share;
   if(Math.abs(delta)<.25||Math.max(next.count,prior.count)<3)continue;
   const changePoints=Math.round(delta*100);
   shifts.push({topic:next.topic,from:from.year,to:to.year,fromShare:prior.share,toShare:next.share,changePoints,detail:`${next.topic} keyword matches ${delta>0?'rose':'fell'} from ${Math.round(prior.share*100)}% (${prior.count}/${from.count}) in ${from.year} to ${Math.round(next.share*100)}% (${next.count}/${to.count}) in ${to.year}. This is a change in posting emphasis, not proof of a change in beliefs or interests.`,evidence:[...evidence(byYear[from.year].posts.filter(p=>matchesTopic(p,next.topic)),2),...evidence(byYear[to.year].posts.filter(p=>matchesTopic(p,next.topic)),2)]});
  }
 }
 shifts.sort((a,b)=>Math.abs(b.changePoints)-Math.abs(a.changePoints));
 if(shifts.length){const s=shifts[0];observations.push({name:'A shift in the conversation',detail:s.detail,roast:`Your timeline changed the channel to ${s.topic.toLowerCase()}. The algorithm probably needed a moment.`,evidence:s.evidence});}
 const recurring=topics.filter(([topic,count])=>count>1).map(([topic,count])=>{const represented=timeline.filter(y=>y.topicShares.some(t=>t.topic===topic&&t.count>0)).map(y=>y.year);return {topic,count,years:represented,yearCount:represented.length,evidence:evidence(posts.filter(p=>matchesTopic(p,topic)))};}).filter(t=>t.yearCount>1);
 // Literal opposite self-statements about the exact same non-sensitive hobby noun phrase.
 // These are review candidates, never established hypocrisy or reliable belief inference.
 const stances=new Map(),possibleContradictions=[];
 for(const p of posts){for(const match of p.text.matchAll(/(?:^|[.!?]\s+)I\s+(?:really\s+)?(love|like|enjoy|hate|dislike)\s+([^.!?\n,;]{2,60})(?=[.!?\n,;]|$)/gi)){
  const subject=match[2].trim().toLowerCase().replace(/^(?:the|a|an)\s+/,'');
  if(subject.split(/\s+/).length>5||/\b(?:but|because|and|when|if|not|never)\b/.test(subject))continue;
  if(!/\b(?:baseball|football|basketball|soccer|fishing|hiking|camping|cooking|gardening|tomatoes|peppers|coding|games|gaming|music|movies|books|bikes|cycling|drones)\b/.test(subject))continue;
  const polarity=/^(?:hate|dislike)$/i.test(match[1])?-1:1;
  const prior=stances.get(subject);
  if(prior&&prior.polarity!==polarity&&prior.post.date.slice(0,10)!==p.date.slice(0,10)&&possibleContradictions.length<8){
   const topic=topicMatchers.find(([,regex])=>regex.test(subject))?.[0]||'Personal updates';
   possibleContradictions.push({name:'Possible change in wording',subject,topic,kind:'review-candidate',detail:`Opposite preference words about “${subject}” appear on different dates. Humor, quotations, circumstances, or changed preferences may explain them; this does not establish a contradiction.`,evidence:evidence([prior.post,p],2)});
  }
  stances.set(subject,{polarity,post:p});
 }}
 const memorable=[];const used=new Set();
 const remember=(p,reason)=>{if(p&&!used.has(p.id)){used.add(p.id);memorable.push({reason,id:p.id,date:p.date,text:p.text.slice(0,500),source:p.source});}};
 remember(posts[0],'Earliest text post in this archive');remember(posts.at(-1),'Latest text post in this archive');
 remember(posts.reduce((a,b)=>a.text.length>=b.text.length?a:b),'Longest text post in this archive');
 for(const s of shifts.slice(0,2))remember(posts.find(p=>p.id===s.evidence.at(-1)?.id),'Example from a change in posting emphasis');
 const missingYears=timeline.filter(y=>!y.count).map(y=>y.year),observedYears=timeline.filter(y=>y.count).length;
 const caveat='This archive is a sample of available text posts. Zero-post years may reflect missing exports, deleted posts, or different Facebook use. Keyword categories can overlap and miss context, sarcasm, language, and shared content.';
 const summary=`Across ${posts.length} imported posts spanning ${first}–${last} (${observedYears} represented calendar years), your most frequent detected themes were ${leading.map(t=>t[0].toLowerCase()).join(', ')||'a wide mix of subjects'}. Your busiest represented year was ${topYear[0]}.${missingYears.length?' '+missingYears.length+' calendar year'+(missingYears.length===1?' has':'s have')+' no posts in this archive.':''} These observations describe the available writing, not your private life or psychological health.`;
 return {posts,years,phases,timeline,eras,shifts:shifts.slice(0,12),recurring,possibleContradictions,memorable,topics,topWords,observations,summary,coverage:{observedYears,missingYears,caveat},methodology:{topics:'English keyword matches; counts overlap',shifts:'Adjacent years with at least 5 posts each; at least 25 percentage points and 3 topic matches',contradictions:'Literal opposite preference phrases about the exact same hobby; manual review required',memorable:'Selected by date, text length, and topic change; no engagement data is available'},stats:{count:posts.length,span:last-first+1,first:String(first),last:String(last),peak:topYear[0],questions,exclaims,allCaps,observedYears,missingYears:missingYears.length,duplicates:Math.max(0,(Array.isArray(input)?input.length:0)-rejected-posts.length),rejected},created:new Date().toISOString()};
}
