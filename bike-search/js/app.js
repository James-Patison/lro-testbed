'use strict';
const staticMode=!['localhost','127.0.0.1'].includes(location.hostname);
const preferencesKey='bike-search-preferences';
let sources=[],snapshots=[],bikes=[],busy=false,visibleLimit=48,pollTimer,lastCompleted=-1;
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
  try{while(pendingPreferences){const next=pendingPreferences;pendingPreferences=null;(staticMode ? localStorage.setItem(preferencesKey,JSON.stringify(next)) : await $.ajax({url:'/api/preferences',method:'POST',contentType:'application/json',data:JSON.stringify(next)}));preferences=next;}
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
function setBusy(value){busy=value;if(staticMode){$("#refresh,#update-showrooms,.source-check,.source-tools button").prop("disabled",true);return;}$('#refresh,#update-showrooms,.source-check,.source-tools button').prop('disabled',value);}
function renderSources(){
  const teamOpen=$('.team-sources').prop('open');
  const previous=$('.source-check').length?selectedSources():savedSelections();
  const selected=new Set(previous ?? ['brisbane-used-windsor','brisbane-new','olivers']);
  const $root=$('#sources').empty();
  const row=source=>{
    const snapshot=snapshots.find(s=>s.sourceId===source.id);
    const $row=$('<div>').addClass('source-row');
    const $check=$('<input>').attr({type:'checkbox',value:source.id}).addClass('source-check').prop('checked',selected.has(source.id));
    $('<label>').append($check,document.createTextNode(source.label)).appendTo($row);
    $('<span>').addClass('source-meta').text(snapshot?snapshot.bikes.length+' bikes · '+new Date(snapshot.fetchedAt).toLocaleString('en-AU'):'Not fetched yet').appendTo($row);
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
async function loadState(initial=false){
  const state=await $.getJSON(staticMode?'data/state.json':'/api/state');sources=state.sources;snapshots=state.snapshots;
  bikes=snapshots.flatMap(s=>s.bikes);renderSources();populateFilters();if(initial)applyPreferences();render();
  if(state.errors.length)displayErrors(state.errors);
  return state;
}
async function checkJob(){
  try{
    const job=await $.getJSON('/api/job');if(!job){setBusy(false);return;}
    $('#status').text(job.message+' · '+job.results.length+' / '+job.sourceIds.length+' sources finished');
    if(job.results.length!==lastCompleted){lastCompleted=job.results.length;await loadState();displayErrors(job.results.filter(r=>!r.ok));}
    if(job.status==='running'){pollTimer=setTimeout(checkJob,1000);return;}
    await loadState();displayErrors(job.results.filter(r=>!r.ok));
    const successes=job.results.filter(r=>r.ok).length;
    $('#status').text('Finished: '+successes+' source'+(successes===1?'':'s')+' saved'+(successes<job.results.length?', '+(job.results.length-successes)+' failed':'')+'. Lists will stay saved until you fetch again.');
    setBusy(false);
  }catch(e){$('#status').text('Could not read fetch progress: '+errorText(e)+'. Reload to reconnect; the server may still be fetching.');setBusy(false);}
}
async function refresh(){
  if(busy)return;const sourceIds=selectedSources();
  if(!sourceIds.length){$('#status').text('Select at least one source to fetch.');return;}
  rememberSelections();setBusy(true);lastCompleted=-1;$('#fetch-errors').empty();$('#status').text('Starting selected sources…');
  try{await $.ajax({url:'/api/fetch',method:'POST',contentType:'application/json',data:JSON.stringify({sourceIds})});await checkJob();}
  catch(e){$('#status').text('Could not start fetch: '+errorText(e));setBusy(false);}
}
async function updateShowrooms(){
  if(busy)return;setBusy(true);$('#status').text('Checking TeamMoto showroom list…');
  try{await $.ajax({url:'/api/showrooms',method:'POST',contentType:'application/json',data:'{}'});await loadState();$('#status').text('Showroom list updated. Select showrooms and click Fetch selected sources to get their bikes.');}
  catch(e){$('#status').text('Showroom update failed: '+errorText(e));}finally{setBusy(false);}
}
$(async function(){
  $(document).on('click',event=>{if(!$(event.target).closest('.multi-select').length)$('.multi-select').prop('open',false);});
  $(document).on('keydown',event=>{if(event.key==='Escape')$('.multi-select').prop('open',false);});
  window.addEventListener('pagehide',()=>{if(!staticMode&&preferencesReady&&selectionDirty&&!$('#min-price,#max-price,#min-km,#max-km').toArray().some(el=>!el.validity.valid)){clearTimeout(saveTimer);navigator.sendBeacon('/api/preferences',new Blob([JSON.stringify(capturePreferences())],{type:'application/json'}));}});
  $('#search,#min-price,#max-price,#min-km,#max-km').on('input',()=>{visibleLimit=48;render();rememberSelections();});
  $('#brand,#condition,#display-source,#sort').on('change',function(){if(this.multiple)updateMulti(this.id);visibleLimit=48;render();rememberSelections();});
  $('#clear').on('click',()=>{$('#search,#min-price,#max-price,#min-km,#max-km').val('');$('#brand,#condition,#display-source').val([]);$('#sort').val('name');['brand','condition','display-source'].forEach(updateMulti);visibleLimit=48;render();rememberSelections();});
  $('#more').on('click',()=>{visibleLimit+=48;render();});$('#refresh').on('click',refresh);
  $('#download').on('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(window.bikeSearchResult,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bikes-filtered.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  try{preferences=staticMode?JSON.parse(localStorage.getItem(preferencesKey)||'null'):await $.getJSON('/api/preferences');const state=await loadState(true);preferencesReady=true;$('#selection-status').text('Selections loaded.');if(!preferences)rememberSelections();if(state.job?.status==='running'){setBusy(true);await checkJob();}else{setBusy(false);$('#status').text('Loaded '+bikes.length+' bikes from '+snapshots.length+' saved sources.'+(staticMode?' GitHub Pages shows a saved snapshot. Run locally to refresh inventories.':' Fetching requires a manual click.'));}}
  catch(e){$('#status').text('Could not load saved sources: '+errorText(e));}
});



