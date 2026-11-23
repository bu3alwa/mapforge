import { caveGenerator } from './cave';
import { cityGenerator } from './city';
import { dungeonGenerator } from './dungeon';
import { forestGenerator } from './forest';
import { islandGenerator } from './island';
import { volcanoGenerator } from './volcano';
export type { Generator, Params, ParamDef } from './common';

export const GENERATORS = [
  dungeonGenerator,
  caveGenerator,
  cityGenerator,
  forestGenerator,
  islandGenerator,
  volcanoGenerator,
];
