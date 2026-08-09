// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { computeThrowbackSimilarity, type ThrowbackCandidate } from './throwbackSimilarity'

const THRESHOLD = 0.7

describe('computeThrowbackSimilarity', () => {
  it('returns null when fewer than 2 candidates exist', async () => {
    const result = await computeThrowbackSimilarity(
      [{ filePath: '/a.jpg', embedding: [1, 0], year: 2020 }],
      THRESHOLD
    )

    expect(result).toBeNull()
  })

  it('returns null when no cross-year pair clears the similarity threshold', async () => {
    const result = await computeThrowbackSimilarity(
      [
        { filePath: '/a.jpg', embedding: [1, 0], year: 2020 },
        { filePath: '/b.jpg', embedding: [0, 1], year: 2021 }
      ],
      THRESHOLD
    )

    expect(result).toBeNull()
  })

  it('pairs similar photos from different years, sorted oldest first', async () => {
    const result = await computeThrowbackSimilarity(
      [
        { filePath: '/2022.jpg', embedding: [1, 0], year: 2022 },
        { filePath: '/2019.jpg', embedding: [0.9, Math.sqrt(1 - 0.9 ** 2)], year: 2019 }
      ],
      THRESHOLD
    )

    expect(result).toEqual([
      { year: 2019, filePath: '/2019.jpg' },
      { year: 2022, filePath: '/2022.jpg' }
    ])
  })

  it('never links two photos from the same year, even if visually near-identical', async () => {
    const result = await computeThrowbackSimilarity(
      [
        { filePath: '/2020-a.jpg', embedding: [1, 0], year: 2020 },
        { filePath: '/2020-b.jpg', embedding: [1, 0], year: 2020 }
      ],
      THRESHOLD
    )

    expect(result).toBeNull()
  })

  it('picks the cluster spanning the most distinct years when multiple qualify', async () => {
    const photos: ThrowbackCandidate[] = [
      // A 3-year cluster around [1, 0]...
      { filePath: '/2018.jpg', embedding: [1, 0], year: 2018 },
      { filePath: '/2019.jpg', embedding: [1, 0], year: 2019 },
      { filePath: '/2020.jpg', embedding: [1, 0], year: 2020 },
      // ...vs. a 2-year cluster around [0, 1].
      { filePath: '/x1.jpg', embedding: [0, 1], year: 2021 },
      { filePath: '/x2.jpg', embedding: [0, 1], year: 2022 }
    ]

    const result = await computeThrowbackSimilarity(photos, THRESHOLD)

    expect(result?.map((entry) => entry.year)).toEqual([2018, 2019, 2020])
  })
})
