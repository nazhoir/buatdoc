import { TemplateEngine } from '../core/TemplateEngine';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  // -------------------------------------------------------------------------
  // Simple variable substitution
  // -------------------------------------------------------------------------

  describe('simple variables', () => {
    it('replaces a simple variable', () => {
      const result = engine.process('Hello {{nama}}!', { nama: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });

    it('replaces multiple variables', () => {
      const result = engine.process('{{greeting}}, {{nama}}!', {
        greeting: 'Hi',
        nama: 'Bob',
      });
      expect(result).toBe('Hi, Bob!');
    });

    it('replaces numeric variable', () => {
      const result = engine.process('Total: {{total}}', { total: 9500 });
      expect(result).toBe('Total: 9500');
    });

    it('returns empty string for missing variable', () => {
      const result = engine.process('Hello {{missing}}!', {});
      expect(result).toBe('Hello !');
    });

    it('leaves template unchanged when no variables', () => {
      const result = engine.process('No variables here.', { x: 1 });
      expect(result).toBe('No variables here.');
    });
  });

  // -------------------------------------------------------------------------
  // Default values
  // -------------------------------------------------------------------------

  describe('default values', () => {
    it('uses default when variable is missing', () => {
      const result = engine.process('Hello {{nama|Guest}}!', {});
      expect(result).toBe('Hello Guest!');
    });

    it('uses actual value when variable is present', () => {
      const result = engine.process('Hello {{nama|Guest}}!', { nama: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });

    it('uses default when variable is null', () => {
      const result = engine.process('{{title|Untitled}}', { title: null });
      expect(result).toBe('Untitled');
    });

    it('returns empty string for empty string variable (no default fallback)', () => {
      const result = engine.process('{{name|Anonymous}}', { name: '' });
      expect(result).toBe('');  // default only applies when key is missing/null
    });

    it('preserves spaces in default value', () => {
      const result = engine.process('{{city|New York}}', {});
      expect(result).toBe('New York');
    });
  });

  // -------------------------------------------------------------------------
  // Nested property access
  // -------------------------------------------------------------------------

  describe('nested properties', () => {
    it('resolves a nested property', () => {
      const result = engine.process('Name: {{user.name}}', {
        user: { name: 'Charlie' },
      });
      expect(result).toBe('Name: Charlie');
    });

    it('resolves deeply nested property', () => {
      const result = engine.process('{{a.b.c}}', {
        a: { b: { c: 'deep value' } },
      });
      expect(result).toBe('deep value');
    });

    it('returns empty string for missing nested property', () => {
      const result = engine.process('{{user.email}}', { user: { name: 'x' } });
      expect(result).toBe('');
    });

    it('supports default on nested path', () => {
      const result = engine.process('{{user.email|no-email}}', { user: {} });
      expect(result).toBe('no-email');
    });
  });

  // -------------------------------------------------------------------------
  // Text modifiers
  // -------------------------------------------------------------------------

  describe('text modifiers', () => {
    const data = { nama: 'andika putra', judul: 'belajar typescript lanjut' };

    it('applies _upper modifier', () => {
      const result = engine.process('{{nama_upper}}', data);
      expect(result).toBe('ANDIKA PUTRA');
    });

    it('applies _lower modifier', () => {
      const result = engine.process('{{nama_lower}}', { nama: 'ANDIKA PUTRA' });
      expect(result).toBe('andika putra');
    });

    it('applies _capitalize_each_word modifier', () => {
      const result = engine.process('{{judul_capitalize_each_word}}', data);
      expect(result).toBe('Belajar Typescript Lanjut');
    });

    it('applies _toggle_case modifier', () => {
      const result = engine.process('{{nama_toggle_case}}', data);
      expect(result).toBe('aNDIKA pUTRA');
    });

    it('applies _sentence_case modifier', () => {
      const result = engine.process('{{judul_sentence_case}}', data);
      expect(result).toBe('Belajar typescript lanjut');
    });

    it('ignores unknown modifier, treats full string as variable name', () => {
      // Variable 'nama_xyz' does not exist → empty string
      const result = engine.process('{{nama_xyz}}', data);
      expect(result).toBe('');
    });

    it('modifier works with nested path', () => {
      const result = engine.process('{{user.name_upper}}', {
        user: { name: 'alice' },
      });
      expect(result).toBe('ALICE');
    });

    it('modifier works with default value', () => {
      const result = engine.process('{{missing_upper|default text}}', {});
      // The default is returned, modifier was on missing variable path
      // The cleanName after removing modifier is 'missing'
      // resolveValue('missing|default text') → 'default text'
      // modifier _upper applied to 'default text' → 'DEFAULT TEXT'
      expect(result).toBe('DEFAULT TEXT');
    });
  });

  // -------------------------------------------------------------------------
  // Conditional blocks ({{#if}})
  // -------------------------------------------------------------------------

  describe('#if blocks', () => {
    it('renders block when condition is true', () => {
      const result = engine.process('{{#if isPremium}}Premium User{{/if}}', {
        isPremium: true,
      });
      expect(result).toBe('Premium User');
    });

    it('hides block when condition is false', () => {
      const result = engine.process('{{#if isPremium}}Premium{{/if}}', {
        isPremium: false,
      });
      expect(result).toBe('');
    });

    it('hides block when variable is missing', () => {
      const result = engine.process('{{#if missing}}text{{/if}}', {});
      expect(result).toBe('');
    });

    it('renders block for truthy string', () => {
      const result = engine.process('{{#if name}}Hello {{name}}{{/if}}', {
        name: 'Alice',
      });
      expect(result).toBe('Hello Alice');
    });

    it('hides block for empty string', () => {
      const result = engine.process('{{#if name}}Hello{{/if}}', { name: '' });
      expect(result).toBe('');
    });

    it('renders block for truthy number', () => {
      const result = engine.process('{{#if count}}Has items{{/if}}', {
        count: 5,
      });
      expect(result).toBe('Has items');
    });

    it('hides block for zero', () => {
      const result = engine.process('{{#if count}}Has items{{/if}}', {
        count: 0,
      });
      expect(result).toBe('');
    });

    it('processes variables inside if block', () => {
      const result = engine.process(
        '{{#if show}}Name: {{name}}{{/if}}',
        { show: true, name: 'Bob' }
      );
      expect(result).toBe('Name: Bob');
    });

    it('supports nested #if blocks', () => {
      const result = engine.process(
        '{{#if a}}{{#if b}}both{{/if}}{{/if}}',
        { a: true, b: true }
      );
      expect(result).toBe('both');
    });

    it('handles nested #if where inner is false', () => {
      const result = engine.process(
        '{{#if a}}outer{{#if b}}inner{{/if}}{{/if}}',
        { a: true, b: false }
      );
      expect(result).toBe('outer');
    });

    it('preserves surrounding text', () => {
      const result = engine.process(
        'before{{#if flag}}middle{{/if}}after',
        { flag: true }
      );
      expect(result).toBe('beforemiddleafter');
    });
  });

  // -------------------------------------------------------------------------
  // Loop blocks ({{#each}})
  // -------------------------------------------------------------------------

  describe('#each blocks', () => {
    it('renders each item in an array', () => {
      const result = engine.process(
        '{{#each items}}{{produk}},{{/each}}',
        { items: [{ produk: 'Laptop' }, { produk: 'Mouse' }] }
      );
      expect(result).toBe('Laptop,Mouse,');
    });

    it('renders item with multiple properties', () => {
      const result = engine.process(
        '{{#each items}}{{produk}}: {{harga}}\n{{/each}}',
        {
          items: [
            { produk: 'Laptop', harga: 10000 },
            { produk: 'Mouse', harga: 500 },
          ],
        }
      );
      expect(result).toBe('Laptop: 10000\nMouse: 500\n');
    });

    it('renders nothing for empty array', () => {
      const result = engine.process(
        '{{#each items}}{{name}}{{/each}}',
        { items: [] }
      );
      expect(result).toBe('');
    });

    it('renders nothing for missing array', () => {
      const result = engine.process(
        '{{#each items}}{{name}}{{/each}}',
        {}
      );
      expect(result).toBe('');
    });

    it('exposes @index meta variable', () => {
      const result = engine.process(
        '{{#each items}}{{@index}}:{{name}},{{/each}}',
        { items: [{ name: 'a' }, { name: 'b' }] }
      );
      expect(result).toBe('0:a,1:b,');
    });

    it('exposes @first and @last meta variables', () => {
      const result = engine.process(
        '{{#each items}}{{#if @first}}FIRST{{/if}}{{#if @last}}LAST{{/if}}{{name}},{{/each}}',
        { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] }
      );
      expect(result).toBe('FIRSTa,b,LASTc,');
    });

    it('accesses outer scope variables inside each', () => {
      const result = engine.process(
        '{{#each items}}{{prefix}}-{{name}},{{/each}}',
        { prefix: 'ITEM', items: [{ name: 'X' }, { name: 'Y' }] }
      );
      expect(result).toBe('ITEM-X,ITEM-Y,');
    });

    it('supports nested each blocks', () => {
      const result = engine.process(
        '{{#each groups}}[{{#each members}}{{name}},{{/each}}]{{/each}}',
        {
          groups: [
            { members: [{ name: 'A' }, { name: 'B' }] },
            { members: [{ name: 'C' }] },
          ],
        }
      );
      expect(result).toBe('[A,B,][C,]');
    });

    it('supports @value for scalar arrays', () => {
      const result = engine.process(
        '{{#each tags}}{{@value}},{{/each}}',
        { tags: ['typescript', 'nodejs', 'docx'] }
      );
      expect(result).toBe('typescript,nodejs,docx,');
    });

    it('processes modifiers inside each loop', () => {
      const result = engine.process(
        '{{#each items}}{{name_upper}},{{/each}}',
        { items: [{ name: 'hello' }, { name: 'world' }] }
      );
      expect(result).toBe('HELLO,WORLD,');
    });
  });

  // -------------------------------------------------------------------------
  // extractVariables
  // -------------------------------------------------------------------------

  describe('extractVariables', () => {
    it('extracts simple variables', () => {
      const vars = engine.extractVariables('Hello {{name}}, you have {{count}} items.');
      expect(vars.map((v) => v.expression)).toEqual(['name', 'count']);
    });

    it('does not extract block tags', () => {
      const vars = engine.extractVariables('{{#if flag}}text{{/if}}');
      expect(vars).toHaveLength(0);
    });
  });
});
