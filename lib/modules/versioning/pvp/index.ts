import { logger } from '../../../logger';
//import { api as semverCoerced } from '../semver-coerced';
import type { VersioningApi } from '../types';
import type { NewValueConfig } from '../types';
import { regEx } from '../../../util/regex';

export const id = 'pvp';
export const displayName = 'Package Versioning Policy (Haskell)';
export const urls = [];
export const supportsRanges = true;

type Parsed = Leaf | Disjunction | Insatisfiable;

export class Insatisfiable {
}

class Disjunction {
  parts: Parsed[];

  constructor(parts: Parsed[]) {
    this.parts = parts;
  }

  get lower(): string {
    let lowest: null | string = null;
    for (const p of this.parts) {
      if (p instanceof Insatisfiable) {
        continue;
      }
      if (lowest === null || isLessThanRange(p.lower, `==${lowest}`)) {
        lowest = p.lower;
      }
    }
    if (lowest === null) {
      throw new Error("no lower bound");
    }
    return lowest;
  }

  get upper(): string {
    let highest: null | string = null;
    for (const p of this.parts) {
      if (p instanceof Insatisfiable) {
        continue;
      }
      if (highest === null || isGreaterThan(p.upper, highest)) {
        highest = p.upper;
      }
    }
    if (highest === null) {
      throw new Error("no upper bound");
    }
    return highest;
  }
}

class Leaf {
  lower: string;
  upper: string;

  constructor(lower: string, upper: string) {
    this.lower = lower;
    this.upper = upper;
  }
}

export function parse(input: string): Parsed {
  input = input.trim();
  if (input.indexOf("||") !== -1) {
    const s: string[] = input.split("||");
    const parts = [];
    for (const part of s) {
      parts.push(parse(part));
    }
    return new Disjunction(parts);
  }
  if (input.startsWith("^>=") && input.indexOf("&&") === -1) {
    const lower = input.slice(3).trim();
    const majorCompos = getMajorComponents(lower);
    if (majorCompos === null) {
      throw new Error("couldn't get major components");
    }
    const {majorPlusOne} = majorCompos;
    const upper = majorPlusOne;
    return new Leaf(lower, upper);
  }
  if (input.startsWith("==") && input.indexOf("&&")) {
    const ver = input.slice(2);
    return new Leaf(ver, ver);
  }
  if (input === '<0' || input === '-none') {
    return new Insatisfiable();
  }
  if (input.indexOf("&&") === -1) {
    throw new Error(`expected range but got: ${input}`);
  }

  const s = input.split("&&");
  s[0] = s[0].trim();
  s[1] = s[1].trim();

  if (s[0].slice(0,2) !== ">=") throw new Error("expected >=");
  if (s[1].slice(0,1) !== "<") throw new Error("expected <");

  {
  const lower = s[0].trim().slice(2).trim();
  const upper = s[1].trim().slice(1).trim();
  return new Leaf(lower, upper);
  }
}

export function extractAllComponents(version: string): number[] {
  let versionMajor = version.split(".");
  const versionIntMajor: number[] = versionMajor.map(x => parseInt(x, 10));
  let ret = [];
  for (let l of versionIntMajor) {
    if (isNaN(l) || l < 0 || !isFinite(l)) {
      continue;
    }
    ret.push(l);
  }
  return ret;
}

function gtIntArray(versionIntMajor: number[], otherIntMajor: number[]) {
  let i = 0;
  for (; i < Math.max(versionIntMajor.length, otherIntMajor.length); i++) {
    // indices that are out of bounds are treated as 0, which is desired
    if (versionIntMajor[i] > otherIntMajor[i]) {
      return true;
    }
    if (versionIntMajor[i] < otherIntMajor[i]) {
      return false;
    }
  }
  if (versionIntMajor.length > otherIntMajor.length) {
    return true;
  }
  return false;
}

function isGreaterThan(version: string, other: string): boolean {
  const versionIntMajor = extractAllComponents(version);
  const otherIntMajor = extractAllComponents(other);
  return gtIntArray(versionIntMajor, otherIntMajor);
}


function getMajor(version: string): number {
  // This basically can't be implemented correctly, since
  // 1.1 and 1.10 become equal when converted to float.
  // Consumers should use isSame instead.
  const l1 = version.split('.');
  return Number(l1.slice(0,2).join("."));
}

function getMinor(version: string): number | null {
  const l1 = version.split('.');
  if (l1.length < 3) {
    return null;
  }
  return Number(l1[2]);
}

function getPatch(version: string): number | null {
  const l1 = version.split('.');
  let components = l1.slice(3);
  if (components.length === 0) {
    return null;
  }
  return Number(components[0] + '.' + components.slice(1).join(""));
}

