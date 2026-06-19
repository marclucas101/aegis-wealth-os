/**
 * Negative tests for meeting presentation DTO allowlisting.
 * Run via npm run qa:phase9c-meeting-studio
 */

import { sanitizeMeetingPresentationDto } from "@/lib/compliance/meetingPresentationDtos";

const BASE_PAYLOAD = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  clientName: "Client",
  adviserName: "Adviser",
  meetingDate: null,
  dataAsAt: "2026-01-01T00:00:00.000Z",
  meetingPurpose: "Review",
  adviserLedLabel: "Adviser-led discussion",
  staleAnalysisWarning: null,
  algorithmVersion: "phase9c-v1",
  sections: [
    {
      sectionType: "welcome",
      heading: "Welcome",
      educationalLabel: "Adviser-led discussion",
      purpose: "Review",
    },
  ],
};

export function runMeetingPresentationDtoNegativeTests(): void {
  sanitizeMeetingPresentationDto(BASE_PAYLOAD as Record<string, unknown>);

  assertThrows("top-level prohibited key", () =>
    sanitizeMeetingPresentationDto({
      ...BASE_PAYLOAD,
      rawShieldScore: 99,
    } as Record<string, unknown>),
  );

  assertThrows("nested prohibited key", () =>
    sanitizeMeetingPresentationDto({
      ...BASE_PAYLOAD,
      sections: [
        {
          sectionType: "broad_strengths",
          heading: "Strengths",
          educationalLabel: "Adviser-led discussion",
          strengths: ["ok"],
          internalNotes: "secret",
        },
      ],
    } as Record<string, unknown>),
  );

  assertThrows("non-allowlisted top-level key", () =>
    sanitizeMeetingPresentationDto({
      ...BASE_PAYLOAD,
      taskSuggestions: [],
    } as Record<string, unknown>),
  );

  assertThrows("spread raw shield object", () =>
    sanitizeMeetingPresentationDto({
      ...BASE_PAYLOAD,
      sections: [
        {
          sectionType: "protection_resilience",
          heading: "Protection",
          educationalLabel: "Adviser-led discussion",
          categories: [
            {
              category: "Overall",
              relativeStrength: "moderate",
              explanation: "Based on information provided",
              modelCoefficients: { a: 1 },
            },
          ],
          assumptions: [],
        },
      ],
    } as Record<string, unknown>),
  );
}

function assertThrows(label: string, fn: () => void): void {
  try {
    fn();
    throw new Error(`Expected throw for ${label}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Expected throw")) {
      throw err;
    }
  }
}
