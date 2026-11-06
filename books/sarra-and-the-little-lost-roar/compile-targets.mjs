// Uses MindAR's own CPU feature and tracking compiler, with Sharp pixels instead of a browser canvas.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import * as tf from '@tensorflow/tfjs';
import { CompilerBase } from 'mind-ar/src/image-target/compiler-base.js';
import { buildTrackingImageList } from 'mind-ar/src/image-target/image-list.js';
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js';
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js';
const root=path.dirname(fileURLToPath(import.meta.url));
class PixelCompiler extends CompilerBase {
 createProcessCanvas(image){return {getContext:()=>({drawImage(){},getImageData:()=>({data:image.data})})};}
 async compileTrack({progressCallback,targetImages,basePercent}){
  return targetImages.map((target,i)=>{
   const images=buildTrackingImageList(target);
   return extractTrackingFeatures(images,index=>progressCallback(basePercent+(i+(index+1)/images.length)*(100-basePercent)/targetImages.length));
  });
 }
}
await tf.setBackend('cpu');await tf.ready();
const manifest=JSON.parse(await fs.readFile(path.join(root,'pages.json'),'utf8'));
const images=[];const sources=[];
for(const [i,page] of manifest.pages.entries()){
 if(!page.ar)continue;
 const name=`page-${String(i+1).padStart(2,'0')}.jpg`;
 sources.push({file:name,sha256:createHash('sha256').update(await fs.readFile(path.join(root,'assets',name))).digest('hex')});
 const {data,info}=await sharp(path.join(root,'assets',name)).resize({width:750,height:1000,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 images.push({data,width:info.width,height:info.height});
}
const compiler=new PixelCompiler();let reported=-10;
await compiler.compileImageTargets(images,p=>{const rounded=Math.floor(p/10)*10;if(rounded>reported){console.log(`Compiling AR targets: ${rounded}%`);reported=rounded;}});
const binary=compiler.exportData();
await fs.writeFile(path.join(root,'assets','sarra.mind'),binary);
const report=compiler.data.map((page,index)=>({...sources[index],target:index,trackingPoints:page.trackingData.reduce((n,level)=>n+level.points.length,0),matchingPoints:page.matchingData.reduce((n,level)=>n+level.maximaPoints.length+level.minimaPoints.length,0)}));
for(const page of report)if(page.trackingPoints<20||page.matchingPoints<50)throw new Error(`Target ${page.target} has too few features; choose a richer page.`);
await fs.writeFile(path.join(root,'assets','compile-report.json'),JSON.stringify(report,null,2));
console.log(`Compiled ${images.length} targets (${binary.byteLength} bytes).`,JSON.stringify(report));
