/* AUNE : générateur de PDF/A-3 « hybride » Factur-X, sans dépendance.
   Chargé à la demande avec fx-fonts.js. API : FXPDF.build(model, xmlString) -> Promise<Uint8Array>
   Le PDF embarque factur-x.xml (AFRelationship Alternative), des polices et un profil sRGB intégrés (PDF/A-3b). */
(function(){
'use strict';
const PW=595.28,PH=841.89,MX=42,TOP=48,BOT=60;
const CP={0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
const norm=s=>String(s==null?'':s).replace(/[   ]/g,' ').replace(/[\r\t]/g,' ');
const code=ch=>{const n=ch.charCodeAt(0);if(n>=32&&n<0x80)return n;if(n>=0xA0&&n<=0xFF)return n;return CP[n]!==undefined?CP[n]:63};
const enc=new TextEncoder();
const unb64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u};
const hex=u=>{let s='';for(const b of u)s+=b.toString(16).padStart(2,'0');return s};
const num=n=>(Math.round(n*100)/100).toString();
const pdfStr=s=>'('+String(s).replace(/[\\()]/g,'\\$&')+')'; // ASCII uniquement
const hexStr=s=>'<'+Array.from(norm(s),c=>code(c).toString(16).padStart(2,'0')).join('')+'>';

class Font{
  constructor(key,data){this.key=key;this.d=data}
  w(s,size){let t=0;for(const c of norm(s)){const k=code(c)-32;t+=this.d.widths[k]||0}return t*size/1000}
  wrap(s,max,size){
    const out=[];
    for(const para of norm(s).split('\n')){
      let line='';
      for(let word of para.split(' ')){
        while(this.w(word,size)>max){ // mot trop long : coupe
          let i=word.length;while(i>1&&this.w(word.slice(0,i),size)>max)i--;
          if(line){out.push(line);line=''}
          out.push(word.slice(0,i));word=word.slice(i);
        }
        const t=line?line+' '+word:word;
        if(!line||this.w(t,size)<=max)line=t;else{out.push(line);line=word}
      }
      out.push(line);
    }
    return out;
  }
}

class Page{
  constructor(){this.ops=[]}
  text(x,y,s,f,size,o){
    o=o||{};let w=f.w(s,size);
    if(o.align==='right')x-=w;else if(o.align==='center')x-=w/2;
    const c=o.color||[0,0,0];
    this.ops.push(`BT /${f.key} ${num(size)} Tf ${num(c[0])} ${num(c[1])} ${num(c[2])} rg ${num(x)} ${num(PH-y)} Td ${hexStr(s)} Tj ET`);
  }
  line(x1,y1,x2,y2,wd,c){c=c||[0,0,0];this.ops.push(`${num(wd||.6)} w ${num(c[0])} ${num(c[1])} ${num(c[2])} RG ${num(x1)} ${num(PH-y1)} m ${num(x2)} ${num(PH-y2)} l S`)}
  rect(x,y,w,h,c){this.ops.push(`${num(c[0])} ${num(c[1])} ${num(c[2])} rg ${num(x)} ${num(PH-y-h)} ${num(w)} ${num(h)} re f`)}
}

async function deflate(u8){
  if(typeof CompressionStream==='undefined')return null;
  try{const cs=new CompressionStream('deflate'),w=cs.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer())}catch(e){return null}
}

function layout(m,R,B){
  const pages=[];let p,y;
  const GREY=[.42,.44,.5],LINE=[.8,.8,.78],SOFT=[.96,.95,.92];
  const newPage=()=>{p=new Page();pages.push(p);y=TOP};
  const colX={q:PW-MX-205,u:PW-MX-165,pu:PW-MX-78,t:PW-MX}; // la quantité finit à q+30 ; PU et total alignés à droite
  const descW=colX.q-MX-10;
  const tableHead=()=>{
    p.rect(MX,y-12,PW-2*MX,20,SOFT);
    p.text(MX+6,y+2,'Désignation',B,9);p.text(colX.q+30,y+2,'Qté',B,9,{align:'right'});p.text(colX.u,y+2,'Unité',B,9);
    p.text(colX.pu,y+2,'PU HT',B,9,{align:'right'});p.text(colX.t-6,y+2,'Total HT',B,9,{align:'right'});y+=22;
  };
  newPage();
  // En-tête : émetteur à gauche, titre à droite
  const s=m.seller;let ly=y;
  p.text(MX,ly,s.name||'Votre entreprise',B,13);ly+=15;
  for(const t of [s.legal,s.siret?'SIRET '+s.siret:'',s.vatId?'TVA '+s.vatId:'',s.address,[s.phone,s.email].filter(Boolean).join('  ·  ')].filter(Boolean))
    for(const l of R.wrap(t,260,9.5)){p.text(MX,ly,l,R,9.5);ly+=12.5}
  p.text(PW-MX,y+6,m.title,B,22,{align:'right'});
  let ry=y+26;
  for(const t of [`N° ${m.number}`,`Date : ${m.date}`,m.due?`${m.dueLabel} ${m.due}`:'']) if(t){p.text(PW-MX,ry,t,R,10,{align:'right'});ry+=14}
  y=Math.max(ly,ry)+18;
  // Client
  p.text(MX,y,m.clientLabel,B,10);y+=14;
  for(const t of [m.client.name,m.client.address,m.client.siren?'SIREN : '+m.client.siren:'']) if(t)for(const l of R.wrap(t,300,10)){p.text(MX,y,l,R,10);y+=13}
  y+=6;
  for(const t of m.infos) for(const l of R.wrap(t,PW-2*MX,9.5)){p.text(MX,y,l,R,9.5);y+=12.5}
  y+=14;
  tableHead();
  for(const l of m.lines){
    const dl=R.wrap(l.desc,descW,9.5),h=Math.max(1,dl.length)*12.5+8;
    if(y+h>PH-BOT-30){newPage();tableHead()}
    dl.forEach((t,i)=>p.text(MX+6,y+i*12.5,t,R,9.5));
    p.text(colX.q+30,y,l.qty,R,9.5,{align:'right'});p.text(colX.u,y,l.unit,R,9.5);
    p.text(colX.pu,y,l.pu,R,9.5,{align:'right'});p.text(colX.t-6,y,l.total,R,9.5,{align:'right'});
    y+=h-4;p.line(MX,y,PW-MX,y,.4,LINE);y+=10;
  }
  // Totaux
  const need=m.totals.length*17+10;if(y+need>PH-BOT){newPage()}
  y+=4;const tx=PW-MX-230;
  for(const [lab,val,bold] of m.totals){
    if(bold){p.line(tx,y-12,PW-MX,y-12,1)}
    p.text(tx,y,lab,bold?B:R,bold?11:10);p.text(PW-MX-6,y,val,bold?B:R,bold?11:10,{align:'right'});y+=17;
  }
  y+=8;
  // Mentions
  for(const [t,small] of m.mentions){
    const sz=small?8.5:9.5,ls=R.wrap(t,PW-2*MX,sz);
    if(y+ls.length*12>PH-BOT){newPage()}
    for(const l of ls){p.text(MX,y,l,R,sz,{color:small?GREY:[0,0,0]});y+=sz+3}
    y+=4;
  }
  if(m.signature){
    if(y+90>PH-BOT)newPage();
    p.line(MX,y,MX+280,y,.6);p.line(MX,y+80,MX+280,y+80,.6);p.line(MX,y,MX,y+80,.6);p.line(MX+280,y,MX+280,y+80,.6);
    p.text(MX+8,y+14,m.signature,R,9.5);y+=90;
  }
  pages.forEach((pg,i)=>pg.text(PW/2,PH-28,`${m.footer}  ·  Page ${i+1}/${pages.length}`,R,8,{align:'center',color:GREY}));
  return pages;
}

const xmlEsc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function xmp(m,now,xmlName){
  const prop=(n,d)=>`<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${n}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${d}</pdfaProperty:description></rdf:li>`;
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(m.title)} ${xmlEsc(m.number)}</rdf:li></rdf:Alt></dc:title><dc:creator><rdf:Seq><rdf:li>${xmlEsc(m.seller.name||'AUNE')}</rdf:li></rdf:Seq></dc:creator></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>AUNE</pdf:Producer></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>AUNE</xmp:CreatorTool><xmp:CreateDate>${now.iso}</xmp:CreateDate><xmp:ModifyDate>${now.iso}</xmp:ModifyDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>${xmlName}</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#"><pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource"><pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema><pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix><pdfaSchema:property><rdf:Seq>${prop('DocumentFileName','name of the embedded XML invoice file')}${prop('DocumentType','INVOICE')}${prop('Version','The actual version of the Factur-X XML schema')}${prop('ConformanceLevel','The conformance level of the embedded Factur-X data')}</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>
</rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
}

