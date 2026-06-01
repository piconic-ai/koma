import { describe, test, expect } from 'bun:test'
import { detectLanguage } from './detect-language'

describe('detectLanguage', () => {
  test('returns null for empty/whitespace', () => {
    expect(detectLanguage('')).toBeNull()
    expect(detectLanguage('   \n  ')).toBeNull()
  })

  test('detects strong single-language signals', () => {
    expect(detectLanguage('def greet(name):\n    return f"hi {name}"')).toBe('py')
    expect(detectLanguage('fn main() {\n    println!("hi");\n}')).toBe('rs')
    expect(detectLanguage('package main\n\nfunc main() {\n\tfmt.Println("hi")\n}')).toBe('go')
    expect(detectLanguage('<?php echo "hi"; ?>')).toBe('php')
    expect(detectLanguage('#!/bin/bash\necho hello')).toBe('sh')
    expect(detectLanguage('puts "hello"\ndef greet\nend')).toBe('rb')
  })

  test('distinguishes TypeScript from JavaScript via type annotations', () => {
    expect(detectLanguage('function greet(name: string): string {\n  return name\n}')).toBe('ts')
    expect(detectLanguage('const greet = (name) => {\n  console.log(name)\n}')).toBe('js')
  })

  test('detects markup and styles', () => {
    expect(detectLanguage('<!DOCTYPE html>\n<html><body>hi</body></html>')).toBe('html')
    expect(detectLanguage('.btn {\n  color: red;\n  padding: 4px;\n}')).toBe('css')
  })

  test('detects JSON only when it actually parses', () => {
    expect(detectLanguage('{"a": 1, "b": [2, 3]}')).toBe('json')
  })

  test('returns null for ambiguous prose', () => {
    expect(detectLanguage('hello world this is just some text')).toBeNull()
  })
})
