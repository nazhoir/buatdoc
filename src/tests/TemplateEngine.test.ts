import { TemplateEngine } from '../core/TemplateEngine';

describe('TemplateEngine core behavior', () => {
  const engine = new TemplateEngine();

  it('supports nested #if blocks', () => {
    const result = engine.process('{{#if a}}{{#if b}}both{{/if}}{{/if}}', {
      a: true,
      b: true,
    });
    expect(result).toBe('both');
  });

  it('handles nested #if where inner is false', () => {
    const result = engine.process('{{#if a}}outer{{#if b}}inner{{/if}}{{/if}}', {
      a: true,
      b: false,
    });
    expect(result).toBe('outer');
  });

  it('exposes @index meta variable in each loops', () => {
    const result = engine.process('{{#each items}}{{@index}}:{{name}},{{/each}}', {
      items: [{ name: 'a' }, { name: 'b' }],
    });
    expect(result).toBe('0:a,1:b,');
  });

  it('exposes @value for scalar arrays inside each loops', () => {
    const result = engine.process('{{#each tags}}{{@value}},{{/each}}', {
      tags: ['typescript', 'nodejs', 'docx'],
    });
    expect(result).toBe('typescript,nodejs,docx,');
  });
});
