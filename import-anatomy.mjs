import fs from 'node:fs';
import path from 'node:path';
import * as T from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
const dir=process.argv[2]||'../anatomy',loader=new OBJLoader(),parts=[];const bounds=new T.Box3();
for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.obj'))){const obj=loader.parse(fs.readFileSync(path.join(dir,name),'utf8'));obj.traverse(m=>{if(m.isMesh){const g=m.geometry;g.computeBoundingBox();bounds.union(g.boundingBox);parts.push({name,g});}});}
console.log('Source bounds',bounds.min.toArray(),bounds.max.toArray());
// Anatomical Z is superior; negative anatomical Y is anterior.
const scale=.0145,center=new T.Vector3(0,1530,125),pivot=new T.Vector3(0,-.44,-.36),head=[],mandible=[];
for(const {name,g} of parts){const jaw=name.includes('Mandible'),p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){const v=new T.Vector3(p.getX(i),p.getZ(i),-p.getY(i)).sub(center).multiplyScalar(scale);if(jaw)v.sub(pivot);const normal=new T.Vector3(n.getX(i),n.getZ(i),-n.getY(i)).normalize();(jaw?mandible:head).push(...v.toArray(),...normal.toArray());}}
for(const [name,values] of [['anatomical-skull',head],['anatomical-jaw',mandible]]){fs.writeFileSync(`dist/assets/${name}.bin`,Buffer.from(new Float32Array(values).buffer));console.log(name,values.length/6,'vertices');}
fs.writeFileSync('dist/assets/anatomy-provenance.json',JSON.stringify({source:'BodyParts3D / Anatomography 4.3',copyright:'The Database Center for Life Science (DBCLS)',license:'CC BY-SA 2.1 Japan',licenseURL:'https://creativecommons.org/licenses/by-sa/2.1/jp/',sourceURL:'https://lifesciencedb.jp/bp3d/',mirror:'https://github.com/olivercase/body_parts_3d_api',parts:parts.map(p=>p.name),modifications:'Selected cranial and facial bones and mandible only; omitted all tooth meshes. Rotated, centred, scaled and converted to interleaved binary position/normal geometry. Runtime materials and audio deformation are artistic modifications. Derived geometry remains CC BY-SA 2.1 Japan.'},null,2));
