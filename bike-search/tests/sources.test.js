const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {parseBrisbane,parseOlivers,parseTeamMoto,numeric,brand,condition}=require('../lib/sources');
const sources=require('../sources.json'),fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8');
test('Brisbane used includes Windsor cards only, with per-bike links and photos',()=>{
 const s=sources.find(s=>s.id==='brisbane-used-windsor'),parsed=parseBrisbane(fixture('brisbane-used.html'),s);
 assert.ok(parsed.cardCount>parsed.bikes.length);assert.ok(parsed.bikes.length>0);
 for(const b of parsed.bikes){assert.equal(b.showroom,'Windsor');assert.equal(b.condition,'Used');assert.match(b.url,/\/used-bikes\//);assert.match(b.imageUrl,/\/assets\//);assert.ok(b.priceAud>0);}
 assert.ok(parsed.pages.includes(2));
});
test('Brisbane new catalogue remains showroom-unconfirmed, with missing km as null',()=>{
 const parsed=parseBrisbane(fixture('brisbane-new.html'),sources.find(s=>s.id==='brisbane-new'));
 assert.equal(parsed.bikes.length,8);assert.ok(parsed.total>8);
 for(const b of parsed.bikes){assert.equal(b.showroom,null);assert.equal(b.odometerKm,null);assert.equal(b.condition,'New');assert.ok(b.priceAud>0);assert.ok(b.imageUrl);}
});
test('Changed Brisbane markup fails rather than clearing a good cache',()=>{
 assert.throws(()=>parseBrisbane('<p>Visit our Windsor showroom.</p>',sources[0]),/No Brisbane bike cards/);
});
test('Olivers source supplies canonical bike URLs, photos, brands and condition',()=>{
 const data=JSON.parse(fixture('olivers.json')),bikes=parseOlivers(data,sources.find(s=>s.id==='olivers'));
 const ktm=bikes.find(b=>b.stockNumber==='6979');assert.equal(ktm.brand,'KTM');assert.equal(ktm.priceAud,7999);assert.equal(ktm.odometerKm,21000);
 assert.equal(ktm.url,'https://www.oliversmotorcycles.com.au/used-bikes/for-sale/ktm/790-adventure/2019/2317224');assert.ok(ktm.imageUrl);assert.equal(ktm.condition,'Used');
 const missing=parseOlivers([{...data[0],price:undefined,odometer:undefined}],sources.find(s=>s.id==='olivers'))[0];assert.equal(missing.priceAud,null);assert.equal(missing.odometerKm,null);
});
test('TeamMoto array fields and zero kilometres are preserved',()=>{
 const source=sources.find(s=>s.id==='teammoto-virginia'),items=JSON.parse(fixture('teammoto.json'));
 const bikes=parseTeamMoto(items,source);assert.equal(bikes.length,items.length);assert.equal(bikes[0].showroom,'Virginia');assert.match(bikes[0].url,/^https:\/\/www.teammoto.com.au\/shop\//);
 const demo=parseTeamMoto([{...items[0],custom_fields:{...items[0].custom_fields,cf_condition:['Demo'],cf_odometer:['0']}}],source)[0];assert.equal(demo.condition,'Demo');assert.equal(demo.odometerKm,0);
});
test('Unknown values stay unknown; equivalent brand/condition labels normalise',()=>{
 assert.equal(numeric(''),null);assert.equal(numeric('N/A'),null);assert.equal(numeric('0'),0);assert.equal(numeric('12,345 km'),12345);assert.equal(brand('TRIUMPH'),brand('Triumph'));assert.equal(condition('Pre-Owned'),'Used');assert.equal(condition(''),'Unknown');
});
test('TeamMoto refuses an unfiltered response and a truncated page',async()=>{
 const {fetchSource}=require('../lib/sources'),originalFetch=global.fetch,source=sources.find(s=>s.id==='teammoto-virginia');
 try{
  global.fetch=async()=>new Response(JSON.stringify({items:[],meta:{total:1,filters:[]}}),{status:200});
  await assert.rejects(()=>fetchSource(source),/did not apply the showroom filter/);
  global.fetch=async()=>new Response(JSON.stringify({items:[],meta:{total:1,filters:[{name:'cf_dealership',values:[{value:source.dealership}]}]}}),{status:200});
  await assert.rejects(()=>fetchSource(source),/stopped before the final page/);
 }finally{global.fetch=originalFetch;}
});