function matches(version: string, range: string): boolean {
  let parsed = parse(range);
  if (parsed instanceof Insatisfiable) {
    return false;
  }
  if (isGreaterThan(version, parsed.upper)) {
    return false;
  }
  if (getMajor(version) === getMajor(parsed.upper)) {
    // since the range uses < (exclusive) on the upper end, equal major
    // versions means it's not a match. patch versions not supported
    // on this end.
    return false;
  }
  if (isGreaterThan(parsed.lower, version)) {
    return false;
  }
  return true;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  let copy = versions.slice(0);
  copy.sort((a,b) => isGreaterThan(a,b) ? -1 : 1);
  for (let c of copy) {
    if (matches(c, range)) {
      return c;
    }
  }
  return null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  let copy = versions.slice(0);
  copy.sort((a,b) => isGreaterThan(a,b) ? 1 : -1);
  for (let c of copy) {
    if (matches(c, range)) {
      return c;
    }
  }
  return null;
}

function isLessThanRange(version: string, range: string): boolean {
  let parsed = parse(range);
  if (parsed instanceof Insatisfiable) {
    return false;
  }
  const verCompos = extractAllComponents(version);
  const lowerCompos = extractAllComponents(parsed.lower);
  for (let i=0; i<Math.min(verCompos.length, lowerCompos.length); i++) {
    if (verCompos[i] !== lowerCompos[i]) {
      return !gtIntArray(verCompos, lowerCompos);
    }
  }
  return verCompos.length < lowerCompos.length;
}

export function getMajorComponents(splitOne: string): {currentMajor: string, majorPlusOne: string} | null {
    const r = regEx(/(?<majorOne>\d+)\.(?<majorTwo>\d+)/);
    const m = r.exec(splitOne);
    if (!m?.groups) {
      const oneSingleComponent = parseInt(splitOne, 10);
      if (!Number.isFinite(oneSingleComponent)) {
        return null;
      } else {
        return {
          currentMajor: String(oneSingleComponent),
          majorPlusOne: String(oneSingleComponent+1),
        };
      }
    }

    const currentMajor = m.groups['majorOne'] + "." + (parseInt(m.groups['majorTwo'],10)).toFixed(0);
    const majorPlusOne = m.groups['majorOne'] + "." + (parseInt(m.groups['majorTwo'],10) + 1).toFixed(0);
    return {currentMajor, majorPlusOne};
}

function getNewValue({
  currentValue,
  newVersion,
  rangeStrategy,
}: NewValueConfig): string | null {
  logger.info({currentValue, newVersion}, 'pvp/getNewValue');
  switch (rangeStrategy) {
    case 'pin':
      return `==${newVersion}`;
      break;
    case 'widen':
    case 'auto':
      {
        const parsed = parse(currentValue);
        if (parsed instanceof Insatisfiable) {
          return `^>=${newVersion}`;
        }
        const majorCompos = getMajorComponents(newVersion);
        if (majorCompos === null) {
          logger.warn({currentValue, newVersion, majorCompos}, 'did not find two major parts');
          return `^>=${newVersion}`;
        }
        let {currentMajor, majorPlusOne} = majorCompos;
        if (matches(newVersion, '>=0 && <' + currentMajor)) {
          // the upper bound is already high enough
          return currentValue;
        } else if (matches(newVersion, '>=0 && <' + majorPlusOne)) {
          const res = `>=${parsed.lower} && <${majorPlusOne}`;
          logger.info({res}, 'pvp/getNewValue result');
          return res;
        } else {
          throw new Error("Even though the major bound was bumped, the newVersion still isn't accepted. Maybe bounds are ancient?");
        }
        break;
      }
    case 'bump':
      if
        (  currentValue.startsWith("^>=")
        && currentValue.indexOf("||") === -1
        && currentValue.indexOf("&&") === -1) {
        return `^>=${newVersion}`;
      } else {
        throw new Error("Bump can't handle this range");
      }
      break;
    case 'replace':
      if (matches(newVersion, currentValue)) {
        return null;
      } else {
        const majorCompos = getMajorComponents(newVersion);
        if (majorCompos === null) {
          logger.warn({currentValue, newVersion, majorCompos}, 'did not find two major parts');
          return `^>=${newVersion}`;
        }
        let {currentMajor} = majorCompos;
        return `^>=${currentMajor}`;
      }
    case 'future':
    case 'update-lockfile':
    case 'in-range-only':
      throw new Error(`PVP can't handle rangeStrategy=${rangeStrategy}. Try 'widen' or 'bump'.`);
    default:
      rangeStrategy satisfies never;
      throw new Error("type check should have failed");
  }
}

function isSame(type: 'major'|'minor'|'patch', a: string, b: string) {
  if (type === 'major') {
    const aComponents = getMajorComponents(a);
    const bComponents = getMajorComponents(b);
    if (aComponents === null || bComponents === null) {
      return false;
    }
    return aComponents.currentMajor === bComponents.currentMajor;
  } else if (type === 'minor') {
    return getMinor(a) === getMinor(b);
  } else {
    return getPatch(a) === getPatch(b);
  }
}

export const api: VersioningApi = {
  isValid: (ver) => extractAllComponents(ver).length >= 1,
  isVersion: () => true,
  isStable: () => true,
  isCompatible: () => true,
  getMajor,
  getMinor,
  getPatch,
  isSingleVersion: e => e.indexOf("&&") === -1,
  sortVersions: (a,b) => isGreaterThan(a, b) ? 1 : -1,
  equals: (a,b) => a === b,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isLessThanRange,
  isGreaterThan,
  getNewValue,
  isSame,
};
export default api;
