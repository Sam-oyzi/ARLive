import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(root,'pages.json'),'utf8'));
await fs.mkdir(path.join(root,'assets'),{recursive:true});
let prepared=0;
for(const [index,page] of manifest.pages.entries()){
 if(process.argv.includes('--available')&&!(await fs.access(path.join(root,page.file)).then(()=>true).catch(()=>false)))continue;
 let image=sharp(path.join(root,page.file));
 if(page.side){const {width,height}=await image.metadata();const half=Math.floor(width/2);image=image.extract({left:page.side==='left'?0:width-half,top:0,width:half,height});}
 else image=image.resize(1200,1600,{fit:'cover',position:'centre'});
 prepared++;
 await image.jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(path.join(root,'assets',`page-${String(index+1).padStart(2,'0')}.jpg`));
}
for(const name of ['world-forest','world-river']){
 await sharp(path.join(root,`${name}.png`)).resize(4096,2048,{fit:'fill'}).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toFile(path.join(root,'assets',`${name}.jpg`));
}
await sharp(path.join(root,'cover-fr.png')).resize(1200,1600,{fit:'cover',position:'centre'}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(path.join(root,'assets','fr-page-01.jpg'));
console.log(`Prepared ${prepared} pages, a French cover and two panoramas.`);
