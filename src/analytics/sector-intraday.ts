import {clamp,finish,prerequisites} from './common.ts';
import {breadth,leaderParticipation} from './features.ts';
import {relativeStrength,rsFactor} from './relative-strength.ts';
import {relativeVolume} from './relative-volume.ts';
import {persistence} from './persistence.ts';
import type {AnalysisInput} from './types.ts';
export function sectorIntraday(input:AnalysisInput){const {missing}=prerequisites(input,'INTRADAY'),volume=relativeVolume(input,'INTRADAY');return finish(input,'INTRADAY',{rs:rsFactor(relativeStrength(input)),rvol:volume===null?null:clamp(volume/3),breadth:breadth(input),persistence:persistence(input),leaders:leaderParticipation(input,'INTRADAY')},missing);}
