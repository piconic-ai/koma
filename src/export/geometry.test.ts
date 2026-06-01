import { describe, expect, test } from 'bun:test'
import { frameCount, gifFrameDelayMs, gifOutputSize } from './geometry'

describe('frameCount', () => {
  test('samples ceil(duration / frame interval)', () => {
    expect(frameCount(1000, 10)).toBe(10) // 100ms per frame
    expect(frameCount(2000, 15)).toBe(30)
  })

  test('rounds a partial trailing frame up', () => {
    expect(frameCount(1050, 10)).toBe(11)
    expect(frameCount(50, 10)).toBe(1)
  })

  test('always yields at least one frame for an empty timeline', () => {
    expect(frameCount(0, 30)).toBe(1)
  })
})

describe('gifOutputSize', () => {
  test('defaults to half the source size', () => {
    expect(gifOutputSize(1080, 540)).toEqual({ width: 540, height: 270 })
    expect(gifOutputSize(1080, 608)).toEqual({ width: 540, height: 304 })
  })

  test('pins the longest side to maxDimension', () => {
    expect(gifOutputSize(1080, 540, 480)).toEqual({ width: 480, height: 240 })
    // height is the longest side here
    expect(gifOutputSize(300, 900, 450)).toEqual({ width: 150, height: 450 })
  })

  test('never upscales when maxDimension exceeds the source', () => {
    expect(gifOutputSize(400, 300, 800)).toEqual({ width: 400, height: 300 })
  })

  test('floors each dimension at 1px', () => {
    expect(gifOutputSize(1, 1000, 1)).toEqual({ width: 1, height: 1 })
  })
})

describe('gifFrameDelayMs', () => {
  test('snaps the frame interval to a 10ms grid', () => {
    expect(gifFrameDelayMs(15)).toBe(70) // 66.6ms -> 70
    expect(gifFrameDelayMs(30)).toBe(30) // 33.3ms -> 30
    expect(gifFrameDelayMs(10)).toBe(100)
    expect(gifFrameDelayMs(50)).toBe(20)
  })

  test('clamps to a 2ms floor for very high frame rates', () => {
    expect(gifFrameDelayMs(1000)).toBe(2)
  })
})
