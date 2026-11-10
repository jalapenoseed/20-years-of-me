import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePosts} from '../src/analyzer.js';

const post=(date,text)=>({date,text,source:'fixture.json'});
const batch=(year,word,n=6)=>Array.from({length:n},(_,i)=>post(`${year}-01-${String(i+1).padStart(2,'0')}T12:00:00Z`,`${word}. Entry number ${i}.`));

test('retains empty calendar years without inferring an offline life',()=>{
 const r=analyzePosts([post('2006-01-01','New music album'),post('2026-01-01','Coding games')]);
 assert.equal(r.stats.span,21);
 assert.equal(Object.keys(r.years).length,21);
 assert.equal(r.years['2007'],0);
 assert.equal(r.phases.find(p=>p.year==='2007').topic,'No posts in archive');
 assert.equal(r.coverage.missingYears.length,19);
 assert.match(r.coverage.caveat,/missing exports/);
});

test('deduplicates full normalized text at the same instant only',()=>{
 const prefix='A very long garden story '.repeat(20);
 const r=analyzePosts([post('2020-01-01T10:00:00Z',prefix+'one'),post('2020-01-01T10:00:00Z',prefix+'two'),post('2020-01-01T11:00:00Z',prefix+'one'),post('2020-01-01T10:00:00Z',prefix+'one')]);
 assert.equal(r.stats.count,3);
 assert.equal(r.stats.duplicates,1);
 assert.equal(new Set(r.posts.map(p=>p.id)).size,3);
});

test('uses per-year topic shares instead of confusing volume with emphasis',()=>{
 const sameRate=analyzePosts([...batch(2020,'Coding games',6),...batch(2021,'Coding games',12)]);
 assert.equal(sameRate.shifts.length,0);
 const changed=analyzePosts([...batch(2020,'Cooking tomatoes',6),...batch(2021,'Coding games',6)]);
 const shift=changed.shifts.find(s=>s.topic==='Technology & games');
 assert.equal(shift.changePoints,100);
 assert.equal(shift.fromShare,0);
 assert.equal(shift.toShare,1);
 assert.ok(shift.evidence.length>0);
 assert.match(shift.detail,/not proof/);
});

test('suppresses strong shift claims for sparse years and across missing years',()=>{
 assert.equal(analyzePosts([...batch(2020,'Cooking tomatoes',2),...batch(2021,'Coding games',2)]).shifts.length,0);
 assert.equal(analyzePosts([...batch(2020,'Cooking tomatoes'),...batch(2022,'Coding games')]).shifts.length,0);
});

test('provides evidence over time, recurring themes and factual memorable examples',()=>{
 const r=analyzePosts([...batch(2006,'Coding games'),...batch(2010,'Coding games'),...batch(2026,'Coding games')]);
 const recurring=r.recurring.find(t=>t.topic==='Technology & games');
 assert.deepEqual(recurring.years,['2006','2010','2026']);
 assert.equal(recurring.evidence[0].date.slice(0,4),'2006');
 assert.equal(recurring.evidence.at(-1).date.slice(0,4),'2026');
 assert.ok(r.memorable.every(m=>r.posts.some(p=>p.id===m.id&&p.text.startsWith(m.text))));
});

test('labels literal opposing hobby statements as uncertain review candidates',()=>{
 const r=analyzePosts([post('2010-01-01','I love baseball.'),post('2020-01-01','I hate baseball.')]);
 assert.equal(r.possibleContradictions.length,1);
 const candidate=r.possibleContradictions[0];
 assert.equal(candidate.kind,'review-candidate');
 assert.equal(candidate.evidence.length,2);
 assert.match(candidate.detail,/does not establish a contradiction/);
 assert.equal(analyzePosts([post('2010-01-01','I love my family.'),post('2020-01-01','I hate my family.')]).possibleContradictions.length,0);
 assert.equal(analyzePosts([post('2010-01-01','I love baseball and fishing.'),post('2020-01-01','I hate baseball and fishing.')]).possibleContradictions.length,0);
});

test('treats untrusted token names as plain data and remains deterministic',()=>{
 const r=analyzePosts([post('2020-01-01','constructor constructor prototype prototype __proto__')]);
 assert.equal(r.topWords.find(([w])=>w==='constructor')[1],2);
 assert.equal(r.topWords.find(([w])=>w==='prototype')[1],2);
 assert.equal(analyzePosts([]),null);
});

test('matches explicit word forms without broad substring false positives',()=>{
 const r=analyzePosts([post('2020-01-01','He said apparently the air was warm near the apple orchard. A phonetic alphabet was handy.')]);
 assert.equal(r.topics.find(([topic])=>topic==='Technology & games')[1],0);
 assert.equal(r.topics.find(([topic])=>topic==='Politics & debate')[1],0);
 assert.equal(r.phases[0].topic,'Personal updates');
 const real=analyzePosts([post('2020-01-01','AI apps and applications help coders program robots on computers.'),post('2020-01-02','An election and government policy debate about warfare.'),post('2020-01-03','Gardening tomatoes and cooking recipes.')]);
 assert.equal(real.topics.find(([topic])=>topic==='Technology & games')[1],1);
 assert.equal(real.topics.find(([topic])=>topic==='Politics & debate')[1],1);
 assert.equal(real.topics.find(([topic])=>topic==='Food & cooking')[1],1);
});

test('sports games do not become technology unless separate technology words appear',()=>{
 const sport=analyzePosts([post('2011-10-12','I cannot believe the baseball game tonight!')]);
 assert.equal(sport.phases[0].topic,'Sports & outdoors');
 assert.equal(sport.topics.find(([topic])=>topic==='Technology & games')[1],0);
 const coded=analyzePosts([post('2020-01-01','I coded a baseball game on my computer.')]);
 assert.equal(coded.topics.find(([topic])=>topic==='Technology & games')[1],1);
 assert.equal(coded.topics.find(([topic])=>topic==='Sports & outdoors')[1],1);
 const generic=analyzePosts([post('2020-01-01','I am making games this weekend.')]);
 assert.equal(generic.topics.find(([topic])=>topic==='Technology & games')[1],1);
});
