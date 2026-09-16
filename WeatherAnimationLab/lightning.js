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
      const position=[],uv=[],strengths=[],indices=[];
      points.forEach((p,i)=>{
        const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
        const dx=(b.x-a.x)*this.width,dy=(b.y-a.y)*this.height;
        const len=Math.hypot(dx,dy)||1,halfWidth=22*(.85+.15*(1-i/(points.length-1)))*Math.sqrt(strength);
        const nx=-dy/len*halfWidth/this.width,ny=dx/len*halfWidth/this.height;
        position.push(p.x+nx,1-p.y-ny,0,p.x-nx,1-p.y+ny,0);
        uv.push(0,i/(points.length-1),1,i/(points.length-1));
        strengths.push(strength,strength);
        if(i)indices.push(i*2-2,i*2-1,i*2,i*2-1,i*2+1,i*2);
      });
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      geometry.setAttribute('strength',new THREE.Float32BufferAttribute(strengths,1));geometry.setIndex(indices);
      const mesh=new THREE.Mesh(geometry,this.material);mesh.frustumCulled=false;this.scene.add(mesh);this.meshes.push(mesh);
    }
  }
  update(pulse){this.material.uniforms.pulse.value=pulse;}
}
