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
    reason_flagged:
      'Video analytics detected a sustained loss of frame signal on the north lobby channel while adjacent cameras remained healthy; pattern consistent with encoder or network path failure rather than site-wide outage.',
    security_manual_dock: {
      section_trail: [
        'Security & surveillance',
        'Video infrastructure',
        'Signal loss / offline cameras',
      ],
      snippet:
        'For loss of video feed from a single camera or encoder zone when peer cameras remain online, treat as localized AV/network fault. Notify Facilities for physical plant and encoder checks; escalate to IT/Network if switch or VLAN issues are suspected. Reference: camera ID and last good frame timestamp in the ticket.',
      contact_department: 'Facilities',
    },
  },
  {
    id: '2',
    title: 'After-hours access — tailgating suspected',
    date: '2026-03-26',
    time: '22:05',
    description:
      'Badge read at garage followed by second person within 3s. Review correlated video from lanes 2–3 and annotate clip for security review.',
    status: 'resolved',
    reason_flagged:
      'Access-control correlation: one valid badge swipe followed by two distinct persons entering within three seconds; model flagged probable tailgating at garage ingress.',
    security_manual_dock: {
      section_trail: [
        'Physical security',
        'Access control',
        'After-hours & tailgating',
      ],
      snippet:
        'Suspected tailgating or piggybacking at controlled entrances outside business hours requires Security Operations review within 4 hours. Preserve synchronized video from all angles and access logs. Do not confront subjects directly; document and escalate to on-call Security lead.',
      contact_department: 'Security Operations',
    },
  },
  {
    id: '3',
    title: 'False positive — motion in empty corridor',
    date: '2026-03-25',
    time: '03:17',
    description:
      'Classifier flagged motion during cleaning window. Verified against schedule; no incident. Mark for model feedback.',
    status: 'incorrectly_classified',
    reason_flagged:
      'Motion detection exceeded threshold in a corridor zoned as unoccupied; no scheduled activity was ingested into the model context for the cleaning crew window.',
    security_manual_dock: {
      section_trail: [
        'Security & surveillance',
        'Analytics & false positives',
        'Scheduled maintenance windows',
      ],
      snippet:
        'When automated alerts occur during published janitorial or maintenance windows, verify against the facilities schedule before incident classification. Route tuning requests to the analytics owner; notify Facilities if schedules in the system are wrong.',
      contact_department: 'Facilities',
    },
  },
  {
    id: '4',
    title: 'Delivery dock obstruction',
    date: '2026-03-24',
    time: '09:41',
    description:
      'Pallet stack partially blocking camera FOV on dock B. Request ops to clear and confirm full frame restoration.',
    status: 'unresolved',
    reason_flagged:
      'FI (field of view) analytics reported persistent occlusion exceeding policy threshold on dock camera B-12, limiting visibility of the loading zone.',
    security_manual_dock: {
      section_trail: [
        'Facility incidents',
        'Loading & docks',
        'Camera field of view (FI)',
      ],
      snippet:
        'Obstructions or equipment placement that impede required camera coverage of loading docks must be cleared by dock operations. For FI (field-of-view) video compliance issues on dock cameras, contact the FI department for assessment and coordinate with Warehouse/Dock Operations for immediate clearance.',
      contact_department: 'FI department',
    },
  },
]
