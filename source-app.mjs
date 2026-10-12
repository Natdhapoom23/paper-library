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
async function openBook(id){for(const p of pdfCache.values())p.then(d=>d.destroy()).catch(()=>{});pdfCache.clear();current=await api('/api/books/'+id);$('#reader').hidden=false;$('#book-title').textContent=current.title;await buildReader(current.position||0)}
async function buildReader(position=0){if(flip){flip.destroy();$('#stage').innerHTML='<div id="book"></div>'}const host=$('#book');const cover=document.createElement('div');cover.className='page coverpage';cover.style.setProperty('--cover',color(current.title));cover.innerHTML=`<div class="page-inner"><small>YOUR PERSONAL LIBRARY</small><h2>${esc(current.title)}</h2><p>✦</p><small>พลิก · เก็บความคิดไว้เป็นเล่ม</small></div>`;cover.firstElementChild.style.background=color(current.title);host.append(cover);
current.pages.forEach((p,i)=>{const el=document.createElement('div');el.className='page';el.dataset.index=i+1;const inner=document.createElement('div');inner.className='page-inner';if(p.type==='text'){const text=document.createElement('div');text.className='page-text';text.textContent=p.content;inner.append(text)}else{const img=document.createElement('img');img.alt='หน้า '+(i+1);if(p.type==='image')img.src=p.content;else{img.dataset.pdf=p.content;img.dataset.page=p.page;img.alt='กำลังโหลดหน้า PDF '+p.page}inner.append(img)}const footer=document.createElement('footer');footer.textContent=(i+1)+' / '+current.pages.length;inner.append(footer);el.append(inner);host.append(el)});
const mode=$('#mode').value;const single=mode==='single'||(mode==='auto'&&window.innerHeight>window.innerWidth);const stage=$('#stage');const height=Math.max(260,Math.min(720,stage.clientHeight-20));const width=Math.min(height*.7,(stage.clientWidth-30)/(single?1:2));
const shell=document.createElement('div');shell.style.width=Math.floor(width*(single?1:2))+'px';host.replaceWith(shell);shell.append(host);flip=new St.PageFlip(host,{width:Math.floor(width),height:Math.floor(Math.min(height,width/0.7)),size:'fixed',usePortrait:single,showCover:false,useMouseEvents:true,swipeDistance:25,startPage:Math.min(position,current.pages.length),maxShadowOpacity:.35,mobileScrollSupport:false,flippingTime:700});flip.loadFromHTML(host.querySelectorAll('.page'));
const update=()=>{$('#page-number').textContent=`${flip.getCurrentPageIndex()+1} / ${current.pages.length+1} หน้า`;};flip.on('flip',()=>{update();api('/api/books/'+current.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({position:flip.getCurrentPageIndex()})}).catch(()=>toast('บันทึกตำแหน่งอ่านไม่สำเร็จ'));loadPdfPages()});update();await loadPdfPages();}
const pdfCache=new Map();async function loadPdfPages(){const idx=flip.getCurrentPageIndex();const images=[...$('#book').querySelectorAll('img[data-pdf]')].filter(img=>{const page=+img.closest('.page').dataset.index;return Math.abs(page-idx)<=3});for(const img of images){if(img.dataset.loading)continue;img.dataset.loading='1';try{let pdf=pdfCache.get(img.dataset.pdf);if(!pdf){pdf=pdfjs.getDocument(img.dataset.pdf).promise;pdfCache.set(img.dataset.pdf,pdf)}const page=await(await pdf).getPage(+img.dataset.page);const viewport=page.getViewport({scale:1.4});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;img.src=canvas.toDataURL('image/jpeg',.88);delete img.dataset.pdf}catch{img.alt='โหลดหน้า PDF ไม่สำเร็จ';delete img.dataset.loading}}}
$('#prev').onclick=()=>flip?.flipPrev();$('#next').onclick=()=>flip?.flipNext();$('#back').onclick=()=>{$('#reader').hidden=true;refresh().catch(e=>toast(e.message))};$('#mode').onchange=()=>buildReader(flip?.getCurrentPageIndex()||0).catch(e=>toast(e.message));let timer;window.onresize=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!$('#reader').hidden)buildReader(flip?.getCurrentPageIndex()||0).catch(e=>toast(e.message))},250)};window.onkeydown=e=>{if($('#reader').hidden)return;if(e.key==='ArrowRight')flip?.flipNext();if(e.key==='ArrowLeft')flip?.flipPrev();if(e.key==='Escape')$('#back').click()};initAuth().catch(e=>toast(e.message));


function accountState(){
 const user=session?.user;$('#account').textContent=user?(user.is_anonymous?'บัญชีทดลอง · เบราว์เซอร์นี้':user.email):'';
 $('#signout').hidden=!user;$('#login-open').hidden=!!user&&!user.is_anonymous;
 if(!user){books=[];renderShelf()}
}
async function initAuth(){const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;accountState();if(session)await refresh();else $('#login').showModal();
 client.auth.onAuthStateChange((event,next)=>{session=next;accountState();if(next){$('#login').close();setTimeout(()=>refresh().catch(e=>toast(e.message)),0)}else{$('#reader').hidden=true}});
}
$('#login-open').onclick=()=>$('#login').showModal();$('#login-close').onclick=()=>$('#login').close();
$('#guest').onclick=async()=>{const btn=$('#guest');btn.disabled=true;try{if(!session){const {data,error}=await client.auth.signInAnonymously();if(error)throw error;session=data.session}accountState();$('#login').close();await refresh()}catch(e){$('#login-status').textContent=e.message}finally{btn.disabled=false}};
$('#login-form').onsubmit=async e=>{e.preventDefault();$('#email-submit').disabled=true;try{const {error}=await client.auth.signInWithOtp({email:$('#email').value.trim(),options:{emailRedirectTo:new URL('./',location.href).href}});if(error)throw error;$('#login-status').textContent='ส่งลิงก์แล้ว เปิดอีเมลแล้วกดลิงก์เพื่อเข้าสู่ระบบบนอุปกรณ์นี้ หากยังไม่เห็นให้ตรวจจดหมายขยะ'}catch(e){$('#login-status').textContent=e.message}finally{$('#email-submit').disabled=false}};
$('#signout').onclick=async()=>{if(session?.user.is_anonymous&&!confirm('ออกจากบัญชีทดลองแล้วอาจกลับเข้าอ่านหนังสือชุดนี้ไม่ได้ ต้องการออกหรือไม่?'))return;const {error}=await client.auth.signOut();if(error)toast(error.message);else{session=null;accountState();$('#reader').hidden=true;$('#login').showModal()}};
