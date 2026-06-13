export type PublicTestimonial = {
  id: string;
  ratingOverall: number;
  testimonialText: string;
  displayLabel: string;
  createdAt: string;
};

export type MyAdviserProfile = {
  adviserUserId: string;
  displayName: string | null;
  professionalTitle: string | null;
  representingInsurer: string | null;
  organisation: string | null;
  shortBio: string | null;
  yearsExperience: number | null;
  phone: string | null;
  photoUrl: string | null;
  bookingEnabled: boolean;
  calendarConnected: boolean;
};

export type MyAdviserPageData = {
  assigned: boolean;
  adviser: MyAdviserProfile | null;
  testimonials: PublicTestimonial[];
};

export const EMPTY_MY_ADVISER_PAGE: MyAdviserPageData = {
  assigned: false,
  adviser: null,
  testimonials: [],
};

export type AdviserProfileFormData = {
  displayName: string;
  professionalTitle: string;
  representingInsurer: string;
  organisation: string;
  phone: string;
  shortBio: string;
  yearsExperience: string;
  photoUrl: string | null;
  bookingEnabled: boolean;
  calendarConnected: boolean;
};
