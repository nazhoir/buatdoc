import {
  parseModifier,
  applyModifier,
  toUpper,
  toLower,
  toCapitalizeEachWord,
  toToggleCase,
  toSentenceCase,
} from '../utils/textTransform';

describe('textTransform', () => {
  describe('parseModifier', () => {
    it('detects _upper suffix', () => {
      const result = parseModifier('nama_upper');
      expect(result.cleanName).toBe('nama');
      expect(result.modifier).toBe('_upper');
    });

    it('detects _lower suffix', () => {
      const result = parseModifier('nama_lower');
      expect(result.cleanName).toBe('nama');
      expect(result.modifier).toBe('_lower');
    });

    it('detects _capitalize_each_word suffix', () => {
      const result = parseModifier('judul_capitalize_each_word');
      expect(result.cleanName).toBe('judul');
      expect(result.modifier).toBe('_capitalize_each_word');
    });

    it('detects _toggle_case suffix', () => {
      const result = parseModifier('nama_toggle_case');
      expect(result.cleanName).toBe('nama');
      expect(result.modifier).toBe('_toggle_case');
    });

    it('detects _sentence_case suffix', () => {
      const result = parseModifier('nama_sentence_case');
      expect(result.cleanName).toBe('nama');
      expect(result.modifier).toBe('_sentence_case');
    });

    it('returns null modifier for unknown suffix', () => {
      const result = parseModifier('nama_unknown');
      expect(result.cleanName).toBe('nama_unknown');
      expect(result.modifier).toBeNull();
    });

    it('returns null modifier for plain variable', () => {
      const result = parseModifier('nama');
      expect(result.cleanName).toBe('nama');
      expect(result.modifier).toBeNull();
    });

    it('handles variable name that is itself a modifier word', () => {
      const result = parseModifier('upper_lower');
      expect(result.cleanName).toBe('upper');
      expect(result.modifier).toBe('_lower');
    });
  });

  describe('applyModifier', () => {
    it('returns text unchanged when modifier is null', () => {
      expect(applyModifier('Hello World', null)).toBe('Hello World');
    });
  });

  describe('toUpper', () => {
    it('converts text to uppercase', () => {
      expect(toUpper('andika putra')).toBe('ANDIKA PUTRA');
    });

    it('handles already uppercase', () => {
      expect(toUpper('HELLO')).toBe('HELLO');
    });

    it('handles empty string', () => {
      expect(toUpper('')).toBe('');
    });

    it('handles mixed case', () => {
      expect(toUpper('hElLo WoRlD')).toBe('HELLO WORLD');
    });
  });

  describe('toLower', () => {
    it('converts text to lowercase', () => {
      expect(toLower('ANDIKA PUTRA')).toBe('andika putra');
    });

    it('handles already lowercase', () => {
      expect(toLower('hello')).toBe('hello');
    });

    it('handles mixed case', () => {
      expect(toLower('HeLLo WoRLD')).toBe('hello world');
    });
  });

  describe('toCapitalizeEachWord', () => {
    it('capitalizes first letter of each word', () => {
      expect(toCapitalizeEachWord('belajar typescript lanjut')).toBe(
        'Belajar Typescript Lanjut'
      );
    });

    it('handles single word', () => {
      expect(toCapitalizeEachWord('hello')).toBe('Hello');
    });

    it('handles already capitalized', () => {
      expect(toCapitalizeEachWord('Hello World')).toBe('Hello World');
    });

    it('handles hyphenated words', () => {
      expect(toCapitalizeEachWord('self-service')).toBe('Self-Service');
    });
  });

  describe('toToggleCase', () => {
    it('first letter lowercase, rest uppercase per word', () => {
      expect(toToggleCase('hello world')).toBe('hELLO wORLD');
    });

    it('handles single character word', () => {
      expect(toToggleCase('a b')).toBe('a b');
    });

    it('handles uppercase input', () => {
      expect(toToggleCase('HELLO')).toBe('hELLO');
    });
  });

  describe('toSentenceCase', () => {
    it('capitalizes first letter, lowercases rest', () => {
      expect(toSentenceCase('hello world')).toBe('Hello world');
    });

    it('handles multiple sentences', () => {
      expect(toSentenceCase('hello world. another sentence.')).toBe(
        'Hello world. Another sentence.'
      );
    });

    it('handles all uppercase input', () => {
      expect(toSentenceCase('HELLO WORLD')).toBe('Hello world');
    });

    it('handles empty string', () => {
      expect(toSentenceCase('')).toBe('');
    });
  });
});
