'use strict';
const preferencesKey='bike-search-preferences';
let inventoryNotice='';
const browserStorage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
function readPreferences(){try{return JSON.parse(localStorage.getItem(preferencesKey)||'null');}catch{return null;}}
let sources=[],snapshots=[],bikes=[],busy=false,visibleLimit=48;
const money=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0});
const conditionLabel=c=>c==='Used'?'Used / pre-owned':c==='Unknown'?'Unspecified':c;
const errorText=e=>e.responseJSON?.error || e.message || e.statusText || 'Network error';
let preferences=null,preferencesReady=false,saveTimer,savingPreferences=false,pendingPreferences=null,selectionDirty=false;
function savedSelections(){
  if(preferences)return preferences.fetchSourceIds;
  try{const saved=JSON.parse(localStorage.getItem('bike-search-sources'));return Array.isArray(saved)?saved:null;}catch{return null;}
}
function capturePreferences(){return {schemaVersion:1,fetchSourceIds:selectedSources(),filters:{query:$('#search').val(),brands:$('#brand').val()||[],conditions:$('#condition').val()||[],sourceIds:$('#display-source').val()||[],minPriceAud:amount('#min-price'),maxPriceAud:amount('#max-price'),minKm:amount('#min-km'),maxKm:amount('#max-km'),sort:$('#sort').val()}};}
function rememberSelections(){
  if(!preferencesReady)return;
  clearTimeout(saveTimer);
  if($('#min-price,#max-price,#min-km,#max-km').toArray().some(el=>!el.validity.valid)){$('#selection-status').text('Correct the invalid number to save your selections.');return;}
  selectionDirty=true;$('#selection-status').text('Saving selections…');
  saveTimer=setTimeout(()=>savePreferences(capturePreferences()),200);
}
async function savePreferences(value){
  pendingPreferences=value;if(savingPreferences)return;savingPreferences=true;
  try{while(pendingPreferences){const next=pendingPreferences;pendingPreferences=null;localStorage.setItem(preferencesKey,JSON.stringify(next));preferences=next;}
    selectionDirty=JSON.stringify(capturePreferences())!==JSON.stringify(preferences);
    $('#selection-status').text('Selections saved.');
  }catch(e){$('#selection-status').text('Selections could not be saved: '+errorText(e));}
  finally{savingPreferences=false;}
}
function updateMulti(id){
  const $select=$('#'+id),selected=$select.val()||[],options=$select.find('option').toArray();
  const titles={brand:'All brands',condition:'All conditions','display-source':'All saved sources'};
  const $old=$select.siblings('.multi-select'),open=$old.prop('open');$old.remove();
  const $details=$('<details>').addClass('multi-select').attr('data-filter',id).prop('open',!!open);
  const labels=options.filter(o=>selected.includes(o.value)).map(o=>o.textContent);
  $('<summary>').attr('aria-label',id==='display-source'?'Display sources':id==='brand'?'Brand':'Condition').text(labels.length?(labels.length<=2?labels.join(', '):labels.length+' selected'):titles[id]).appendTo($details);
  const $menu=$('<div>').addClass('multi-options').appendTo($details);
  $('<button>').attr('type','button').text('Clear selection (show all)').on('click',()=>{$select.val([]).trigger('change');}).appendTo($menu);
  options.forEach(o=>{
    const $check=$('<input>').attr({type:'checkbox',value:o.value}).prop('checked',selected.includes(o.value));
    $check.on('change',()=>{const values=new Set($select.val()||[]);if($check.prop('checked'))values.add(o.value);else values.delete(o.value);$select.val([...values]).trigger('change');$select.siblings('.multi-select').find('input').filter((_,el)=>el.value===o.value).trigger('focus');});
    $('<label>').append($check,document.createTextNode(o.textContent)).appendTo($menu);
  });
  $details.on('toggle',()=>{if($details.prop('open'))$('.multi-select').not($details).prop('open',false);});
  $select.after($details);
}
function applyPreferences(){
  if(!preferences)return;
  const f=preferences.filters;
  $('#search').val(f.query);$('#sort').val(f.sort);
  for(const [id,value]of [['min-price',f.minPriceAud],['max-price',f.maxPriceAud],['min-km',f.minKm],['max-km',f.maxKm]])$('#'+id).val(value??'');
  for(const [id,values]of [['brand',f.brands],['condition',f.conditions],['display-source',f.sourceIds]]){
    for(const value of values)if(!$('#'+id+' option').toArray().some(o=>o.value===value))$('#'+id).append($('<option>').val(value).text(value+' (not in current cache)'));
    $('#'+id).val(values);updateMulti(id);
  }
}
function selectedSources(){return $('.source-check:checked').toArray().map(e=>e.value);}
function setBusy(value){busy=value;$('#refresh,#update-showrooms,.source-check,.source-tools button').prop('disabled',value);$('.source-check[data-blocked]').prop('disabled',true);}
function renderSources(){
  const teamOpen=$('.team-sources').prop('open');
  const previous=$('.source-check').length?selectedSources():savedSelections();
  const selected=new Set(previous ?? ['olivers','teammoto-virginia']);
  const $root=$('#sources').empty();
  const row=source=>{
    const snapshot=snapshots.find(s=>s.sourceId===source.id);
    const $row=$('<div>').addClass('source-row');
    const $check=$('<input>').attr({type:'checkbox',value:source.id}).addClass('source-check').prop('checked',selected.has(source.id));
    if(source.provider==='brisbane')$check.attr('data-blocked','true').prop('checked',false).prop('disabled',true);
    $('<label>').append($check,document.createTextNode(source.label)).appendTo($row);
    $('<span>').addClass('source-meta').text(snapshot?snapshot.bikes.length+' bikes · '+new Date(snapshot.fetchedAt).toLocaleString('en-AU'):'Not fetched yet').appendTo($row);
    if(source.provider==='brisbane')$('<span>').addClass('source-meta').text('Saved listings only — dealer blocks browser refresh').appendTo($row);
    return $row;
  };
  sources.filter(s=>s.provider!=='teammoto').forEach(s=>$root.append(row(s)));
  const team=sources.filter(s=>s.provider==='teammoto').sort((a,b)=>a.label.localeCompare(b.label));
  const $details=$('<details>').addClass('team-sources').prop('open',!!teamOpen);
  $('<summary>').text('TeamMoto showrooms ('+team.length+')').appendTo($details);
  const $tools=$('<div>').addClass('source-tools').appendTo($details);
  $('<button>').text('Select all TeamMoto').on('click',()=>{$('.team-grid .source-check').prop('checked',true);rememberSelections();}).appendTo($tools);
  $('<button>').text('Clear TeamMoto').on('click',()=>{$('.team-grid .source-check').prop('checked',false);rememberSelections();}).appendTo($tools);
  $('<button>').attr('id','update-showrooms').text('Update showroom list').on('click',updateShowrooms).appendTo($tools);
  const $grid=$('<div>').addClass('team-grid').appendTo($details);team.forEach(s=>$grid.append(row(s)));$root.append($details);
  $('.source-check').on('change',rememberSelections);
  setBusy(busy);
}
function populateFilters(){
  const currentBrand=$('#brand').val(),currentSource=$('#display-source').val();
  $('#brand').empty();
  [...new Set(bikes.map(b=>b.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).forEach(name=>$('#brand').append($('<option>').val(name).text(name)));
  for(const name of currentBrand||[])if(!$('#brand option').toArray().some(o=>o.value===name))$('#brand').append($('<option>').val(name).text(name+' (not in current cache)'));
  $('#brand').val(currentBrand || []);
  $('#display-source').empty();
  sources.filter(s=>snapshots.some(c=>c.sourceId===s.id)).forEach(s=>$('#display-source').append($('<option>').val(s.id).text(s.label)));
  for(const id of currentSource||[])if(!$('#display-source option').toArray().some(o=>o.value===id))$('#display-source').append($('<option>').val(id).text(id+' (not in current cache)'));
  $('#display-source').val(currentSource || []);
  ['brand','condition','display-source'].forEach(updateMulti);
}
function amount(id){const value=$(id).val();return value===''?null:Number(value);}
function within(value,min,max){return (min===null&&max===null)||(value!==null&&Number.isFinite(value)&&(min===null||value>=min)&&(max===null||value<=max));}
function render(){
  const query=$('#search').val().trim().toLowerCase(),brands=$('#brand').val()||[],conditions=$('#condition').val()||[],sourceIds=$('#display-source').val()||[];
  const minPrice=amount('#min-price'),maxPrice=amount('#max-price'),minKm=amount('#min-km'),maxKm=amount('#max-km');
  const rangeInvalid=(min,max)=>[min,max].some(n=>n!==null&&(!Number.isFinite(n)||n<0))||(min!==null&&max!==null&&min>max);
  const invalid=rangeInvalid(minPrice,maxPrice)||rangeInvalid(minKm,maxKm)||$('#min-price,#max-price,#min-km,#max-km').toArray().some(el=>!el.validity.valid);
  $('#filter-error').text(invalid?'Enter valid ranges: values must be non-negative and minimum must not exceed maximum.':'');
  const matches=invalid?[]:bikes.filter(b=>(!brands.length||brands.includes(b.brand))&&(!conditions.length||conditions.includes(b.condition))&&(!sourceIds.length||sourceIds.includes(b.sourceId))&&
    [b.name,b.brand,b.stockNumber].join(' ').toLowerCase().includes(query)&&within(b.priceAud,minPrice,maxPrice)&&within(b.odometerKm,minKm,maxKm));
  const sort=$('#sort').val();
  matches.sort((a,b)=>{
    const key=sort==='km'?'odometerKm':'priceAud';
    if(sort==='name')return a.name.localeCompare(b.name);
    // Missing values stay last in either direction.
    if(a[key]===null&&b[key]!==null)return 1;if(b[key]===null&&a[key]!==null)return -1;
    return (sort==='price-desc'?-1:1)*((a[key]??0)-(b[key]??0))||a.name.localeCompare(b.name);
  });
  window.bikeSearchResult={schemaVersion:2,sources:snapshots.map(s=>({sourceId:s.sourceId,source:s.source,fetchedAt:s.fetchedAt,count:s.bikes.length})),filters:{query,brands,conditions,sourceIds,minPriceAud:minPrice,maxPriceAud:maxPrice,minKm,maxKm,sort},count:matches.length,bikes:matches};
  const shown=matches.slice(0,visibleLimit);
  $('#count').text(matches.length+' of '+bikes.length+' bikes'+(shown.length<matches.length?' · showing '+shown.length:''));
  const $items=$('#items').empty();
  shown.forEach(b=>{
    const $card=$('<article>').addClass('bike').attr('data-source',b.sourceId),$photo=$('<div>').addClass('photo').appendTo($card);
    if(b.imageUrl){$('<img>').attr({src:b.imageUrl,alt:b.name,loading:'lazy',decoding:'async',referrerpolicy:'no-referrer'}).on('error',()=>{$photo.empty().text('Photo unavailable');}).appendTo($photo);}else{$photo.text('No photo available');}
    const $body=$('<div>').addClass('bike-body').appendTo($card);
    $('<p>').addClass('eyebrow').text(b.brand||'Motorcycle').append($('<span>').addClass('badge').text(conditionLabel(b.condition))).appendTo($body);
    $('<h2>').append($('<a>').attr({href:b.url,target:'_blank',rel:'noopener noreferrer'}).text(b.name)).appendTo($body);
    $('<p>').addClass('price').text(b.priceAud===null?'Price on enquiry':money.format(b.priceAud)).appendTo($body);
    $('<p>').addClass('price-note').text(b.priceNote||'See listing for price details').appendTo($body);
    $('<p>').addClass('specs').text((b.odometerKm===null?'Kilometres unspecified':b.odometerKm.toLocaleString('en-AU')+' km')+' · '+(b.engineCapacityCc===null?'Capacity unspecified':b.engineCapacityCc+' cc')).appendTo($body);
    $('<p>').addClass('location').text(b.dealer+' · '+(b.showroom||'Showroom unconfirmed')).appendTo($body);
    if(b.stockNumber)$('<p>').addClass('stock').text('Stock '+b.stockNumber).appendTo($body);
    if(b.listingNote)$('<p>').addClass('listing-note').text(b.listingNote).appendTo($body);
    $('<a>').addClass('view-link').attr({href:b.url,target:'_blank',rel:'noopener noreferrer'}).text('View bike ↗').appendTo($body);
    $items.append($card);
  });
  if(!matches.length)$items.append($('<p>').addClass('empty').text(bikes.length?'No bikes match these filters.':'No saved bikes yet. Select a source above and click Fetch selected sources.'));
  $('#more').prop('hidden',shown.length>=matches.length);
  $('#download').prop('disabled',invalid||!snapshots.length);
  $('#json').text(JSON.stringify(window.bikeSearchResult,null,2));
}
function displayErrors(errors){$('#fetch-errors').empty();errors.forEach(e=>{$('<p>').text((sources.find(s=>s.id===e.sourceId)?.label||e.sourceId)+': '+e.error+'. Previous cache retained when available.').appendTo('#fetch-errors');});}
function updateListings(initial=false){
  bikes=snapshots.flatMap(s=>s.bikes);renderSources();populateFilters();if(initial)applyPreferences();render();
}
function persistInventory(){
  try{localStorage.setItem('bike-search-inventory-v1',JSON.stringify({sources,snapshots,errors:[],job:null}));return true;}
  catch{$('#selection-status').text('Browser storage is full or unavailable. Fresh listings are available for this visit only.');return false;}
}
async function loadState(initial=false){
  const result=await bikeSearchCache.load(browserStorage,()=>$.getJSON('data/state.json'));
  sources=result.state.sources;snapshots=result.state.snapshots;
  inventoryNotice=result.saved?(result.cached?'Loaded inventory from browser local storage.':'Inventory saved in browser local storage.'):'Browser storage is unavailable. Inventory is available for this visit only.';
  updateListings(initial);
}
async function refresh(){
  if(busy)return;
  const selected=selectedSources().map(id=>sources.find(source=>source.id===id)).filter(Boolean);
  if(!selected.length){$('#status').text('Select at least one source to fetch.');return;}
  rememberSelections();setBusy(true);displayErrors([]);
  const errors=[];let completed=0,saved=true;
  try{
    for(const source of selected){
      try{
        const snapshot=await bikeSearchSources.fetchSource(source,message=>$('#status').text(source.label+': '+message));
        snapshots=snapshots.filter(s=>s.sourceId!==source.id).concat(snapshot);
        saved=persistInventory()&&saved;completed++;updateListings();
      }catch(error){errors.push({sourceId:source.id,error:error.message});displayErrors(errors);}
    }
    $('#status').text('Finished: '+completed+' source(s) refreshed'+(errors.length?', '+errors.length+' failed':'')+'. '+(saved?'Fresh listings saved in this browser.':'Fresh listings could not be saved and are available for this visit only.'));
  }finally{setBusy(false);}
}
async function updateShowrooms(){
  if(busy)return;setBusy(true);$('#status').text('Checking TeamMoto showroom list…');
  try{
    const discovered=await bikeSearchSources.discoverShowrooms();
    for(const source of discovered)if(!sources.some(s=>s.id===source.id))sources.push(source);
    const saved=persistInventory();renderSources();
    $('#status').text('Showroom list updated'+(saved?' and saved in this browser.':' for this visit only.')+' Select showrooms and fetch their listings.');
  }catch(error){$('#status').text('Showroom update failed: '+error.message);}finally{setBusy(false);}
}
$(async function(){
  $(document).on('click',event=>{if(!$(event.target).closest('.multi-select').length)$('.multi-select').prop('open',false);});
  $(document).on('keydown',event=>{if(event.key==='Escape')$('.multi-select').prop('open',false);});
  window.addEventListener('pagehide',()=>{if(preferencesReady&&selectionDirty&&!$('#min-price,#max-price,#min-km,#max-km').toArray().some(el=>!el.validity.valid)){clearTimeout(saveTimer);try{localStorage.setItem(preferencesKey,JSON.stringify(capturePreferences()));}catch{}}});
  $('#search,#min-price,#max-price,#min-km,#max-km').on('input',()=>{visibleLimit=48;render();rememberSelections();});
  $('#brand,#condition,#display-source,#sort').on('change',function(){if(this.multiple)updateMulti(this.id);visibleLimit=48;render();rememberSelections();});
  $('#clear').on('click',()=>{$('#search,#min-price,#max-price,#min-km,#max-km').val('');$('#brand,#condition,#display-source').val([]);$('#sort').val('name');['brand','condition','display-source'].forEach(updateMulti);visibleLimit=48;render();rememberSelections();});
  $('#more').on('click',()=>{visibleLimit+=48;render();});$('#refresh').on('click',refresh);
  $('#download').on('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(window.bikeSearchResult,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bikes-filtered.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  try{preferences=readPreferences();await loadState(true);preferencesReady=true;$('#selection-status').text('Selections loaded.');if(!preferences)rememberSelections();setBusy(false);$('#status').text('Loaded '+bikes.length+' bikes from '+snapshots.length+' saved sources. '+inventoryNotice+' Choose sources and click Fetch selected sources for fresh listings.');}
  catch(e){$('#status').text('Could not load saved sources: '+errorText(e));}
});



