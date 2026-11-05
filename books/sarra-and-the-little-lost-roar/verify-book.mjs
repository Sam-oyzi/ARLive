import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
const root=path.dirname(fileURLToPath(import.meta.url));
const {pages}=JSON.parse(await fs.readFile(path.join(root,'pages.json'),'utf8'));
const experiences=JSON.parse(await fs.readFile(path.join(root,'experience.json'),'utf8'));
assert.equal(pages.length,21);assert.ok(pages.length-1>=20);
const seen=new Set();
for(const [i,page] of pages.entries()){
 assert.ok(page.title.length<=120&&page.story.length<=1000);
 assert.ok(page.translations.fr.title&&page.translations.fr.story);
 assert.ok(i===0?page.textPosition==='off':page.textPosition==='top');
 const key=`${page.file}:${page.side??'cover'}`;assert.ok(!seen.has(key));seen.add(key);
 const info=await sharp(path.join(root,page.file)).metadata();
 assert.equal(i===0?info.width<info.height:info.width/info.height===1.5,true);
 if(i>0){assert.equal(page.file,`spread-${String(Math.ceil(i/2)).padStart(2,'0')}.png`);assert.equal(page.side,i%2?'left':'right');}
 const target=await sharp(path.join(root,'assets',`page-${String(i+1).padStart(2,'0')}.jpg`)).metadata();
 assert.equal(target.width/target.height,.75);
 assert.equal(page.ar,experiences.arPages.some(exp=>exp.page===i+1));
}
for(const world of ['world-forest.jpg','world-river.jpg']){const info=await sharp(path.join(root,'assets',world)).metadata();assert.equal(info.width,4096);assert.equal(info.height,2048);}
for(const animal of ['lion','tortoise','bird']){const doc=await new NodeIO().read(path.join(root,'assets',`${animal}.glb`));assert.ok(doc.getRoot().listMeshes().length>0);assert.ok(doc.getRoot().listAnimations().length>0);}
assert.equal(experiences.arPages.length,7);
const report=JSON.parse(await fs.readFile(path.join(root,'assets','compile-report.json'),'utf8'));
assert.equal(report.length,7);
for(const target of report){assert.equal(target.sha256,createHash('sha256').update(await fs.readFile(path.join(root,'assets',target.file))).digest('hex'));assert.ok(target.trackingPoints>=20&&target.matchingPoints>=50);}
assert.ok((await fs.stat(path.join(root,'assets','sarra.mind'))).size>10000);
console.log('Verified 21 bilingual pages in order, ten spreads, seven AR pages, three animated original models and two 2:1 story worlds.');
