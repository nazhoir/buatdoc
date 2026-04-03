import {
  resolveValue,
  resolvePath,
  valueToString,
  isTruthy,
} from '../utils/objectResolver';

describe('objectResolver', () => {
  describe('resolvePath', () => {
    it('resolves a top-level key', () => {
      expect(resolvePath({ nama: 'Alice' }, 'nama')).toBe('Alice');
    });

    it('resolves a nested property via dot notation', () => {
      const data = { user: { name: 'Bob', age: 30 } };
      expect(resolvePath(data, 'user.name')).toBe('Bob');
      expect(resolvePath(data, 'user.age')).toBe(30);
    });

    it('resolves deeply nested properties', () => {
      const data = { a: { b: { c: { d: 'deep' } } } };
      expect(resolvePath(data, 'a.b.c.d')).toBe('deep');
    });

    it('resolves array element by index', () => {
      const data = { items: ['first', 'second', 'third'] };
      expect(resolvePath(data, 'items.0')).toBe('first');
      expect(resolvePath(data, 'items.2')).toBe('third');
    });

    it('resolves nested property inside array element', () => {
      const data = { items: [{ produk: 'Laptop', harga: 10000 }] };
      expect(resolvePath(data, 'items.0.produk')).toBe('Laptop');
      expect(resolvePath(data, 'items.0.harga')).toBe(10000);
    });

    it('returns undefined for missing keys', () => {
      expect(resolvePath({ a: 1 }, 'b')).toBeUndefined();
    });

    it('returns undefined for missing nested keys', () => {
      expect(resolvePath({ a: { b: 1 } }, 'a.c')).toBeUndefined();
    });

    it('returns undefined for null parent', () => {
      const data = { a: null };
      expect(resolvePath(data, 'a.b')).toBeUndefined();
    });

    it('handles empty path by returning the data itself', () => {
      const data = { x: 1 };
      expect(resolvePath(data, '')).toEqual(data);
    });
  });

  describe('resolveValue', () => {
    it('returns value when found', () => {
      expect(resolveValue({ nama: 'Alice' }, 'nama')).toBe('Alice');
    });

    it('returns default value when variable is missing', () => {
      expect(resolveValue({}, 'nama|Guest')).toBe('Guest');
    });

    it('returns default value when variable is null', () => {
      expect(resolveValue({ nama: null }, 'nama|Guest')).toBe('Guest');
    });

    it('returns empty string when missing and no default', () => {
      expect(resolveValue({}, 'nama')).toBe('');
    });

    it('resolves nested path with default', () => {
      expect(resolveValue({}, 'user.name|Anonymous')).toBe('Anonymous');
    });

    it('returns actual value even when default is provided', () => {
      expect(resolveValue({ nama: 'Budi' }, 'nama|Guest')).toBe('Budi');
    });

    it('handles default value with pipe character in default', () => {
      // Only first pipe splits default
      const result = resolveValue({}, 'nama|a|b');
      expect(result).toBe('a|b');
    });
  });

  describe('valueToString', () => {
    it('converts string', () => {
      expect(valueToString('hello')).toBe('hello');
    });

    it('converts number', () => {
      expect(valueToString(42)).toBe('42');
      expect(valueToString(3.14)).toBe('3.14');
    });

    it('converts boolean', () => {
      expect(valueToString(true)).toBe('true');
      expect(valueToString(false)).toBe('false');
    });

    it('returns empty string for null', () => {
      expect(valueToString(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(valueToString(undefined)).toBe('');
    });

    it('returns empty string for objects', () => {
      expect(valueToString({ type: 'image', source: 'x' })).toBe('');
    });

    it('returns empty string for arrays', () => {
      expect(valueToString([1, 2, 3] as unknown as null)).toBe('');
    });
  });

  describe('isTruthy', () => {
    it('returns true for non-empty string', () => {
      expect(isTruthy('hello')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isTruthy('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(isTruthy('   ')).toBe(false);
    });

    it('returns true for truthy boolean', () => {
      expect(isTruthy(true)).toBe(true);
    });

    it('returns false for false boolean', () => {
      expect(isTruthy(false)).toBe(false);
    });

    it('returns true for non-zero number', () => {
      expect(isTruthy(1)).toBe(true);
      expect(isTruthy(-1)).toBe(true);
    });

    it('returns false for zero', () => {
      expect(isTruthy(0)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isTruthy(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isTruthy(undefined)).toBe(false);
    });

    it('returns true for non-empty array', () => {
      expect(isTruthy([1, 2])).toBe(true);
    });

    it('returns false for empty array', () => {
      expect(isTruthy([])).toBe(false);
    });

    it('returns true for non-null object', () => {
      expect(isTruthy({ key: 'val' })).toBe(true);
    });
  });
});
