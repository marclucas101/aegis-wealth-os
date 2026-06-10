export type JourneyStepId =
  | "discover"
  | "shield"
  | "dashboard"
  | "roadmap"
  | "stress"
  | "blueprint"
  | "annual"
  | "vault";

export type JourneyStepStatus = "complete" | "current" | "upcoming";

export interface ClientJourneyStep {
  id: JourneyStepId;
  label: string;
  shortLabel: string;
  href: string;
  clientDescription: string;
}

export interface ClientJourneyState {
  hasProfile: boolean;
  hasShield: boolean;
  roadmapCompletedCount?: number;
  roadmapTotalCount?: number;
}

export interface NextBestAction {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  reason: string;
}

export const CLIENT_JOURNEY_STEPS: ClientJourneyStep[] = [
  {
    id: "discover",
    label: "Discover",
    shortLabel: "Profile",
    href: "/discover",
    clientDescription: "Tell us about your finances in plain steps.",
  },
  {
    id: "shield",
    label: "Shield Diagnostic",
    shortLabel: "Diagnostic",
    href: "/shield-diagnostic",
    clientDescription: "See how strong your financial shield is today.",
  },
  {
    id: "dashboard",
    label: "Shield Dashboard",
    shortLabel: "Dashboard",
    href: "/dashboard",
    clientDescription: "Your home view — score, gaps, and benchmarks.",
  },
  {
    id: "roadmap",
    label: "Wealth Roadmap",
    shortLabel: "Roadmap",
    href: "/roadmap",
    clientDescription: "Turn gaps into clear, prioritised actions.",
  },
  {
    id: "stress",
    label: "Stress Testing",
    shortLabel: "Stress",
    href: "/stress-testing",
    clientDescription: "Explore what-if scenarios in everyday language.",
  },
  {
    id: "blueprint",
    label: "Wealth Blueprint",
    shortLabel: "Blueprint",
    href: "/wealth-blueprint",
    clientDescription: "A readable planning report of your position.",
  },
  {
    id: "annual",
    label: "Annual Review",
    shortLabel: "Review",
    href: "/annual-review",
    clientDescription: "Track progress and what to focus on next.",
  },
  {
    id: "vault",
    label: "Document Vault",
    shortLabel: "Vault",
    href: "/document-vault",
    clientDescription: "Store policies and records securely.",
  },
];

export interface ClientModuleCardData {
  id: JourneyStepId;
  title: string;
  description: string;
  href: string;
  statusLabel?: string;
  accent?: "gold" | "emerald" | "neutral";
}

export function buildJourneySteps(
  state: ClientJourneyState,
): Array<ClientJourneyStep & { status: JourneyStepStatus }> {
  const completedIds = new Set<JourneyStepId>();

  if (state.hasProfile) {
    completedIds.add("discover");
  }
  if (state.hasShield) {
    completedIds.add("shield");
    completedIds.add("dashboard");
  }
  if (
    state.roadmapTotalCount != null &&
    state.roadmapTotalCount > 0 &&
    state.roadmapCompletedCount === state.roadmapTotalCount
  ) {
    completedIds.add("roadmap");
  }

  let currentId: JourneyStepId = "discover";
  if (!state.hasProfile) {
    currentId = "discover";
  } else if (!state.hasShield) {
    currentId = "shield";
  } else if (
    state.roadmapTotalCount == null ||
    state.roadmapTotalCount === 0 ||
    (state.roadmapCompletedCount ?? 0) < Math.min(3, state.roadmapTotalCount)
  ) {
    currentId = "roadmap";
  } else {
    currentId = "stress";
  }

  return CLIENT_JOURNEY_STEPS.map((step) => {
    if (completedIds.has(step.id)) {
      return { ...step, status: "complete" as const };
    }
    if (step.id === currentId) {
      return { ...step, status: "current" as const };
    }
    return { ...step, status: "upcoming" as const };
  });
}

