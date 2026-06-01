import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderToTest } from '@barefootjs/test'

const AppHeaderSource = readFileSync(resolve(__dirname, 'AppHeader.tsx'), 'utf-8')

describe('AppHeader', () => {
  const result = renderToTest(AppHeaderSource, 'AppHeader.tsx')

  test('has no compiler errors', () => {
    expect(result.errors).toEqual([])
  })

  test('componentName is AppHeader', () => {
    expect(result.componentName).toBe('AppHeader')
  })

  test('carries only the info popover and Export action, no pickers', () => {
    // Theme/language pickers moved to the SettingsBar so the header stays
    // narrow on mobile and the Export button never overflows off-screen.
    expect(result.find({ componentName: 'Select' })).toBeNull()
    expect(AppHeaderSource).toContain('koma-export-btn')
    expect(result.find({ componentName: 'Popover' })).not.toBeNull()
  })

  test('keeps the info popover trigger labelled', () => {
    const trigger = result.find({ componentName: 'PopoverTrigger' })
    expect(trigger).not.toBeNull()
    expect(AppHeaderSource).toContain('About piconic koma')
  })
})
