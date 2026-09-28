import { describe, expect, it } from 'vitest'
import * as MeasureLatency from '../../scripts/measure-latency'

const MedianCases: [number[], number, string][] = [
  // regular usage:
  [[3, 1, 2],             2,     'an odd count takes the middle value, whatever the order given'],
  [[4, 1, 3, 2],          3,     'an even count takes the mean of the middle two, rounded'],
  [[10, 20, 1000],        20,    'one outlier does not move it'],
  // trivial cases:
  [[7],                   7,     'a single value is its own median'],
  [[],                    NaN,   'no values have no median'],
]

describe('median', () => {
  for (const [vals, expected, blurb] of MedianCases) {
    it(blurb, () => {
      expect(MeasureLatency.median(vals)).to.deep.equal(expected)
    })
  }
})

const TenValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

const QuantileCases: [[number[], number], number, string][] = [
  // regular usage:
  [[TenValues, 0.9],               100,   'the p90 of ten values is the tenth, nearest-rank'],
  [[TenValues, 0.5],               60,    'the p50 is at or just above the middle'],
  [[[100, 10, 50, 30], 0.75],      100,   'the order given does not matter'],
  // edge cases:
  [[TenValues, 0],                 10,    'the zeroth is the least'],
  [[TenValues, 1],                 100,   'the whole way up is the greatest, not past the end'],
  [[[], 0.9],                      NaN,   'no values have no quantile'],
]

describe('quantile', () => {
  for (const [[vals, frac], expected, blurb] of QuantileCases) {
    it(blurb, () => {
      expect(MeasureLatency.quantile(vals, frac)).to.deep.equal(expected)
    })
  }
})

/** Counts for one browser, bytes down given, the rest fixed */
function countsOf(down: number): MeasureLatency.Counts {
  return { down, up: 300, queryUpdates: 2, mutations: 1 }
}

/** A run of two reorders and a fresh tab against `baseUrl` */
function runAt(baseUrl: string, authorMs: [number, number]): MeasureLatency.Run {
  return {
    baseUrl,
    quizUrl:   `${baseUrl}/h/some_hunt/home/some_hunt?act=smith`,
    rows:      25,
    startedAt: '2026-09-28T19:00:00.000Z',
    timings:   [
      { kind: 'reorder', authorMs: authorMs[0], watcherMs: authorMs[0] - 5, author: countsOf(2048), watcher: countsOf(1024) },
      { kind: 'reorder', authorMs: authorMs[1], watcherMs: authorMs[1] - 5, author: countsOf(2048), watcher: countsOf(1024) },
      { kind: 'fresh tab', authorMs: 500, author: countsOf(30_720), nav: { ttfb: 20, domContentLoaded: 80, load: 150 } },
    ],
    trips: [{ kind: 'reorder', ms: 90 }, { kind: 'reorder', ms: 110 }],
  }
}

describe('summaryOf', () => {
  it('gives each kind of edit its waits and its download per browser', () => {
    const lines = MeasureLatency.summaryOf([runAt('https://example.test', [200, 300])])
    expect(lines[0]).to.eq('1 run(s): https://example.test')
    expect(lines[1]).to.eq('reorder       n=  2  author med 250 p90 300  watcher med 245  down/author 2.0 KiB  down/watcher 1.0 KiB')
  })

  it('leaves the watcher out of a fresh tab, which has none', () => {
    const lines = MeasureLatency.summaryOf([runAt('https://example.test', [200, 300])])
    expect(lines[2]).to.eq('fresh tab     n=  1  author med 500 p90 500  down/author 30.0 KiB')
  })

  it('counts only the edits, not the fresh tabs, in the per-edit line', () => {
    const lines = MeasureLatency.summaryOf([runAt('https://example.test', [200, 300])])
    expect(lines[3]).to.eq('per edit (2 edits, 2 mutations): author 2.0 KiB, watcher 1.0 KiB, query redeliveries per browser 2.0')
  })

  it('files the round trips at the socket under the edit that sent them', () => {
    const lines = MeasureLatency.summaryOf([runAt('https://example.test', [200, 300])])
    expect(lines.slice(4)).to.deep.equal([
      'mutation round trip at the socket: med 100 p90 110 (n=2)',
      '   reorder       med 100 p90 110 (n=2)',
    ])
  })

  it('pools several runs, naming each place they were made once', () => {
    const lines = MeasureLatency.summaryOf([
      runAt('https://example.test', [200, 300]),
      runAt('https://example.test', [400, 500]),
      runAt('http://localhost:3004', [80, 90]),
    ])
    expect(lines[0]).to.eq('3 run(s): https://example.test, http://localhost:3004')
    expect(lines[1]).to.match(/^reorder {7}n= {2}6 {2}author med 250 p90 500/)
  })
})
