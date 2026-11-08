import fs from 'node:fs';
// Cluster nearby vertices, retain the anatomical silhouette, then rebuild flat faces.
for(const name of ['skull','jaw']){
 const buf=fs.readFileSync(`dist/assets/anatomical-${name}.bin`),data=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4),cells=new Map(),ids=[],step=name==='skull'?.105:.075;
 for(let i=0;i<data.length;i+=6){let p=[data[i],data[i+1],data[i+2]],key=p.map(v=>Math.round(v/step)).join(',');let c=cells.get(key);if(!c){c={id:cells.size,sum:[0,0,0],count:0};cells.set(key,c);}for(let k=0;k<3;k++)c.sum[k]+=p[k];c.count++;ids.push(c.id);}
 const points=[...cells.values()].map(c=>c.sum.map(v=>v/c.count)),seen=new Set(),out=[];
 for(let i=0;i<ids.length;i+=3){const ix=ids.slice(i,i+3);if(new Set(ix).size<3)continue;const key=[...ix].sort((a,b)=>a-b).join(',');if(seen.has(key))continue;seen.add(key);const [a,b,c]=ix.map(j=>points[j]),ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],len=Math.hypot(...n);if(len<.00001)continue;for(const p of [a,b,c])out.push(...p,...n.map(v=>v/len));}
 fs.writeFileSync(`dist/assets/faceted-${name}.bin`,Buffer.from(new Float32Array(out).buffer));console.log(name,out.length/18,'triangles');
}
