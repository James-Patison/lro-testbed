'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {fetchSource,teamPage,bike}=require('./lib/sources');
const ROOT=__dirname,CACHE=path.join(ROOT,'cache');
let sources=require('./sources.json'),job=null;
const files={'/js/sources.js':['js/sources.js','text/javascript'],'/js/cache.js':['js/cache.js','text/javascript'],'/':['index.html','text/html'],'/js/app.js':['js/app.js','text/javascript'],'/css/styles.css':['css/styles.css','text/css'],'/js/jquery.min.js':['js/jquery.min.js','text/javascript']};
const cacheFile=id=>path.join(CACHE,id+'.json');
const preferencesFile=path.join(ROOT,'user-selections.json');
let preferencesWrites=Promise.resolve();
function validPreferences(p){
  const strings=a=>Array.isArray(a)&&a.length<=200&&a.every(v=>typeof v==='string'&&v.length<=200);
  const f=p?.filters;
  return p?.schemaVersion===1&&strings(p.fetchSourceIds)&&f&&typeof f.query==='string'&&f.query.length<=1000&&strings(f.brands)&&strings(f.conditions)&&f.conditions.every(c=>['New','Used','Demo','Unknown'].includes(c))&&strings(f.sourceIds)&&
    ['minPriceAud','maxPriceAud','minKm','maxKm'].every(k=>f[k]===null||(typeof f[k]==='number'&&Number.isFinite(f[k])&&f[k]>=0))&&['name','price','price-desc','km'].includes(f.sort);
}
async function readPreferences(){try{const p=JSON.parse(await fs.readFile(preferencesFile,'utf8'));if(!validPreferences(p))throw Error('Invalid user-selections.json');return p;}catch(e){if(e.code==='ENOENT')return null;throw e;}}

async function saveJson(file,data){
  const temp=file+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(data,null,2));await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
}
async function readCaches(){
  const snapshots=[],errors=[];
  for(const source of sources){
    try{
      const s=JSON.parse(await fs.readFile(cacheFile(source.id),'utf8'));
      if(s.schemaVersion!==2 || s.sourceId!==source.id || !Array.isArray(s.bikes) || !Number.isFinite(Date.parse(s.fetchedAt)))throw Error('Invalid cache format');
      snapshots.push(s);
    }catch(e){if(e.code!=='ENOENT')errors.push({sourceId:source.id,error:e.message});}
  }
  return {snapshots,errors};
}
async function runJob(current){
  for(const id of current.sourceIds){
    const source=sources.find(s=>s.id===id);
    current.activeSourceId=id;current.message='Starting '+source.label;
    try{
      const snapshot=await fetchSource(source,message=>{current.message=source.label+': '+message;});
      await saveJson(cacheFile(id),snapshot);
      current.results.push({sourceId:id,ok:true,count:snapshot.bikes.length});
    }catch(e){current.results.push({sourceId:id,ok:false,error:e.message});}
  }
  current.activeSourceId=null;current.status='complete';current.message='Fetch complete';current.finishedAt=new Date().toISOString();
}
async function readBody(req){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>16000)throw Error('Request body too large');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function start(){
  await fs.mkdir(CACHE,{recursive:true});
  // One-time local migration; no source network request is made at startup.
  const legacySource=sources.find(s=>s.id==='brisbane-used-windsor');
  try{
    await fs.access(cacheFile(legacySource.id));
  }catch(e){
    if(e.code!=='ENOENT')throw e;
    try{
      const old=JSON.parse(await fs.readFile(path.join(ROOT,'bikes-cache.json'),'utf8'));
      if(old.showroom!=='Windsor'||!Array.isArray(old.bikes))throw Error('Invalid legacy cache');
      const bikes=old.bikes.map(b=>bike(legacySource,{...b,condition:'Used'}));
      await saveJson(cacheFile(legacySource.id),{schemaVersion:2,sourceId:legacySource.id,source:legacySource.url,dealer:legacySource.dealer,showroom:'Windsor',fetchedAt:old.fetchedAt,pagesScanned:old.pagesScanned,count:bikes.length,bikes});
    }catch(error){if(error.code!=='ENOENT')console.warn('Legacy cache migration skipped:',error.message);}
  }
  return http.createServer(async(req,res)=>{
    const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(body):body);};
    try{
      const u=new URL(req.url,'http://localhost');
      if(req.method==='GET'){
        if(u.pathname==='/api/state')return send(200,{sources,...await readCaches(),job});
        if(u.pathname==='/api/job')return send(200,job);
        if(u.pathname==='/api/preferences')return send(200,await readPreferences());
        if(u.pathname.startsWith('/api/cache/')){
          const id=u.pathname.slice('/api/cache/'.length);
          if(!sources.some(s=>s.id===id))return send(404,{error:'Unknown source'});
          try{return send(200,JSON.parse(await fs.readFile(cacheFile(id),'utf8')));}catch(e){if(e.code==='ENOENT')return send(200,null);throw e;}
        }
        const file=files[u.pathname];if(!file)return send(404,{error:'Not found'});
        return send(200,await fs.readFile(path.join(ROOT,file[0])),file[1]);
      }
      if(req.method!=='POST')return send(405,{error:'Method not allowed'});
      if(!['http://127.0.0.1:8080','http://localhost:8080'].includes(req.headers.origin)||req.headers['content-type']?.split(';')[0]!=='application/json')return send(403,{error:'Same-origin JSON required'});
      if(u.pathname==='/api/preferences'){
        const preferences=await readBody(req);
        if(!validPreferences(preferences))return send(400,{error:'Invalid selections'});
        // Serialize atomic writes, including saves made while a source fetch is running.
        const write=preferencesWrites.catch(()=>{}).then(()=>saveJson(preferencesFile,preferences));
        preferencesWrites=write;await write;return send(200,{saved:true});
      }
      if(job?.status==='running')return send(409,{error:'A fetch is already running'});
      if(u.pathname==='/api/fetch'){
        const body=await readBody(req);
        if(!Array.isArray(body.sourceIds)||!body.sourceIds.length||body.sourceIds.some(id=>!sources.some(s=>s.id===id)))return send(400,{error:'Select one or more known sources'});
        job={id:randomUUID(),status:'running',startedAt:new Date().toISOString(),sourceIds:[...new Set(body.sourceIds)],activeSourceId:null,message:'Starting fetch',results:[]};
        void runJob(job);
        return send(202,job);
      }
      if(u.pathname==='/api/showrooms'){
        const data=await teamPage(null,0,1);
        const dealers=data.facets?.find(f=>f.name==='cf_dealership')?.values;
        if(!dealers?.length)throw Error('No TeamMoto showrooms returned');
        const updated=[...sources];
        for(const d of dealers){
          if(typeof d.value!=='string'||!d.value.startsWith('TeamMoto '))continue;
          const id=d.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
          if(!updated.some(s=>s.id===id))updated.push({id,provider:'teammoto',dealer:'TeamMoto',label:d.value,showroom:d.value.replace(/^TeamMoto /,''),dealership:d.value,url:'https://www.teammoto.com.au/motorcycles/'});
        }
        await saveJson(path.join(ROOT,'sources.json'),updated);sources=updated;
        return send(200,{sources});
      }
      send(404,{error:'Not found'});
    }catch(e){send(502,{error:e.message});}
  }).listen(8080,'127.0.0.1',()=>console.log('Bike Search: http://127.0.0.1:8080'));
}
if(require.main===module)start().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={saveJson,readCaches,start};

