export type MyClientsListItem = {
  id: string;
  displayName: string;
  email: string | null;
  status: string;
  onboardingStep: string | null;
  nextReviewDue: string | null;
  reviewDue: boolean;
  adjustedShieldScore: number | null;
  rating: string | null;
  lastActivityDate: string | null;
  documentCount: number;
  budgetSaved: boolean;
  upcomingAppointmentAt: string | null;
  feedbackStatus: string | null;
};

export type MyClientsListPage = {
  clients: MyClientsListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export const DEFAULT_MY_CLIENTS_PAGE_SIZE = 20;
