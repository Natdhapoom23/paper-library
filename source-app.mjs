import * as pdfjs from './pdf.mjs';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
const client=createClient(SUPABASE_URL,SUPABASE_KEY);let session=null;
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.mjs',import.meta.url).href;
const $=s=>document.querySelector(s);let books=[],selected=[],flip,current;
const colors=['#31564a','#6b493d','#45546c','#665c39','#634b61'];
const color=t=>colors[Array.from(t).reduce((a,c)=>a+c.charCodeAt(0),0)%colors.length];
const esc=t=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,options={}){
 if(!session)throw Error('กรุณาเข้าสู่ระบบก่อน');
 const body=options.body?JSON.parse(options.body):null;
 let result;
 if(url==='/api/books'&&!options.method){result=await client.from('paper_books').select('id,title,created,position,pages').order('created',{ascending:false});if(result.error)throw result.error;return result.data.map(({pages,...b})=>({...b,count:pages.length}))}
 if(url==='/api/books'&&options.method==='POST'){result=await client.from('paper_books').insert({...body,owner_id:session.user.id}).select('id').single()}
 else if(url.startsWith('/api/books/')){const id=url.split('/').pop();if(options.method==='PATCH')result=await client.from('paper_books').update({position:body.position}).eq('id',id);else{result=await client.from('paper_books').select('*').eq('id',id).single();if(result.error)throw result.error;const paths=[...new Set(result.data.pages.filter(p=>p.type!=='text').map(p=>p.content))];if(paths.length){const {data,error}=await client.storage.from('paper-library').createSignedUrls(paths,3600);if(error)throw error;const urls=new Map(data.map(p=>[p.path,p.signedUrl]));if(data.some(p=>p.error||!p.signedUrl))throw Error('ไม่พบไฟล์หนังสือบางหน้า');result.data.pages=result.data.pages.map(p=>p.type==='text'?p:{...p,content:urls.get(p.content)})}}}
 else throw Error('คำสั่งไม่รองรับ');
 if(result.error)throw result.error;return result.data||{ok:true};
}

