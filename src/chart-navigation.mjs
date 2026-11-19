export function navigateRange(start=0,end=100,command){
 start=Math.max(0,Math.min(100,Number(start)||0));end=Math.max(start,Math.min(100,Number(end)||100));
 const span=Math.max(.1,end-start),middle=(start+end)/2;
 if(command==='reset')return {start:0,end:100};
 let size=command==='in'?Math.max(.5,span*.65):command==='out'?Math.min(100,span/ .65):span;
 let left=command==='left'?start-span*.25:command==='right'?start+span*.25:middle-size/2;
 left=Math.max(0,Math.min(100-size,left));return {start:left,end:left+size};
}
export function navigateChart(chart,command){
 if(!chart)return;const zoom=chart.getOption().dataZoom?.[0]||{};
 chart.dispatchAction({type:'dataZoom',...navigateRange(zoom.start,zoom.end,command)});
}
