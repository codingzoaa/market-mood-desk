export default function ChartControls({onCommand}:{onCommand:(command:string)=>void}){
 return <div className="chart-controls" role="group" aria-label="차트 범위 조절">{[['in','확대'],['out','축소'],['left','이전 구간'],['right','다음 구간'],['reset','전체 구간']].map(([command,label])=><button type="button" key={command} onClick={()=>onCommand(command)}>{label}</button>)}<span>휠 확대·축소 · 드래그 이동 · Y축 자동 맞춤</span></div>;
}
