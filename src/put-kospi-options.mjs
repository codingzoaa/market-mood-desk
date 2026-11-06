import {periodStartIndex,visiblePriceBounds} from './kospi-pension-signal-data.mjs';
export const putSeriesNames={individual:'개인 풋 순매수',foreign:'외국인 풋 순매수'};
export function putVisibleBounds(points,start=0,end=100,selected={}){
 if(!points.length)return {price:[0,1],flow:[-1,1]};
 const first=Math.floor(Math.max(0,Math.min(100,start))/100*(points.length-1)),last=Math.max(first,Math.ceil(Math.max(0,Math.min(100,end))/100*(points.length-1)));
 const price=visiblePriceBounds(points.map(p=>({close:p.kospi})),first,last);
 let max=1;for(const p of points.slice(first,last+1))for(const key of ['individual','foreign'])if(selected[putSeriesNames[key]]!==false)max=Math.max(max,Math.abs(p[key]));
 return {price,flow:[-Math.ceil(max*1.12),Math.ceil(max*1.12)]};
}
export const putShadeMatch=p=>Number.isFinite(p?.individual)&&Number.isFinite(p?.foreign)&&p.individual>=50&&p.foreign<=-50;
export function putShadeBands(points){const bands=[];let start=null;for(let i=0;i<=points.length;i++){if(i<points.length&&putShadeMatch(points[i])){if(start===null)start=i;}else if(start!==null){bands.push([{xAxis:points[start].date},{xAxis:points[i-1].date}]);start=null;}}return bands;}
const fmt=(v,d=2)=>v.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
export function putKospiOption(points,period='5Y',selected={}){
 const first=periodStartIndex(points,period),start=first/Math.max(1,points.length-1)*100,bounds=putVisibleBounds(points,start,100,selected),byDate=new Map(points.map(p=>[p.date,p]));
 const axis={type:'category',boundaryGap:true,data:points.map(p=>p.date),axisLabel:{color:'#697b71',hideOverlap:true},axisLine:{lineStyle:{color:'#c9d5cd'}},axisTick:{show:false,interval:0}};
 const zoom={xAxisIndex:[0,1],filterMode:'none',start,end:100,minValueSpan:Math.min(5,Math.max(0,points.length-1))};
 return {
  animation:false,color:['#2e7860','#df8250','#3275d6'],
  textStyle:{fontFamily:'inherit'},
  grid:[{top:66,left:70,right:26,height:'38%'},{top:'60%',left:70,right:26,bottom:96}],
  legend:{data:['코스피 종가',putSeriesNames.individual,putSeriesNames.foreign],top:8,left:16,itemWidth:17,itemHeight:10,textStyle:{color:'#52645c',fontSize:12},selected},
  axisPointer:{link:[{xAxisIndex:[0,1]}],label:{backgroundColor:'#52645c'}},
  tooltip:{trigger:'axis',confine:true,backgroundColor:'rgba(255,255,255,0.97)',borderColor:'#d9e4dc',textStyle:{color:'#213f34',fontSize:12},axisPointer:{type:'cross'},formatter:params=>{
   const list=Array.isArray(params)?params:[],date=String(list[0]?.axisValue||''),p=byDate.get(date);if(!p)return '';
   return '<b>'+p.date+'</b><br/>코스피 '+fmt(p.kospi)+'P ('+(p.changePct>=0?'+':'')+fmt(p.changePct)+'%)<br/>개인 풋 '+(p.individual>0?'+':'')+fmt(p.individual,0)+'억원<br/>외국인 풋 '+(p.foreign>0?'+':'')+fmt(p.foreign,0)+'억원'+(putShadeMatch(p)?'<br/><b style="color:#bd5546">음영 조건 충족</b>':'');
  }},
  toolbox:{right:12,top:31,feature:{dataZoom:{yAxisIndex:'none',xAxisIndex:[0,1],title:{zoom:'드래그 영역 확대',back:'이전 확대'}}}},
  xAxis:[{...axis,gridIndex:0,axisLabel:{show:false}},{...axis,gridIndex:1}],
  yAxis:[{type:'value',name:'KOSPI (P)',scale:true,min:bounds.price[0],max:bounds.price[1],axisLabel:{color:'#64776d',fontSize:11},nameTextStyle:{color:'#52645c'},splitLine:{lineStyle:{color:'#edf1ed'}}},
   {type:'value',gridIndex:1,name:'풋 순매수 (억원)',min:bounds.flow[0],max:bounds.flow[1],splitNumber:3,axisLabel:{color:'#64776d',fontSize:11},nameTextStyle:{color:'#52645c'},splitLine:{lineStyle:{color:'#edf1ed'}}}],
  dataZoom:[{...zoom,type:'inside',zoomOnMouseWheel:true,moveOnMouseMove:true,moveOnMouseWheel:false},
   {...zoom,type:'slider',height:27,bottom:17,showDetail:true,brushSelect:true,borderColor:'#d1ded5',fillerColor:'rgba(43,123,82,0.16)',handleStyle:{color:'#277452',borderColor:'#277452'}}],
  series:[{name:'코스피 종가',type:'line',xAxisIndex:0,yAxisIndex:0,data:points.map(p=>p.kospi),showSymbol:false,sampling:'lttb',lineStyle:{width:1.7,color:'#2e7860'},z:3},
   {name:putSeriesNames.individual,type:'bar',xAxisIndex:1,yAxisIndex:1,data:points.map(p=>p.individual),barMaxWidth:12,itemStyle:{color:'#df8250'}},
   {name:putSeriesNames.foreign,type:'bar',xAxisIndex:1,yAxisIndex:1,data:points.map(p=>p.foreign),barMaxWidth:12,itemStyle:{color:'#3275d6'}},
   {name:'풋 수급 조건 음영',type:'bar',xAxisIndex:0,yAxisIndex:0,data:points.map(p=>p.kospi),barWidth:'100%',silent:true,tooltip:{show:false},itemStyle:{opacity:0},emphasis:{disabled:true},z:0,markArea:{silent:true,label:{show:false},itemStyle:{color:'rgba(228,93,75,0.18)',borderWidth:0},data:putShadeBands(points)}}]
 };
}
