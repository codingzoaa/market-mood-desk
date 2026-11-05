import {clamp,finish,prerequisites} from './common.ts';
import {priceStructure,sectorStrength} from './features.ts';
import {eodRelativeStrength,rsFactor} from './relative-strength.ts';
import {relativeVolume} from './relative-volume.ts';
import {persistence} from './persistence.ts';
import type {AnalysisInput} from './types.ts';
export function stockEod(input:AnalysisInput){const {missing}=prerequisites(input,'EOD'),volume=relativeVolume(input,'EOD');return finish(input,'EOD',{rs:rsFactor(eodRelativeStrength(input)),rvol:volume===null?null:clamp(volume/3),structure:priceStructure(input,'EOD'),persistence:persistence(input),sector:sectorStrength(input,'EOD')},missing);}
