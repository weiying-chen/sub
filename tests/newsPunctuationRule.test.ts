import { describe, expect, it } from 'vitest'

import { buildAnalysisOutput } from '../src/analysis/buildAnalysisOutput'

describe('newsPunctuationRule', () => {
  it('flags missing punctuation before capital inside a SUPER translated block', () => {
    const text = [
      '/*SUPER:',
      '慈濟志工｜蔡岱霖//',
      '都會說感恩 感恩',
      '*/',
      'Both adults and children say',
      'Thank you, thank you.',
      '',
    ].join('\n')

    const findings = buildAnalysisOutput({
      text,
      type: 'news',
      ruleSet: 'findings',
      output: 'findings',
      enabledRuleTypes: ['PUNCTUATION'],
    })

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PUNCTUATION',
          ruleCode: 'MISSING_PUNCTUATION_BEFORE_CAPITAL',
          text: 'Both adults and children say',
          nextText: 'Thank you, thank you.',
        }),
      ])
    )
  })

  it('flags comma before quoted line inside a SUPER translated block', () => {
    const text = [
      '/*SUPER:',
      '慈濟志工｜蔡岱霖//',
      '都會說感恩 感恩',
      '*/',
      'Both adults and children say,',
      '"Thank you, thank you."',
      '',
    ].join('\n')

    const findings = buildAnalysisOutput({
      text,
      type: 'news',
      ruleSet: 'findings',
      output: 'findings',
      enabledRuleTypes: ['PUNCTUATION'],
    })

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PUNCTUATION',
          ruleCode: 'COMMA_BEFORE_QUOTE',
          text: 'Both adults and children say,',
          nextText: '"Thank you, thank you."',
        }),
      ])
    )
  })

  it('does not apply punctuation findings to VO translated blocks', () => {
    const text = [
      '1_0001',
      '這是一段旁白',
      'He said,',
      '"Thank you, thank you."',
      '',
    ].join('\n')

    const findings = buildAnalysisOutput({
      text,
      type: 'news',
      ruleSet: 'findings',
      output: 'findings',
      enabledRuleTypes: ['PUNCTUATION'],
    })

    expect(
      findings.some(
        (finding) =>
          finding.type === 'PUNCTUATION' &&
          finding.ruleCode === 'COMMA_BEFORE_QUOTE'
      )
    ).toBe(false)
  })
})
