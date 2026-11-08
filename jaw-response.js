const clamp=x=>Math.max(0,Math.min(1,x));
export function jawTarget(energy,mid,flux,power){
 const drive=clamp((energy*.60+mid*.25+flux*.15-.25)/.67);
 const eased=drive*drive*(3-2*drive);
 return .025+1.20*Math.pow(eased,1.6)*clamp(power/1.6);
}
// A scream holds through short gaps instead of closing on each drum hit.
export function advanceJaw(state,target,dt,t){
 let {open,held,holdUntil}=state;
 if(target>held){held=target;holdUntil=t+.65;}
 if(target>.70)holdUntil=Math.max(holdUntil,t+.45);
 if(t>holdUntil)held+=(target-held)*(1-Math.exp(-dt*1.35));
 const demand=Math.max(target,held);
 open+=(demand-open)*(1-Math.exp(-dt*(demand>open?7:2.3)));
 return {open,held,holdUntil};
}