export function getNextBestAction(state: ClientJourneyState): NextBestAction {
  if (!state.hasProfile) {
    return {
      title: "Complete your Discover profile",
      description:
        "Answer guided questions about income, assets, protection, and goals. This unlocks your Shield score and personalised insights.",
      href: "/discover",
      ctaLabel: "Start Discover",
      reason: "Your journey begins with a complete financial profile.",
    };
  }

  if (!state.hasShield) {
    return {
      title: "Run your Shield Diagnostic",
      description:
        "We will score seven pillars of your financial life — from cash flow to legacy planning — so you know where you stand.",
      href: "/shield-diagnostic",
      ctaLabel: "View Diagnostic",
      reason: "Your profile is saved. Next, review your Shield scores.",
    };
  }

  const completed = state.roadmapCompletedCount ?? 0;
  const total = state.roadmapTotalCount ?? 0;

  if (total > 0 && completed < Math.min(3, total)) {
    return {
      title: "Start your Wealth Roadmap",
      description:
        "Your diagnostic highlights priority gaps. The roadmap turns them into manageable steps with expected impact.",
      href: "/roadmap",
      ctaLabel: "Open Roadmap",
      reason: `${completed} of ${total} roadmap actions completed.`,
    };
  }

  return {
    title: "Stress-test your plan",
    description:
      "See how your shield holds up against events like job loss, illness, or market downturns — explained in plain language.",
    href: "/stress-testing",
    ctaLabel: "Explore Scenarios",
    reason: "Your foundation is in place. Test resilience next.",
  };
}

export function buildModuleCards(state: ClientJourneyState): ClientModuleCardData[] {
  const journey = buildJourneySteps(state);
  const statusById = Object.fromEntries(
    journey.map((step) => [step.id, step.status]),
  ) as Record<JourneyStepId, JourneyStepStatus>;

  const statusLabel = (id: JourneyStepId): string | undefined => {
    const status = statusById[id];
    if (status === "complete") return "Ready";
    if (status === "current") return "Recommended";
    return undefined;
  };

  return CLIENT_JOURNEY_STEPS.filter((step) => step.id !== "dashboard").map(
    (step) => ({
      id: step.id,
      title: step.label,
      description: step.clientDescription,
      href: step.href,
      statusLabel: statusLabel(step.id),
      accent:
        statusById[step.id] === "current"
          ? ("gold" as const)
          : statusById[step.id] === "complete"
            ? ("emerald" as const)
            : ("neutral" as const),
    }),
  );
}

export const STRESS_SCENARIO_PLAIN: Record<string, string> = {
  income_loss: "What if your main income stopped for a period?",
  critical_illness: "What if a serious illness reduced your ability to earn?",
  death_event: "What if your family lost your income or support?",
  disability: "What if you could not work due to injury or illness?",
  market_crash: "What if investments fell sharply in value?",
  inflation_shock: "What if living costs rose faster than expected?",
  longevity: "What if you lived longer than your savings plan assumed?",
  business_failure: "What if a business or self-employment income failed?",
  parent_care: "What if elder-care costs increased significantly?",
  estate_delay: "What if wealth transfer took longer than planned?",
};

export const STRESS_SEVERITY_PLAIN: Record<
  string,
  { label: string; description: string }
> = {
  mild: {
    label: "Mild",
    description: "A smaller disruption — useful as a baseline check.",
  },
  moderate: {
    label: "Moderate",
    description: "A realistic setback many households could face.",
  },
  severe: {
    label: "Severe",
    description: "A major event that would strain most plans.",
  },
  extreme: {
    label: "Extreme",
    description: "A worst-case stress test for your shield.",
  },
};

export const DOCUMENT_CATEGORY_GUIDANCE: Record<
  string,
  { label: string; description: string }
> = {
  insurance: {
    label: "Insurance",
    description: "Life, health, CI, and disability policies.",
  },
  investment: {
    label: "Investment",
    description: "Statements, portfolio summaries, and fund records.",
  },
  cpf: {
    label: "CPF",
    description: "CPF statements, nominations, and retirement plans.",
  },
  estate: {
    label: "Estate",
    description: "Wills, trusts, nominations, and beneficiary records.",
  },
  tax: {
    label: "Tax",
    description: "Tax returns, assessments, and planning documents.",
  },
  property: {
    label: "Property",
    description: "Titles, valuations, leases, and mortgage documents.",
  },
  loan: {
    label: "Loan",
    description: "Mortgage, personal loan, and credit agreements.",
  },
  identity: {
    label: "Identity",
    description: "ID copies used for verification when requested.",
  },
  other: {
    label: "Other",
    description: "Any other records your advisor may need.",
  },
};

export const ROADMAP_PRIORITY_LABELS: Record<string, string> = {
  critical: "Do first",
  high: "High priority",
  medium: "When ready",
  low: "Later",
};

export const ROADMAP_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Done",
};
