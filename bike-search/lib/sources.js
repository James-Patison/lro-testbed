'use strict';
const cheerio = require('cheerio');
const {randomUUID} = require('node:crypto');
const clean = v => String(v ?? '').replace(/\s+/g,' ').trim();
const first = v => Array.isArray(v) ? v[0] : v;
function numeric(value) {
  value=first(value);
  if (value === null || value === undefined || clean(value) === '') return null;
  const match=String(value).replace(/,/g,'').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
function brand(value) {
  const name=clean(first(value));
  const aliases={bmw:'BMW','bmw motorrad':'BMW',ktm:'KTM',cfmoto:'CFMOTO',oset:'OSET',sym:'SYM','mv agusta':'MV Agusta','harley-davidson':'Harley-Davidson'};
  return name ? aliases[name.toLowerCase()] || name.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()) : null;
}
function condition(value) {
  const text=clean(first(value)).toLowerCase();
  if(text.includes('demo'))return 'Demo';
  if(text==='new')return 'New';
  if(/used|pre.?owned/.test(text))return 'Used';
  return 'Unknown';
}
function safeUrl(value,base) {
  if(!value)return null;
  try{const u=new URL(value,base);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}
}
function bike(source,fields) {
  const url=safeUrl(fields.url,source.url);
  if(!clean(fields.name)||!url||new URL(url).origin!==new URL(source.url).origin)throw Error('A listing is missing a valid name or bike URL');
  return {id:source.id+':'+(fields.stockNumber || url),sourceId:source.id,dealer:source.dealer,showroom:source.showroom,
    name:clean(fields.name),brand:brand(fields.brand),condition:condition(fields.condition),stockNumber:clean(fields.stockNumber)||null,
    priceAud:numeric(fields.priceAud),priceNote:clean(fields.priceNote)||null,odometerKm:numeric(fields.odometerKm),engineCapacityCc:numeric(fields.engineCapacityCc),
    url,imageUrl:safeUrl(fields.imageUrl,source.url),listingNote:clean(fields.listingNote)||null};
}
function parseBrisbane(html,source) {
  const $=cheerio.load(html);const cards=$('article.bikes');
  if(!cards.length)throw Error('No Brisbane bike cards found; source layout may have changed');
  const bikes=[];
  cards.each((_,el)=>{
    const c=$(el),paragraphs=c.find('p').toArray().map(p=>clean($(p).text()));
    const location=paragraphs.find(p=>/^Visit our .+ showroom\.$/i.test(p));
    if(source.condition==='Used'){
      if(!location)throw Error('Used bike is missing its showroom label');
      if(!/^Visit our Windsor showroom\.$/i.test(location))return;
    }
    const title=c.find('h3[itemprop="name"] a').first();
    const field=label=>paragraphs.find(p=>p.startsWith(label))?.slice(label.length);
    const price=c.find('[aria-label="Product Price"], .price-dollar-amount h1').first();
    bikes.push(bike(source,{name:title.text(),brand:c.find('meta[itemprop="brand"]').attr('content'),condition:source.condition,
      stockNumber:c.find('meta[itemprop="mpn"]').attr('content'),priceAud:price.text(),
      priceNote:source.condition==='New' ? clean(c.find('.js-bike-price-prefix').first().text()+' '+c.find('.price-subtitle').first().text()) : clean(price.next('p').text()),
      odometerKm:field('Odometer:'),engineCapacityCc:field('Engine Capacity:'),url:title.attr('href'),imageUrl:c.find('img.product-image-small').first().attr('src'),
      listingNote:source.condition==='New'?'Catalogue model · Showroom unconfirmed':null}));
  });
  const pages=$('.pagination a[href]').toArray().map(a=>{
    const u=new URL($(a).attr('href'),source.url);
    return u.origin===new URL(source.url).origin && u.pathname===new URL(source.url).pathname ? Number(u.searchParams.get('pgnum')):0;
  }).filter(p=>Number.isInteger(p)&&p>0);
  const total=clean($('body').text()).match(/([\d,]+) bikes found/i);
  return {bikes,pages,cardCount:cards.length,total:total?numeric(total[1]):null};
}
// Mirrors the public stockURL helper used on Oliver's inventory page.
function oliversUrl(item,base) {
  const tail=('/'+item.veh_type+'-Bikes/for-sale/'+item.make+'/'+item.model+'/'+item.year+'/'+item.variations+'/'+item.series+'/'+item.id)
    .replace(/undefined\//gi,'').replace(/\s+/g,' ').replace(/\s/g,'-').replace(/-{2,}/g,'-').replace(/[^0-9A-Z/\-._]+/gi,'').trim().toLowerCase();
  return new URL(tail,base).href;
}
function parseOlivers(items,source) {
  if(!Array.isArray(items))throw Error('Unexpected Olivers inventory response');
  return items.filter(i=>i.active!==0 && i.stock_type==='BIKE').map(i=>{
    if(!i.id||!i.make||!i.model||!i.veh_type)throw Error('Incomplete Olivers listing');
    return bike(source,{name:[i.year,i.make,i.model,i.variations,i.series].filter(Boolean).join(' '),brand:i.make,condition:i.veh_type,stockNumber:i.stock_number,
      priceAud:i.price,priceNote:i.price_qualifier,odometerKm:i.odometer,engineCapacityCc:i.size_option==='CC'?i.size:null,
      url:oliversUrl(i,source.url),imageUrl:i.images?.[0]});
  });
}
function parseTeamMoto(items,source) {
  if(!Array.isArray(items))throw Error('Unexpected TeamMoto inventory response');
  return items.map(i=>{
    const f=i.custom_fields||{};
    return bike(source,{name:i.title,brand:f.cf_make||i.brand,condition:f.cf_condition,stockNumber:first(i.sku)||i.id,
      priceAud:first(i.price),priceNote:null,odometerKm:f.cf_odometer,engineCapacityCc:f.cf_engine_cc,url:i.product_url,imageUrl:i.image_url});
  });
}
async function get(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(40000)});
  if(!response.ok)throw Error('Source returned HTTP '+response.status);
  return response;
}
const TEAM_KEY='c88d9119-4bed-488e-88d2-f643aa56a1e3'; // Public storefront search key, not a private credential.
async function teamPage(source,offset=0,limit=100,user={uid:randomUUID(),sid:randomUUID(),persist:false}) {
  const filters=source ? [{name:'cf_dealership',type:'text',values:[{value:source.dealership}]}] : [];
  const r=await get('https://api.findify.io/v4/'+TEAM_KEY+'/smart-collection/motorcycles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:TEAM_KEY,user,t_client:Date.now(),context:{},slot:'motorcycles',limit,offset,filters})});
  const data=await r.json();
  if(!Array.isArray(data.items)||!Number.isInteger(data.meta?.total)||data.meta.total<0)throw Error('Invalid TeamMoto pagination metadata');
  if(source && !data.meta.filters?.some(f=>f.name==='cf_dealership'&&f.values?.some(v=>v.value===source.dealership)))throw Error('TeamMoto did not apply the showroom filter');
  return data;
}
async function fetchSource(source,progress=()=>{}) {
  let bikes=[],pagesScanned=0;
  if(source.provider==='brisbane') {
    const pending=[1],seen=new Set(),signatures=new Set();let cardCount=0,expected=null;
    while(pending.length){
      const page=pending.shift();if(seen.has(page))continue;
      if(seen.size>=150)throw Error('Brisbane pagination exceeded 150 pages');
      progress('Reading page '+page);
      const data=parseBrisbane(await (await get(source.url+'?pgnum='+page)).text(),source);
      // Detect a source that starts repeating a page rather than returning the next page.
      const signature=require('node:crypto').createHash('sha256').update(JSON.stringify(data)).digest('hex');
      if(signatures.has(signature))throw Error('Brisbane returned a repeated page; keeping previous cache');
      signatures.add(signature);seen.add(page);cardCount+=data.cardCount;expected??=data.total;bikes.push(...data.bikes);
      data.pages.forEach(p=>{if(!seen.has(p)&&!pending.includes(p))pending.push(p);});
      if(pending.length)await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(expected!==null && cardCount<expected)throw Error('Incomplete Brisbane inventory: received '+cardCount+' of '+expected+' cards');
    pagesScanned=seen.size;
  } else if(source.provider==='olivers') {
    progress('Reading inventory configuration');
    const html=await (await get(source.url)).text();
    const key=html.match(/"path_param"\s*:\s*"([a-zA-Z0-9/]+)"/)?.[1];
    if(!key)throw Error('Olivers inventory configuration was not found');
    progress('Reading inventory');
    bikes=parseOlivers(await (await get('https://data.stock.i-motor.net.au/v3/'+key+'/stock')).json(),source);pagesScanned=1;
  } else if(source.provider==='teammoto') {
    const user={uid:randomUUID(),sid:randomUUID(),persist:false};const ids=new Set();let offset=0,total=null;
    do {
      progress('Reading bikes '+(offset+1)+(total===null?'':' of '+total));
      const data=await teamPage(source,offset,100,user);total=data.meta.total;
      if(total>10000)throw Error('Unexpected TeamMoto result size');
      if(!data.items.length&&offset<total)throw Error('TeamMoto stopped before the final page');
      for(const item of data.items){if(ids.has(item.id))throw Error('TeamMoto returned duplicate pagination items; retry the fetch');ids.add(item.id);}
      bikes.push(...parseTeamMoto(data.items,source));pagesScanned++;offset+=data.items.length;
    }while(offset<total);
    if(ids.size!==total)throw Error('Incomplete TeamMoto showroom inventory');
  }else throw Error('Unsupported source provider');
  bikes=[...new Map(bikes.map(b=>[b.url,b])).values()];
  return {schemaVersion:2,sourceId:source.id,source:source.url,dealer:source.dealer,showroom:source.showroom,fetchedAt:new Date().toISOString(),pagesScanned,count:bikes.length,bikes};
}
module.exports={numeric,brand,condition,bike,parseBrisbane,parseOlivers,parseTeamMoto,oliversUrl,fetchSource,teamPage};
