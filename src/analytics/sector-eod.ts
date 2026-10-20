import {clamp,finish,prerequisites} from './common.ts';
import {breadth,leaderParticipation} from './features.ts';
import {eodRelativeStrength,rsFactor} from './relative-strength.ts';
import {relativeVolume} from './relative-volume.ts';
import {persistence} from './persistence.ts';
import type {AnalysisInput} from './types.ts';
export function sectorEod(input:AnalysisInput){const {missing}=prerequisites(input,'EOD'),volume=relativeVolume(input,'EOD');return finish(input,'EOD',{rs:rsFactor(eodRelativeStrength(input)),rvol:volume===null?null:clamp(volume/3),breadth:breadth(input),persistence:persistence(input),leaders:leaderParticipation(input,'EOD')},missing);}
