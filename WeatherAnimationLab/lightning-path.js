// Coarse bends dominate; fine subdivision adds texture without a sawtooth trunk.
export function lightningPaths(random) {
  function divide(a,b,steps,roughness) {
    let points=[a,b];
    for(let level=0;level<steps;level++){
      const next=[points[0]];
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
        const offset=(random()-.5)*roughness*Math.pow(.55,level);
        next.push({x:(a.x+b.x)/2-dy*offset,y:(a.y+b.y)/2+dx*offset},b);
      }
      points=next;
    }
    return points;
  }
  const lateral=random()<.3;
  const a=lateral?{x:-.06,y:.07+random()*.18}:{x:.15+random()*.7,y:-.06};
  const b=lateral?{x:1.06,y:.42+random()*.32}:{x:.12+random()*.76,y:1.06};
  const trunk=divide(a,b,6,.5);
  const paths=[{points:trunk,strength:1}];
  for(const index of [18,34,47]){
    if(random()<.15)continue;
    const start=trunk[index],side=random()<.5?-1:1;
    const end={x:start.x+side*(.12+random()*.23),y:start.y+.14+random()*.23};
    paths.push({points:divide(start,end,4,.4),strength:.35+random()*.25});
  }
  return paths;
}
export function lightningPulse(age){
  if(age<0 || age>.65)return 0;
  return Math.exp(-age*19)+.72*Math.exp(-Math.pow((age-.13)*35,2))+.34*Math.exp(-Math.pow((age-.27)*25,2));
}
