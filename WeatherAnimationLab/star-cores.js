import * as THREE from 'three';

// Point cores retain pixel-scale detail regardless of the all-sky map's angular
// resolution. Positions/colours come from that same NASA image, so halos align.
export class StarCores {
  constructor(scene, data, skyUniforms) {
    if(data.byteLength % 28 !== 0)throw new Error('Invalid NASA star core data');
    const packed=new THREE.InterleavedBuffer(new Float32Array(data),7);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(packed,3,0));
    geometry.setAttribute('strength',new THREE.InterleavedBufferAttribute(packed,1,3));
    geometry.setAttribute('starColor',new THREE.InterleavedBufferAttribute(packed,3,4));
    const material=new THREE.ShaderMaterial({
      uniforms:{time:skyUniforms.time,night:skyUniforms.night,sidereal:skyUniforms.sidereal,
        moonDirection:skyUniforms.moonDirection,moonRadius:skyUniforms.moonRadius,moonAmount:skyUniforms.moonAmount,
        pixelRatio:{value:1}},
      vertexShader:`
        attribute float strength;
        attribute vec3 starColor;
        uniform float time, night, sidereal, pixelRatio, moonRadius, moonAmount;
        uniform vec3 moonDirection;
        varying vec3 vColor;
        void main(){
          float c=cos(sidereal),s=sin(sidereal);
          vec3 direction=vec3(c*position.x+s*position.y,-s*position.x+c*position.y,position.z);
          vec3 viewDirection=mat3(viewMatrix)*direction;
          gl_Position=projectionMatrix*vec4(viewDirection,0.);
          gl_Position.z=gl_Position.w*.99999;
          if(viewDirection.z>=0. || (moonAmount>.01 && length(direction-moonDirection)<moonRadius))
            gl_Position=vec4(2.,2.,2.,1.);
          float seed=fract(sin(dot(position,vec3(127.1,311.7,74.7)))*43758.5453);
          float selected=step(.77,seed);
          float shimmer=sin(time*(.85+seed*.65)+seed*91.)*sin(time*.37+seed*37.);
          float twinkle=1.+selected*(.18+strength*.16)*shimmer;
          vColor=starColor*(.45+strength*2.1)*night*twinkle;
          gl_PointSize=(3.3+strength*2.1)*pixelRatio;
        }`,
      fragmentShader:`
        varying vec3 vColor;
        void main(){
          float r2=dot(gl_PointCoord-.5,gl_PointCoord-.5);
          float core=exp(-r2*42.);
          float halo=exp(-r2*13.)*.065;
          gl_FragColor=vec4(vColor*(core+halo),1.);
        }`,
      transparent:true,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,toneMapped:false,
    });
    this.mesh=new THREE.Points(geometry,material);
    this.mesh.frustumCulled=false;
    this.mesh.renderOrder=3;
    this.mesh.onBeforeRender=renderer=>{material.uniforms.pixelRatio.value=renderer.getPixelRatio();};
    scene.add(this.mesh);
  }
  update(night){this.mesh.visible=night>.001;}
}
