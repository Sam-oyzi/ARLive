// Original lightweight animal models; no downloaded models or third-party art.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
const root=path.dirname(fileURLToPath(import.meta.url));
class Reader {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onload?.();this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onload?.();this.onloadend?.();});}
}
globalThis.FileReader=Reader;
const mat=c=>new T.MeshStandardMaterial({color:c,roughness:0.95});
const ink=mat('#30261e'),honey=mat('#d8a34d'),cream=mat('#f2d9a5'),mane=mat('#a86b37'),teal=mat('#438c88'),sage=mat('#91a478'),shell=mat('#816548');
function ball(parent,name,color,position,scale){const mesh=new T.Mesh(new T.SphereGeometry(1,24,16),color);mesh.name=name;mesh.position.set(...position);mesh.scale.set(...scale);parent.add(mesh);return mesh;}
function makeLion(){
 const scene=new T.Scene(),body=new T.Group();body.name='Lion';scene.add(body);
 ball(body,'Body',honey,[0,.34,0],[.26,.29,.37]);
 for(const x of [-.16,.16])for(const z of [-.24,.22])ball(body,`Paw${x}${z}`,honey,[x,.095,z],[.105,.095,.14]);
 const head=new T.Group();head.name='LionHead';head.position.set(0,.65,.21);body.add(head);
 ball(head,'Mane',mane,[0,0,0],[.34,.34,.21]);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;ball(head,`ManeCurl${i}`,mane,[Math.cos(a)*.27,Math.sin(a)*.27,-.01],[.105,.11,.13]);}
 ball(head,'Face',honey,[0,.01,.13],[.245,.24,.18]);
 for(const x of [-.22,.22]){ball(head,`Ear${x}`,honey,[x,.22,.03],[.10,.10,.055]);ball(head,`EarInner${x}`,cream,[x,.22,.075],[.055,.06,.015]);ball(head,`Eye${x}`,ink,[x*.43,.06,.29],[.022,.03,.016]);ball(head,`Muzzle${x}`,cream,[x*.23,-.075,.295],[.07,.06,.045]);}
 ball(head,'Nose',ink,[0,-.04,.335],[.035,.025,.019]);
 ball(body,'Scarf',teal,[0,.49,.20],[.255,.06,.25]);
 for(const x of [-.07,.07]){const b=ball(body,`Bow${x}`,teal,[x,.46,.43],[.085,.05,.025]);b.rotation.z=x*4;}
 const tail=new T.Group();tail.name='Tail';tail.position.set(0,.30,-.29);body.add(tail);
 const tailCurve=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.15,.1,-.18),new T.Vector3(.27,.30,-.18)]);
 tail.add(new T.Mesh(new T.TubeGeometry(tailCurve,16,.025,8,false),honey));ball(tail,'TailFluff',mane,[.27,.30,-.18],[.06,.08,.06]);
 const qs=[-.22,.22,-.22].flatMap(a=>new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),a).toArray());
 const clip=new T.AnimationClip('A little brave breath',4,[new T.QuaternionKeyframeTrack('Tail.quaternion',[0,2,4],qs),new T.VectorKeyframeTrack('Lion.scale',[0,2,4],[1,1,1,1.025,1.035,1.025,1,1,1])]);
 return {scene,clip};
}
function makeTortoise(){
 const scene=new T.Scene(),body=new T.Group();body.name='Tortoise';scene.add(body);
 ball(body,'Shell',shell,[0,.23,0],[.38,.25,.45]);
 ball(body,'ShellRim',sage,[0,.12,0],[.40,.075,.46]);
 for(let row=-1;row<=1;row++)for(let col=-1;col<=1;col++){
  const plate=new T.Mesh(new T.CylinderGeometry(.105,.115,.018,6),mat((row+col)%2?'#a1885a':'#b8a16b'));plate.name=`ShellPlate${row}${col}`;
  plate.position.set(col*.18,.23+.25*Math.sqrt(Math.max(.05,1-(col*.18/.38)**2-(row*.22/.45)**2)),row*.22);plate.rotation.z=-col*.28;plate.rotation.x=row*.3;body.add(plate);
 }
 const head=new T.Group();head.name='TortoiseHead';head.position.set(0,.19,.43);body.add(head);
 ball(head,'Head',sage,[0,0,.08],[.13,.13,.17]);
 for(const x of [-.09,.09]){ball(head,`Eye${x}`,ink,[x,.055,.19],[.017,.021,.015]);}
 for(const x of [-.28,.28])for(const z of [-.25,.25])ball(body,`Foot${x}${z}`,sage,[x,.075,z],[.11,.075,.13]);
 ball(body,'Tail',sage,[0,.11,-.46],[.035,.035,.09]);
 const clip=new T.AnimationClip('Small brave steps',4,[new T.VectorKeyframeTrack('TortoiseHead.position',[0,1,2,3,4],[0,.19,.43,0,.205,.46,0,.19,.43,0,.205,.46,0,.19,.43])]);
 return {scene,clip};
}
function makeBird(){
 const scene=new T.Scene(),body=new T.Group();body.name='Bird';scene.add(body);
 const blue=mat('#658fa3'),gold=mat('#d8ad5b');
 ball(body,'Body',blue,[0,.23,0],[.14,.18,.20]);
 ball(body,'Breast',gold,[0,.24,.13],[.105,.13,.075]);
 ball(body,'Head',blue,[0,.43,.10],[.12,.12,.13]);
 for(const x of [-.07,.07])ball(body,`Eye${x}`,ink,[x,.46,.21],[.015,.018,.012]);
 const beak=new T.Mesh(new T.ConeGeometry(.035,.08,12),gold);beak.rotation.x=Math.PI/2;beak.position.set(0,.41,.25);body.add(beak);
 const tracks=[];
 for(const side of [-1,1]){
  const wing=new T.Group();wing.name=side===-1?'LeftWing':'RightWing';wing.position.set(side*.12,.28,0);body.add(wing);
  ball(wing,'Feathers',blue,[side*.08,0,-.03],[.07,.14,.16]);
  const values=[0,side*.6,0].flatMap(a=>new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),a).toArray());
  tracks.push(new T.QuaternionKeyframeTrack(`${wing.name}.quaternion`,[0,.8,1.6],values));
  ball(body,`Foot${side}`,gold,[side*.06,.025,.07],[.03,.025,.065]);
 }
 return {scene,clip:new T.AnimationClip('A little song',1.6,tracks)};
}
for(const [name,create] of [['lion',makeLion],['tortoise',makeTortoise],['bird',makeBird]]){
 const {scene,clip}=create();const result=await new GLTFExporter().parseAsync(scene,{binary:true,animations:[clip]});
 await fs.writeFile(path.join(root,'assets',`${name}.glb`),Buffer.from(result));console.log(`Wrote original ${name} model (${result.byteLength} bytes)`);
}
