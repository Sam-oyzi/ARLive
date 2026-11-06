// Install Sarra, or use --update-worlds to replace just the panoramas of an installed copy.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import sharp from 'sharp';
const root=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(root,'../..');
const slug='sarra-and-the-little-lost-roar';
const output=path.join(repo,'public','book-art',slug);
const url=`/book-art/${slug}`;
const manifest=JSON.parse(await fs.readFile(path.join(root,'pages.json'),'utf8'));
const experiences=JSON.parse(await fs.readFile(path.join(root,'experience.json'),'utf8'));
const worldsOnly=process.argv.includes('--update-worlds');
await fs.mkdir(output,{recursive:true});
for(const name of Object.keys(experiences.worlds)){
 const {width,height}=await sharp(path.join(root,'assets',name)).metadata();
 if(width!==4096||height!==2048)throw new Error(`${name}: expected a 4096 × 2048 panorama.`);
}

async function updateWorlds(db){
 const books=await db.book.findMany({where:{title:experiences.book.title,ownerId:null},select:{id:true,targets:true}});
 if(books.length!==1)throw new Error('Expected one installed Sarra book. Install the book or resolve duplicate copies first.');
 const book=books[0];
 const updates=experiences.arPages.filter(exp=>exp.world).map(exp=>{
  const target=book.targets.find(t=>t.order===exp.page-1&&t.name===manifest.pages[exp.page-1].title);
  if(!target?.ar||target.targetIndex===null)throw new Error(`Sarra page ${exp.page} must be compiled as an AR target first.`);
  return {id:target.id,data:{worldUrl:`${url}/${exp.world}`,worldEffect:exp.effect,scanAction:exp.scanAction}};
 });
 for(const name of Object.keys(experiences.worlds))await fs.copyFile(path.join(root,'assets',name),path.join(output,name));
 await db.$transaction(updates.map(({id,data})=>db.target.update({where:{id},data})));
 console.log(`Updated ${updates.length} story worlds in Sarra (${book.id}).`);
}

const db=new PrismaClient();
if(worldsOnly){
 try{await updateWorlds(db);}finally{await db.$disconnect();}
}else{
for(const name of await fs.readdir(path.join(root,'assets'))){if(/\.(jpg|glb|mind)$/.test(name))await fs.copyFile(path.join(root,'assets',name),path.join(output,name));}
const report=JSON.parse(await fs.readFile(path.join(root,'assets','compile-report.json'),'utf8'));
if(report.length!==experiences.arPages.length)throw new Error('Compile all final AR pages before installing.');
try{
 const prior=await fs.readFile(path.join(root,'installed.json'),'utf8').then(JSON.parse).catch(()=>null);
 if(prior)throw new Error(`Already installed as ${prior.id}; edit that draft in the studio instead of creating a duplicate.`);
 const subject=await db.subject.findUniqueOrThrow({where:{slug:'animals'}});
 const book=await db.$transaction(async tx=>{
  const book=await tx.book.create({data:{title:experiences.book.title,description:experiences.book.description,gradeLevel:experiences.book.gradeLevel,format:'SKETCH',subjectId:subject.id,published:false,coverUrl:`${url}/page-01.jpg`}});
  const targets=[];
  for(const [index,page] of manifest.pages.entries()){
   const file=`page-${String(index+1).padStart(2,'0')}.jpg`;
   const {width,height}=await sharp(path.join(output,file)).metadata();
   const experience=experiences.arPages.find(p=>p.page===index+1);
   const target=await tx.target.create({data:{bookId:book.id,name:page.title,description:page.story,translations:page.translations,textPosition:page.textPosition,imageUrl:`${url}/${file}`,width,height,order:index,ar:page.ar,scanAction:experience?.scanAction??'ar',worldUrl:experience?.world?`${url}/${experience.world}`:null,worldEffect:'none',targetIndex:page.ar?targets.filter(t=>t.ar).length:null}});
   targets.push(target);
   if(experience?.model){const animal=experience.model.replace('.glb','');await tx.content.create({data:{targetId:target.id,type:'MODEL',name:animal==='lion'?'The little brave lion':animal==='bird'?'A voice of your own':'One small brave tortoise',url:`${url}/${animal}.glb`,rotX:90,scale:0.62,autoplay:true,loop:true,order:0}});}
  }
  const ar=targets.filter(t=>t.ar);
  const signature=createHash('sha1').update(ar.map(t=>`${t.id}:${t.imageUrl}`).sort().join('|')).digest('hex');
  return tx.book.update({where:{id:book.id},data:{mindUrl:`${url}/sarra.mind`,mindHash:signature,compiledAt:new Date()},include:{targets:true}});
 },{timeout:30000});
 const result={id:book.id,title:book.title,published:book.published,pages:book.targets.length,arPages:book.targets.filter(t=>t.ar).length,worldPages:book.targets.filter(t=>t.worldUrl).map(t=>({id:t.id,title:t.name})),studio:`http://localhost:3000/admin/books/${book.id}`,reader:`http://localhost:3000/read/${book.id}`,print:`http://localhost:3000/print/${book.id}`};
 await fs.writeFile(path.join(root,'installed.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await db.$disconnect();}
}