function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3500)}
async function refresh(){books=await api('/api/books');renderShelf()}
function renderShelf(){const list=books.filter(b=>b.title.toLowerCase().includes($('#search').value.toLowerCase()));$('#count').textContent=`${books.length} เล่ม`;$('#shelf').innerHTML='';for(const b of list){const tile=document.createElement('button');tile.className='tile';tile.style.setProperty('--cover',color(b.title));tile.innerHTML=`<div class="cover"><small>PERSONAL EDITION</small><h3>${esc(b.title)}</h3><div class="ornament">✦</div><small>พลิก · LIBRARY</small></div><p>${b.count} หน้า · ${new Date(b.created).toLocaleDateString('th-TH')}</p>`;tile.onclick=()=>openBook(b.id).catch(e=>toast(e.message));$('#shelf').append(tile)}if(!list.length)$('#shelf').innerHTML='<div class="empty">เริ่มชั้นหนังสือของคุณ ด้วยข้อความหรือไฟล์เล่มแรก<br>กด “สร้างหนังสือ” ที่มุมขวาบน</div>'}
$('#search').oninput=renderShelf;$('#add').onclick=()=>session?$('#create').showModal():$('#login').showModal();$('#close').onclick=()=>$('#create').close();
function fileList(){const el=$('#filelist');el.innerHTML='';selected.forEach((f,i)=>{const row=document.createElement('div');const name=document.createElement('span');name.textContent=`${i+1}. ${f.name}`;row.append(name);for(const [label,action] of [['↑',()=>{if(i){[selected[i-1],selected[i]]=[selected[i],selected[i-1]];fileList()}}],['×',()=>{selected.splice(i,1);fileList()}]]){const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.onclick=action;row.append(btn)}el.append(row)})}
$('#files').onchange=e=>{selected.push(...e.target.files);fileList();e.target.value=''};$('#drop').ondragover=e=>e.preventDefault();$('#drop').ondrop=e=>{e.preventDefault();selected.push(...e.dataTransfer.files);fileList()};
function textPages(text){const pages=[];let chunk='';for(const line of text.replace(/\r/g,'').split('\n')){const parts=line.match(/.{1,68}/gu)||[''];for(const part of parts){if(chunk.split('\n').length>=19||chunk.length+part.length>900){pages.push({type:'text',content:chunk});chunk=''}chunk+=part+'\n'}}if(chunk.trim())pages.push({type:'text',content:chunk});return pages}
$('#form').onsubmit=async e=>{e.preventDefault();$('#submit').disabled=true;const status=$('#status');const pendingUploads=[];try{
const pages=textPages($('#text').value),originals=[];
if(selected.length>100)throw Error('เลือกได้สูงสุด 100 ไฟล์');
const supported=['docx','pdf','txt','md','csv','png','jpg','jpeg','webp','gif'];
for(const f of selected){const ext=f.name.split('.').pop().toLowerCase();if(!supported.includes(ext))throw Error('ยังไม่รองรับ: '+f.name);if(f.size>50*1024*1024)throw Error('ไฟล์เกิน 50 MB: '+f.name)}
for(const f of selected){
 const ext=f.name.split('.').pop().toLowerCase();status.textContent='กำลังอ่าน: '+f.name;
 let additions=[];
 if(ext==='docx'){const result=await mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()});additions=textPages(result.value)}
 else if(['txt','md','csv'].includes(ext))additions=textPages(await f.text());
 else if(ext==='pdf'){const pdf=await pdfjs.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;for(let n=1;n<=pdf.numPages;n++)additions.push({type:'pdf',content:'',page:n});await pdf.destroy()}
 else{const bitmap=await createImageBitmap(f);bitmap.close();additions=[{type:'image',content:''}]}
 if(pages.length+additions.length>1000)throw Error('หนังสือเกิน 1,000 หน้า');
 const key=session.user.id+'/'+crypto.randomUUID()+'.'+ext;
 const mime={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',md:'text/markdown',csv:'text/csv',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'}[ext];
 status.textContent='กำลังเก็บไฟล์: '+f.name;
 const {error}=await client.storage.from('paper-library').upload(key,f,{contentType:mime,upsert:false});if(error)throw error;
 pendingUploads.push(key);originals.push({name:f.name,path:key,size:f.size});
 pages.push(...additions.map(p=>p.type==='text'?p:{...p,content:key}));
}

