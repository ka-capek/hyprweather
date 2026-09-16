import * as THREE from 'three';
import {lightningPaths} from './lightning-path.js';

export class Lightning {
  constructor(random){
    this.random=random;this.scene=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(0,1,1,0,-1,1);
    this.meshes=[];this.width=1;this.height=1;
    this.material=new THREE.ShaderMaterial({
      uniforms:{pulse:{value:0}},transparent:true,depthTest:false,depthWrite:false,
      blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide,
      vertexShader:`varying vec2 vUv;attribute float strength;varying float vStrength;
        void main(){vUv=uv;vStrength=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 vUv;varying float vStrength;uniform float pulse;
        void main(){float d=abs(vUv.x*2.-1.);
          float core=exp(-d*d*800.);float halo=exp(-d*7.);
          vec3 energy=vec3(19.,21.,25.)*core+vec3(.35,.60,1.)*halo;
          gl_FragColor=vec4(energy*pulse*vStrength,1.-smoothstep(.7,1.,d));}`,
    });
  }
  trigger(){this.paths=lightningPaths(this.random);this.rebuild();return this.paths[0].points[24];}
  resize(width,height){this.width=width;this.height=height;if(this.paths)this.rebuild();}
  rebuild(){
    for(const mesh of this.meshes){this.scene.remove(mesh);mesh.geometry.dispose();}
    this.meshes=[];
    for(const {points,strength} of this.paths){
      const pointCount=points.length;
      const position=new Float32Array(pointCount*2*3);
      const uv=new Float32Array(pointCount*2*2);
      const strengths=new Float32Array(pointCount*2);
      const indices=new Uint16Array((pointCount-1)*6);
      points.forEach((p,i)=>{
        const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
        const dx=(b.x-a.x)*this.width,dy=(b.y-a.y)*this.height;
        const len=Math.hypot(dx,dy)||1,halfWidth=22*(.85+.15*(1-i/(points.length-1)))*Math.sqrt(strength);
        const nx=-dy/len*halfWidth/this.width,ny=dx/len*halfWidth/this.height;
        const vertex=i*6, uvOffset=i*4;
        position[vertex]=p.x+nx; position[vertex+1]=1-p.y-ny; position[vertex+3]=p.x-nx; position[vertex+4]=1-p.y+ny;
        const t=i/(pointCount-1);
        uv[uvOffset+1]=t; uv[uvOffset+2]=1; uv[uvOffset+3]=t;
        strengths[i*2]=strength; strengths[i*2+1]=strength;
        if(i){const index=(i-1)*6;indices[index]=i*2-2; indices[index+1]=i*2-1; indices[index+2]=i*2; indices[index+3]=i*2-1; indices[index+4]=i*2+1; indices[index+5]=i*2;}
      });
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(position,3));
      geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      geometry.setAttribute('strength',new THREE.BufferAttribute(strengths,1));geometry.setIndex(new THREE.BufferAttribute(indices,1));
      const mesh=new THREE.Mesh(geometry,this.material);mesh.frustumCulled=false;this.scene.add(mesh);this.meshes.push(mesh);
    }
  }
  update(pulse){this.material.uniforms.pulse.value=pulse;}
}