async function build(m,xml){
  const R=new Font('F1',FX_FONTS.regular),B=new Font('F2',FX_FONTS.bold);
  const pages=layout(m,R,B);
  const d=new Date(),p2=n=>String(n).padStart(2,'0'),off=-d.getTimezoneOffset(),sg=off<0?'-':'+',ao=Math.abs(off);
  const iso=`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}${sg}${p2(Math.floor(ao/60))}:${p2(ao%60)}`;
  const pdate=`D:${iso.slice(0,4)}${iso.slice(5,7)}${iso.slice(8,10)}${iso.slice(11,13)}${iso.slice(14,16)}${iso.slice(17,19)}${sg}${p2(Math.floor(ao/60))}'${p2(ao%60)}'`;
  const xmlName='factur-x.xml';
  const objs=[]; // chaque objet : Uint8Array (corps sans "n 0 obj")
  const parts=(...a)=>{let n=0;const bs=a.map(x=>typeof x==='string'?new Uint8Array(Array.from(x,c=>c.charCodeAt(0)&255)):x);bs.forEach(b=>n+=b.length);const o=new Uint8Array(n);let i=0;bs.forEach(b=>{o.set(b,i);i+=b.length});return o};
  const add=b=>{objs.push(b);return objs.length};
  const reserve=()=>{objs.push(null);return objs.length};
  const set=(id,b)=>{objs[id-1]=b};
  const stream=async(dict,data,compress)=>{
    let body=data,f='';
    if(compress){const z=await deflate(data);if(z&&z.length<data.length){body=z;f=' /Filter /FlateDecode'}}
    return parts(`<< ${dict}${f} /Length ${body.length} >>\nstream\n`,body,'\nendstream');
  };
  const catalog=reserve(),pagesId=reserve();
  const fontIds={};
  for(const [f,k] of [[R,'regular'],[B,'bold']]){
    const d0=FX_FONTS[k],data=unb64(d0.b64),ff=add(await stream(`/Length1 ${data.length}`,data,true));
    const base=(k==='bold'?'ABCDEF+LiberationSans-Bold':'ABCDEF+LiberationSans');
    const fd=add(parts(`<< /Type /FontDescriptor /FontName /${base} /Flags 32 /FontBBox [${d0.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${d0.asc} /Descent ${d0.desc} /CapHeight ${d0.cap} /StemV ${k==='bold'?140:80} /FontFile2 ${ff} 0 R >>`));
    fontIds[f.key]=add(parts(`<< /Type /Font /Subtype /TrueType /BaseFont /${base} /FirstChar 32 /LastChar 255 /Widths [${d0.widths.join(' ')}] /FontDescriptor ${fd} 0 R /Encoding /WinAnsiEncoding >>`));
  }
  const res=`<< /Font << /F1 ${fontIds.F1} 0 R /F2 ${fontIds.F2} 0 R >> >>`;
  const pageIds=[];
  for(const pg of pages){
    const c=add(await stream('',enc.encode(pg.ops.join('\n')),true));
    pageIds.push(add(parts(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources ${res} /Contents ${c} 0 R >>`)));
  }
  set(pagesId,parts(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(i=>i+' 0 R').join(' ')}] >>`));
  const icc=add(await stream('/N 3 /Alternate /DeviceRGB',unb64(FX_ICC),true));
  const oi=add(parts(`<< /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (sRGB IEC61966-2.1) /Info (sRGB IEC61966-2.1) /DestOutputProfile ${icc} 0 R >>`));
  const xb=enc.encode(xml);
  const emb=add(await stream(`/Type /EmbeddedFile /Subtype /text#2Fxml /Params << /Size ${xb.length} /ModDate (${pdate}) >>`,xb,false));
  const fs=add(parts(`<< /Type /Filespec /F (${xmlName}) /UF (${xmlName}) /Desc (Factur-X invoice) /AFRelationship /Alternative /EF << /F ${emb} 0 R /UF ${emb} 0 R >> >>`));
  const md=add(await stream('/Type /Metadata /Subtype /XML',enc.encode(xmp(m,{iso},xmlName)),false));
  set(catalog,parts(`<< /Type /Catalog /Pages ${pagesId} 0 R /Metadata ${md} 0 R /OutputIntents [${oi} 0 R] /AF [${fs} 0 R] /Names << /EmbeddedFiles << /Names [(${xmlName}) ${fs} 0 R] >> >> /Lang (fr-FR) >>`));
  // assemblage
  const out=[parts('%PDF-1.7\n%'),new Uint8Array([0xE2,0xE3,0xCF,0xD3]),parts('\n')];
  let pos=out.reduce((n,b)=>n+b.length,0);const offs=[];
  objs.forEach((o,i)=>{offs.push(pos);const h=parts(`${i+1} 0 obj\n`),t=parts('\nendobj\n');out.push(h,o,t);pos+=h.length+o.length+t.length});
  const id=hex(crypto.getRandomValues(new Uint8Array(16)));
  const xref=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('');
  out.push(parts(xref+`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${pos}\n%%EOF\n`));
  return parts(...out);
}
window.FXPDF={build};
})();
