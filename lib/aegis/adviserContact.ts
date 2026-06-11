export type AdviserContact = {
  assigned: boolean;
  adviserName: string | null;
  adviserCompany: string | null;
  adviserPhone: string | null;
};

export const EMPTY_ADVISER_CONTACT: AdviserContact = {
  assigned: false,
  adviserName: null,
  adviserCompany: null,
  adviserPhone: null,
};
