import { caveGenerator } from './cave';
import { cityGenerator } from './city';
import { dungeonGenerator } from './dungeon';
import { forestGenerator } from './forest';
import { interiorGenerator } from './interior';
import { islandGenerator } from './island';
import { ruinsGenerator } from './ruins';
import { swampGenerator } from './swamp';
import { volcanoGenerator } from './volcano';
export type { Generator, Params, ParamDef } from './common';

export const GENERATORS = [
  dungeonGenerator,
  caveGenerator,
  cityGenerator,
  interiorGenerator,
  forestGenerator,
  swampGenerator,
  islandGenerator,
  volcanoGenerator,
  ruinsGenerator,
];