if(!pages.length)throw Error('กรุณาเพิ่มข้อความหรือไฟล์ก่อน');if(pages.length>1000)throw Error('หนังสือเกิน 1,000 หน้า');status.textContent='กำลังบันทึกหนังสือ…';const b=await api('/api/books',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('#title').value,pages,original_files:originals})});pendingUploads.length=0;$('#create').close();$('#form').reset();selected=[];fileList();status.textContent='';await refresh();await openBook(b.id);
}catch(err){status.textContent=err.message;if(pendingUploads.length){const {error}=await client.storage.from('paper-library').remove(pendingUploads);if(error)status.textContent+=' (ไฟล์บางส่วนอาจค้างในพื้นที่จัดเก็บ)'}}finally{$('#submit').disabled=false}};
let readerPages=[],readerGeneration=0,resizeTimer;
function readerAnchor(){const p=readerPages[(flip?.getCurrentPageIndex()||0)-1];return p?{source:p.source,offset:p.offset||0}:{source:0,offset:0}}
function splitForPage(content,width,height){
 const meter=document.createElement('div');meter.className='page text-measure';meter.style.cssText=`position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;visibility:hidden;pointer-events:none;`;
 const inner=document.createElement('div');inner.className='page-inner';const text=document.createElement('div');text.className='page-text';const footer=document.createElement('footer');footer.textContent='1 / 1';inner.append(text,footer);meter.append(inner);document.body.append(meter);
 const pieces=[],segments=[];if(typeof Intl.Segmenter==='function'){segments.push(...Array.from(new Intl.Segmenter('th',{granularity:'grapheme'}).segment(content),s=>({text:s.segment,index:s.index})))}else{let offset=0;for(const ch of Array.from(content)){const last=segments[segments.length-1];if(last&&(/\p{Mark}/u.test(ch)||ch==='\u200d'||last.text.endsWith('\u200d')||ch==='\ufe0f'))last.text+=ch;else segments.push({text:ch,index:offset});offset+=ch.length}}let start=0;
 while(start<segments.length){let lo=start+1,hi=segments.length,best=start+1;while(lo<=hi){const mid=Math.floor((lo+hi)/2);text.textContent=content.slice(segments[start].index,mid===segments.length?content.length:segments[mid].index);if(text.scrollHeight<=text.clientHeight+1){best=mid;lo=mid+1}else hi=mid-1}
 let end=best;if(end<segments.length){const boundary=content.slice(segments[start].index,segments[end].index).lastIndexOf('\n');if(boundary>0&&boundary>=(segments[end].index-segments[start].index)*.6){const limit=segments[start].index+boundary+1;while(end>start+1&&segments[end-1].index>=limit)end--}}
 pieces.push({content:content.slice(segments[start].index,end===segments.length?content.length:segments[end].index),offset:segments[start].index});start=end;
 }meter.remove();return pieces.length?pieces:[{content:'',offset:0}];
}
async function openBook(id){for(const p of pdfCache.values())p.then(d=>d.destroy()).catch(()=>{});pdfCache.clear();current=await api('/api/books/'+id);$('#reader').hidden=false;document.body.classList.add('reading');$('#book-title').textContent=current.title;await document.fonts.ready;await buildReader({source:current.position||0,offset:0})}
async function buildReader(anchor=readerAnchor()){
 const generation=++readerGeneration;
 if(flip){flip.destroy();flip=null}$('#stage').innerHTML='<div id="book"></div>';
 const stage=$('#stage'),mode=$('#mode').value;
 const single=mode==='single'||(mode==='auto'&&(window.innerHeight>window.innerWidth||stage.clientWidth<700));
 const availableHeight=Math.max(180,stage.clientHeight-16),availableWidth=Math.max(140,stage.clientWidth-16);
 const width=Math.floor(Math.min(availableHeight*.7,availableWidth/(single?1:2)));
 const height=Math.floor(Math.min(availableHeight,width/.7));
 readerPages=current.pages.flatMap((p,i)=>p.type==='text'?splitForPage(p.content,width,height).map(part=>({...p,...part,source:i+1})):[{...p,source:i+1,offset:0}]);
 let startPage=0;for(let i=0;i<readerPages.length;i++){const p=readerPages[i];if(p.source===anchor.source&&p.offset<=(anchor.offset||0))startPage=i+1}
 const host=$('#book'),cover=document.createElement('div');cover.className='page coverpage';cover.innerHTML=`<div class="page-inner"><small>YOUR PERSONAL LIBRARY</small><h2>${esc(current.title)}</h2><p>✦</p><small>พลิก · เก็บความคิดไว้เป็นเล่ม</small></div>`;cover.firstElementChild.style.background=color(current.title);host.append(cover);
 readerPages.forEach((p,i)=>{const el=document.createElement('div');el.className='page';el.dataset.index=i+1;const inner=document.createElement('div');inner.className='page-inner';if(p.type==='text'){const text=document.createElement('div');text.className='page-text';text.textContent=p.content;inner.append(text)}else{const img=document.createElement('img');img.alt='หน้า '+(i+1);if(p.type==='image')img.src=p.content;else{img.dataset.pdf=p.content;img.dataset.page=p.page;img.alt='กำลังโหลดหน้า PDF '+p.page}inner.append(img)}const footer=document.createElement('footer');footer.textContent=(i+1)+' / '+readerPages.length;inner.append(footer);el.append(inner);host.append(el)});
 const shell=document.createElement('div');shell.className='book-shell';shell.style.width=width*(single?1:2)+'px';host.replaceWith(shell);shell.append(host);
 flip=new St.PageFlip(host,{width,height,size:'fixed',usePortrait:single,showCover:false,useMouseEvents:true,disableFlipByClick:true,swipeDistance:25,startPage,maxShadowOpacity:.35,mobileScrollSupport:false,flippingTime:700});flip.loadFromHTML(host.querySelectorAll('.page'));
 const update=()=>{$('#page-number').textContent=`${flip.getCurrentPageIndex()+1} / ${readerPages.length+1} หน้า`};
 flip.on('flip',()=>{if(generation!==readerGeneration)return;update();api('/api/books/'+current.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({position:readerAnchor().source})}).catch(()=>toast('บันทึกตำแหน่งอ่านไม่สำเร็จ'));loadPdfPages()});update();await loadPdfPages();
}
const pdfCache=new Map();async function loadPdfPages(){if(!flip)return;const idx=flip.getCurrentPageIndex(),generation=readerGeneration;const images=[...$('#book').querySelectorAll('img[data-pdf]')].filter(img=>Math.abs(+img.closest('.page').dataset.index-idx)<=3);for(const img of images){if(img.dataset.loading)continue;img.dataset.loading='1';try{let pdf=pdfCache.get(img.dataset.pdf);if(!pdf){pdf=pdfjs.getDocument(img.dataset.pdf).promise;pdfCache.set(img.dataset.pdf,pdf)}const page=await(await pdf).getPage(+img.dataset.page);const viewport=page.getViewport({scale:1.6});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;if(generation!==readerGeneration||!img.isConnected)continue;img.src=canvas.toDataURL('image/jpeg',.9);img.alt='หน้า PDF '+img.dataset.page;delete img.dataset.pdf}catch{if(img.isConnected){img.alt='โหลดหน้า PDF ไม่สำเร็จ';delete img.dataset.loading}}}}
function scheduleReader(){clearTimeout(resizeTimer);const anchor=readerAnchor();resizeTimer=setTimeout(()=>{if(!$('#reader').hidden)buildReader(anchor).catch(e=>toast(e.message))},150)}
function fullscreenState(){const r=$('#reader'),active=r.classList.contains('paper-only');$('#fullscreen').textContent=active?'⤡ ออกจากเต็มจอ':'⛶ เต็มจอ';$('#fullscreen').setAttribute('aria-pressed',String(active));scheduleReader()}
async function leavePaperOnly(){const r=$('#reader');r.classList.remove('paper-only','controls-visible','native-fullscreen','focus-mode');if(document.fullscreenElement&&document.exitFullscreen){try{await document.exitFullscreen()}catch{}}fullscreenState()}
$('#fullscreen').onclick=async()=>{const r=$('#reader');if(r.classList.contains('paper-only')){await leavePaperOnly();return}r.classList.add('paper-only');r.classList.remove('controls-visible');fullscreenState();toast('แตะกลางกระดาษเพื่อเรียกปุ่มควบคุมกลับมา');const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);if(!ios&&r.requestFullscreen&&document.fullscreenEnabled){r.classList.add('native-fullscreen');try{await r.requestFullscreen()}catch{r.classList.remove('native-fullscreen')}}};
document.addEventListener('fullscreenchange',()=>{const r=$('#reader');if(!document.fullscreenElement&&r.classList.contains('native-fullscreen'))r.classList.remove('native-fullscreen','paper-only','controls-visible');fullscreenState()});
const fontSizes=[16,18,20,24];
function applyFont(size){if(!fontSizes.includes(size))size=16;$('#font-size').value=String(size);$('#font-current').textContent=size+'px';$('#font-minus').disabled=size===16;$('#font-plus').disabled=size===24;document.documentElement.style.setProperty('--reader-font-size',size+'px');try{localStorage.setItem('paper-reader-font',String(size))}catch{}scheduleReader()}
$('#font-minus').onclick=()=>applyFont(fontSizes[Math.max(0,fontSizes.indexOf(+$('#font-size').value)-1)]);$('#font-plus').onclick=()=>applyFont(fontSizes[Math.min(fontSizes.length-1,fontSizes.indexOf(+$('#font-size').value)+1)]);
let savedSize=16;try{savedSize=Number(localStorage.getItem('paper-reader-font'))||16}catch{}applyFont(savedSize);
for(const el of document.querySelectorAll('.reader-toolbar,.reader-bottom')){
 el.addEventListener('touchstart',e=>e.stopPropagation(),{passive:true});
 el.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});
 el.addEventListener('touchend',e=>{e.stopPropagation();const button=e.target.closest('button');if(button&&!button.disabled){e.preventDefault();button.click()}},{passive:false});
}
let paperPointer=null;
$('#stage').addEventListener('pointerdown',e=>{paperPointer={id:e.pointerId,x:e.clientX,y:e.clientY}});
$('#stage').addEventListener('pointercancel',()=>paperPointer=null);
$('#stage').addEventListener('pointerup',e=>{const p=paperPointer;paperPointer=null;if(!p||p.id!==e.pointerId||Math.hypot(e.clientX-p.x,e.clientY-p.y)>12||!$('#reader').classList.contains('paper-only'))return;const page=e.target.closest('.page');if(!page)return;const bounds=page.getBoundingClientRect(),x=(e.clientX-bounds.left)/bounds.width,y=(e.clientY-bounds.top)/bounds.height;if(x>.25&&x<.75&&y>.15&&y<.85)$('#reader').classList.toggle('controls-visible')});

