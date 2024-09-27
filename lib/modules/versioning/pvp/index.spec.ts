import pvp from '.';
import {Insatisfiable, getMajorComponents, extractAllComponents, parse} from '.';
import npm from '../npm';

describe('modules/versioning/pvp/index', () => {
  describe('.isGreaterThan(version, other)', () => {
    it('should return true', () => {
      expect(pvp.isGreaterThan('1.23.1', '1.9.6')).toBeTrue();
      expect(pvp.isGreaterThan('4.0.0', '3.0.0')).toBeTrue();
      expect(pvp.isGreaterThan('3.0.1', '3.0.0')).toBeTrue();
      expect(pvp.isGreaterThan('4.10', '4.1')).toBeTrue();
      expect(pvp.isGreaterThan('1.0.0', '1.0')).toBeTrue();
    });

    it('should return false', () => {
      expect(pvp.isGreaterThan('2.0.2', '3.1.0')).toBeFalse(); // less
      expect(pvp.isGreaterThan('3.0.0', '3.0.0')).toBeFalse(); // equal
      expect(pvp.isGreaterThan('4.1', '4.10')).toBeFalse();
      expect(pvp.isGreaterThan('1.0', '1.0.0')).toBeFalse();
    });
  });

  describe('.parse(version)', () => {
    it('>=1.0 && <1.1', () => {
      const parsed = parse(">=1.0 && <1.1");
      if (parsed instanceof Insatisfiable) {
        expect(true).toBe(false);
      } else {
        expect(parsed.lower).toEqual("1.0");
        expect(parsed.upper).toEqual("1.1");
      }
    });
    it('^>=1.0 || ^>=1.1', () => {
      const parsed = parse("^>=1.0 || ^>=1.1");
      if (parsed instanceof Insatisfiable) {
        expect(true).toBe(false);
      } else {
        expect(parsed.lower).toEqual("1.0");
        expect(parsed.upper).toEqual("1.2");
      }
    });
    it('^>=1.2.3', () => {
      const parsed = parse("^>=1.2.3");
      if (parsed instanceof Insatisfiable) {
        expect(true).toBe(false);
      } else {
        expect(parsed.lower).toEqual("1.2.3");
      }
    });
    it('^>=1.0', () => {
      const parsed = parse("^>=1.0");
      if (parsed instanceof Insatisfiable) {
        expect(true).toBe(false);
      } else {
        expect(parsed.lower).toEqual("1.0");
        expect(parsed.upper).toEqual("1.1");
      }
    });
  });

  describe('.getMajor(version)', () => {
    it('1.0.0, 1.0.1', () => {
      expect(pvp.getMajor("1.0.0")).toEqual(1.0);
      expect(pvp.getMajor("1.0.1")).toEqual(1.0);
      expect(pvp.getMajor("1.1.1")).toEqual(1.1);
      expect(npm.getMajor("1.0.0")).toEqual(1);
      expect(npm.getMajor("1.1.1")).toEqual(1); // Note how this differs from NPM
    });
  });

  describe('.getMinor(version)', () => {
    it('1.0.0, 1.0.1', () => {
      expect(pvp.getMinor("1.0")).toBeNull();
      expect(pvp.getMinor("1.0.0")).toEqual(0);
      expect(pvp.getMinor("1.0.1")).toEqual(1);
      expect(pvp.getMinor("1.1.2")).toEqual(2);
      expect(npm.getMinor("1.0.0")).toEqual(0);
      expect(npm.getMinor("1.1.2")).toEqual(1); // Note how this differs from NPM
    });
  });

  describe('.getPatch(version)', () => {
    it('1.0.0, 1.0.1', () => {
      expect(pvp.getPatch("1.0.0")).toBeNull();
      expect(pvp.getPatch("1.0.0.5.1")).toEqual(5.1);
      expect(pvp.getPatch("1.0.1.6")).toEqual(6);
      expect(pvp.getPatch("1.1.2.7")).toEqual(7);
      expect(npm.isValid("1.0.0.5.1")).toBeFalse(); // Note how this differs from NPM
      expect(npm.isValid("1.1.2.7")).toBeFalse(); // Note how this differs from NPM
    });
  });

  describe('.matches(version, range)', () => {
    it('should return true when version has same major', () => {
      expect(pvp.matches('1.0.1', '>=1.0 && <1.1')).toBeTrue();
      expect(pvp.matches('1.0.1', '^>=1.0.1')).toBeTrue();
      expect(pvp.matches('6.0.0', '^>=6.0.0')).toBeTrue();
    });

    it('should return false when version has different major', () => {
      expect(pvp.matches('1.0.0', '>=2.0 && <2.1')).toBeFalse();
      expect(pvp.matches('6.0.0', '^>=6.0.1')).toBeFalse();
      expect(pvp.matches('4.16', '<0')).toBeFalse();
      expect(pvp.matches('4.10', '^>=4.1')).toBeFalse();
      expect(pvp.matches('4.1', '^>=4.10')).toBeFalse();
    });
  });

  describe('.getSatisfyingVersion(versions, range)', () => {
    it('should return max satisfying version in range', () => {
      expect(
        pvp.getSatisfyingVersion(
          ['1.0.0', '1.0.4', '1.3.0', '2.0.0'],
          '>=1.0 && <1.1',
        ),
      ).toBe('1.0.4');
      expect(
        npm.getSatisfyingVersion(
          ['1.0.0', '1.0.4', '1.3.0', '2.0.0'],
          '^1.0.0',
        ),
      ).toBe('1.3.0'); // Note how this differs from PVP
    });
  });

  describe('.minSatisfyingVersion(versions, range)', () => {
    it('should return min satisfying version in range', () => {
      expect(
        pvp.minSatisfyingVersion(
          ['0.9', '1.0.0', '1.0.4', '1.3.0', '2.0.0'],
          '>=1.0 && <1.1',
        ),
      ).toBe('1.0.0');
    });
  });

  describe('.isLessThanRange(version, range)', () => {
    it('should return true', () => {
      expect(pvp.isLessThanRange?.('2.0.2', '^>=3.0 || ^>=3.1')).toBeTrue();
      expect(pvp.isLessThanRange?.('2.0.2', '^>=3.0')).toBeTrue();
      expect(pvp.isLessThanRange?.('2.0.2', '>=3.0 && <3.1')).toBeTrue();
      expect(npm.isLessThanRange?.('2.0.2', "^3.0.0")).toBeTrue();
      expect(pvp.isLessThanRange?.('2.0', '^>=2.0.0')).toBeTrue();
    });

    it('should return false', () => {
      expect(pvp.isLessThanRange?.('3.0', '>=3.0 && <3.1')).toBeFalse();
      expect(pvp.isLessThanRange?.('4.0.0', '^>=3.0 || ^>=3.1')).toBeFalse();
      expect(pvp.isLessThanRange?.('4.0.0', '^>=3.0')).toBeFalse();
      expect(pvp.isLessThanRange?.('4.0.0', '>=3.0 && <3.1')).toBeFalse();
      expect(pvp.isLessThanRange?.('3.1.0', '^>=3.0')).toBeFalse();
      expect(pvp.isLessThanRange?.('3.1.0', '>=3.0 && <3.1')).toBeFalse();
      expect(pvp.isLessThanRange?.('4.1', '^>=4.10')).toBeTrue();
      expect(pvp.isLessThanRange?.('4.10', '^>=4.1')).toBeFalse();
      expect(pvp.isLessThanRange?.('2.0.2', '^>=2.0')).toBeFalse();
      expect(npm.isLessThanRange?.('4.0.0', "^3.0.0")).toBeFalse();
      expect(npm.isLessThanRange?.('3.1.0', '^3.0.0')).toBeFalse();
    });
  });

  describe('.extractAllComponents(version)', () => {
    it('should return false', () => {
      expect(extractAllComponents('')).toEqual([]);
    });
    it('should parse 3.0', () => {
      expect(extractAllComponents('3.0')).toEqual([3,0]);
    });
  });

  describe('.isValid(version)', () => {
    it('should accept four components', () => {
      expect(pvp.isValid('1.0.0.0')).toBeTrue();
    });
    it('should reject zero components', () => {
      expect(pvp.isValid('')).toBeFalse();
    });
  });

  describe('.getNewValue(newValueConfig)', () => {
    it('currentValue: >=1.0 && <1.1, newVersion: 1.1', () => {
      expect(pvp.getNewValue(
        { currentValue: '>=1.0 && <1.1'
        , newVersion: '1.1'
        , rangeStrategy: 'auto'
        })).toEqual('>=1.0 && <1.2');
    });
    it('currentValue: ==1.0, newVersion: 1.1, rangeStrategy: pin', () => {
      expect(pvp.getNewValue(
        { currentValue: '==1.0'
        , newVersion: '1.1'
        , rangeStrategy: 'pin'
        })).toEqual('==1.1');
    });
    it('currentValue: ==1.0, newVersion: 1.1, rangeStrategy: widen', () => {
      expect(pvp.getNewValue(
        { currentValue: '==1.0'
        , newVersion: '1.1'
        , rangeStrategy: 'widen'
        })).toEqual('>=1.0 && <1.2');
    });
    it('currentValue: ^>=1.0 || ^>=1.2, newVersion: 1.3, rangeStrategy: widen', () => {
      expect(pvp.getNewValue(
        { currentValue: '^>=1.0 || ^>=1.2'
        , newVersion: '1.3'
        , rangeStrategy: 'widen'
        })).toEqual('>=1.0 && <1.4'); // TODO questionable since 1.1 is now included
    });
    it('currentValue: ^>=1.0.0, newVersion: 1.0.1, rangeStrategy: bump', () => {
      expect(pvp.getNewValue(
        { currentValue: '^>=1.0.0'
        , newVersion: '1.0.1'
        , rangeStrategy: 'bump'
        })).toEqual('^>=1.0.1');
    });
    it('currentValue: ==1.0, newVersion: 1.2.3, rangeStrategy: replace', () => {
      expect(pvp.getNewValue(
        { currentValue: '==1.0'
        , newVersion: '1.2.3'
        , rangeStrategy: 'replace'
        })).toEqual('^>=1.2');
    });
    // replace shouldn't modify the range if not necessary
    it('currentValue: >=1.2 && <1.3, newVersion: 1.2.3, rangeStrategy: replace', () => {
      expect(pvp.getNewValue(
        { currentValue: '>=1.2 && <1.3'
        , newVersion: '1.2.3'
        , rangeStrategy: 'replace'
        })).toBeNull();
    });
  });

  describe('.getMajorComponents()', () => {
    it('"0" is valid major version', () => {
      expect(getMajorComponents("0")).toEqual({currentMajor: "0", majorPlusOne: "1"});
    });
  });

  describe('.isSame()', () => {
    it('major', () => {
      expect(pvp.isSame?.('major', "4.10", "4.1")).toEqual(false);
      expect(pvp.isSame?.('major', "4.1.0", "5.1.0")).toEqual(false);
      expect(pvp.isSame?.('major', "4.1", "5.1")).toEqual(false);
      expect(pvp.isSame?.('major', "0", "1")).toEqual(false);
      expect(pvp.isSame?.('major', "4.1", "4.1.0")).toEqual(true);
      expect(pvp.isSame?.('major', "4.1.1", "4.1.2")).toEqual(true);
      expect(pvp.isSame?.('major', "0", "0")).toEqual(true);
    });
    it('minor', () => {
      expect(pvp.isSame?.('minor', "4.1.0", "5.1.0")).toEqual(true);
      expect(pvp.isSame?.('minor', "4.1", "4.1")).toEqual(true);
      expect(pvp.isSame?.('minor', "4.1", "5.1")).toEqual(true);
      expect(pvp.isSame?.('minor', "4.1.0", "4.1.1")).toEqual(false);
    });
  });
});
