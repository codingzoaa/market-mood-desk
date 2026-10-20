import {clamp,finish,prerequisites} from './common.ts';
import {priceStructure,sectorStrength} from './features.ts';
import {relativeStrength,rsFactor} from './relative-strength.ts';
import {relativeVolume} from './relative-volume.ts';
import {persistence} from './persistence.ts';
import type {AnalysisInput} from './types.ts';
export function stockIntraday(input:AnalysisInput){const {missing}=prerequisites(input,'INTRADAY'),volume=relativeVolume(input,'INTRADAY');return finish(input,'INTRADAY',{rs:rsFactor(relativeStrength(input)),rvol:volume===null?null:clamp(volume/3),structure:priceStructure(input,'INTRADAY'),persistence:persistence(input),sector:sectorStrength(input,'INTRADAY')},missing);}