$('#prev').onclick=()=>flip?.flipPrev();$('#next').onclick=()=>flip?.flipNext();
$('#back').onclick=async()=>{if(document.fullscreenElement)await document.exitFullscreen();$('#reader').classList.remove('focus-mode','paper-only','controls-visible','native-fullscreen');$('#reader').hidden=true;document.body.classList.remove('reading');fullscreenState();refresh().catch(e=>toast(e.message))};
$('#mode').onchange=()=>buildReader().catch(e=>toast(e.message));window.onresize=scheduleReader;
window.onkeydown=e=>{if($('#reader').hidden||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key==='ArrowRight'){e.preventDefault();flip?.flipNext()}if(e.key==='ArrowLeft'){e.preventDefault();flip?.flipPrev()}if(e.key==='Escape'){if($('#reader').classList.contains('paper-only')){leavePaperOnly()}else if(!document.fullscreenElement)$('#back').click()}};

initAuth().catch(e=>toast(e.message));
function accountState(){
 const user=session?.user;$('#account').textContent=user?(user.is_anonymous?'บัญชีทดลอง · เบราว์เซอร์นี้':user.email):'';
 $('#signout').hidden=!user;$('#login-open').hidden=!!user&&!user.is_anonymous;
 if(!user){books=[];document.body.classList.remove('reading');renderShelf()}
}
async function initAuth(){const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;accountState();if(session)await refresh();else $('#login').showModal();
 client.auth.onAuthStateChange((event,next)=>{session=next;accountState();if(next){$('#login').close();setTimeout(()=>refresh().catch(e=>toast(e.message)),0)}else{$('#reader').hidden=true}});
}
$('#login-open').onclick=()=>$('#login').showModal();$('#login-close').onclick=()=>$('#login').close();
$('#guest').onclick=async()=>{const btn=$('#guest');btn.disabled=true;try{if(!session){const {data,error}=await client.auth.signInAnonymously();if(error)throw error;session=data.session}accountState();$('#login').close();await refresh()}catch(e){$('#login-status').textContent=e.message}finally{btn.disabled=false}};
$('#login-form').onsubmit=async e=>{e.preventDefault();$('#email-submit').disabled=true;try{const {error}=await client.auth.signInWithOtp({email:$('#email').value.trim(),options:{emailRedirectTo:new URL('./',location.href).href}});if(error)throw error;$('#login-status').textContent='ส่งลิงก์แล้ว เปิดอีเมลแล้วกดลิงก์เพื่อเข้าสู่ระบบบนอุปกรณ์นี้ หากยังไม่เห็นให้ตรวจจดหมายขยะ'}catch(e){$('#login-status').textContent=e.message}finally{$('#email-submit').disabled=false}};
$('#signout').onclick=async()=>{if(session?.user.is_anonymous&&!confirm('ออกจากบัญชีทดลองแล้วอาจกลับเข้าอ่านหนังสือชุดนี้ไม่ได้ ต้องการออกหรือไม่?'))return;const {error}=await client.auth.signOut();if(error)toast(error.message);else{session=null;accountState();$('#reader').hidden=true;$('#login').showModal()}};
