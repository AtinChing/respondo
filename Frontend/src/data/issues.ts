import type { Issue } from '../types'

/** Placeholder data until Notion is wired up */
export const issues: Issue[] = [
  {
    id: '1',
    title: 'Lobby camera offline — Building A',
    date: '2026-03-27',
    time: '14:32',
    description:
      'The north lobby feed stopped reporting heartbeat at 14:28. On-site check shows power to the encoder strip is stable; likely upstream switch port flap. Escalate to facilities if not restored within SLA.',
    status: 'unresolved',
  },
  {
    id: '2',
    title: 'After-hours access — tailgating suspected',
    date: '2026-03-26',
    time: '22:05',
    description:
      'Badge read at garage followed by second person within 3s. Review correlated video from lanes 2–3 and annotate clip for security review.',
    status: 'resolved',
  },
  {
    id: '3',
    title: 'False positive — motion in empty corridor',
    date: '2026-03-25',
    time: '03:17',
    description:
      'Classifier flagged motion during cleaning window. Verified against schedule; no incident. Mark for model feedback.',
    status: 'incorrectly_classified',
  },
  {
    id: '4',
    title: 'Delivery dock obstruction',
    date: '2026-03-24',
    time: '09:41',
    description:
      'Pallet stack partially blocking camera FOV on dock B. Request ops to clear and confirm full frame restoration.',
    status: 'unresolved',
  },
]
