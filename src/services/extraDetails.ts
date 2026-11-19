// The fixed list of "extra details" that can be requested on top of the usual CV data, e.g.
// when a client asks for each candidate's town. Deliberately a fixed list with wording we
// control, rather than free text, so values come out consistent on the slide. To offer a new
// detail, add an entry here.

export type ExtraFieldId = 'location' | 'languages' | 'experience' | 'industry';

export interface ExtraField {
  id: ExtraFieldId;
  /** Shown on the button, in results and in the copy-paste text */
  label: string;
  /** What Claude is asked to extract. Values are shown after the name on the slide without
   *  a label, so each must read clearly on its own. */
  instruction: string;
  /** Example value for the slide preview in the panel */
  example: string;
}

export const EXTRA_FIELDS: ExtraField[] = [
  {
    id: 'location',
    label: 'Location',
    instruction:
      'The town or city where the candidate is currently based. The town or city name only, without region or country (e.g. "Helsinki").',
    example: 'Helsinki',
  },
  {
    id: 'languages',
    label: 'Languages',
    instruction:
      'The spoken languages listed in the CV, comma-separated, in the order the CV gives them (e.g. "Finnish, English, Swedish").',
    example: 'Finnish, English',
  },
  {
    id: 'experience',
    label: 'Years of experience',
    instruction:
      'Total years of working experience, counted from the start date of the earliest position in the CV to today and rounded down, written exactly as "<number> years exp." (e.g. "15 years exp."). Leave empty if the CV has no work dates.',
    example: '15 years exp.',
  },
  {
    id: 'industry',
    label: 'Industry',
    instruction:
      'The main industry of the candidate\'s recent positions, in 1-3 words (e.g. "SaaS", "Industrial machinery").',
    example: 'SaaS',
  },
];

export const MAX_SELECTED_EXTRAS = 3;

/** The selected fields' definitions, always in list order so the slide order is consistent */
export function selectedExtraFields(ids: ExtraFieldId[]): ExtraField[] {
  return EXTRA_FIELDS.filter((field) => ids.includes(field.id));
}
