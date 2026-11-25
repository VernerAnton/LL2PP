// Text styling for the candidate slides. Box positions live in the slide design (src/shared/design.ts).

export interface LayoutConfig {
  colors: {
    name: string;
    role: string;
    experience: string;
    education: string;
  };
  fonts: {
    name: number;
    role: number;
    experience: number;
    education: number;
  };
}

export const layoutConfig: LayoutConfig = {
  colors: {
    name: '000000',      // Black - Candidate name
    role: '000000',      // Black - Current role
    experience: '000000',// Black - Work history
    education: '000000'  // Black - Education
  },
  fonts: {
    name: 13,          // Name (bold, caps)
    role: 10,          // Not actively used
    experience: 10,    // Bullets
    education: 10      // Education text
  }
};
