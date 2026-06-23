"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import type { AdvisorOverviewResponse } from "@/app/api/advisor/overview/route";

import {
  FieldGrid,
  FinancialCheckbox,
  FinancialSelect,
  FinancialTextInput,
} from "@/components/aegis/discover/FinancialInput";
import ProtectionReportPreview from "@/components/aegis/advisor/protection-report/ProtectionReportPreview";
import {
  clearDraftFromStorage,
  createEmptyDraft,
  draftFromSampleReport,
  draftToReportInput,
  FORM_STEPS,
  generateEntityId,
  getIlpPolicies,
  getPersonDeleteBlockReason,
  getPolicyDeleteBlockReason,
  loadDraftFromStorage,
  saveDraftToStorage,
  summarizeProtectionReport,
  validateILPAllocations,
  type FormStepId,
  type ProtectionReportDraft,
} from "@/src/features/advisor-console/protection-report";
import { saveProtectionReportToVault } from "@/src/features/document-vault";
import { runBrowserPrint, sanitizeReportFilenameBase } from "@/lib/reports/a4Print";

const labelClass =
  "text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70";
const panelClass =
  "relative rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 p-4 sm:p-5";
const errorClass = "mt-1 text-xs font-light text-red-300/90";
const buttonSecondary =
  "rounded-sm border border-[#D1A866]/20 px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-[#F3F1EA]/70 transition hover:border-[#D1A866]/35 hover:text-[#F3F1EA]";
const buttonPrimary =
  "rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/12 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#F3F1EA] transition hover:border-[#D1A866]/55 hover:bg-[#D1A866]/18";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={errorClass}>{message}</p>;
}

function ProtectionReportClientLoaded() {
  const [draft, setDraft] = useState<ProtectionReportDraft>(
    () => loadDraftFromStorage() ?? createEmptyDraft()
  );
  const [activeStep, setActiveStep] = useState<FormStepId>("household");
  const [showPreview, setShowPreview] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [clientOptions, setClientOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientsLoading, setClientsLoading] = useState(true);
  const [vaultSaveState, setVaultSaveState] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [vaultSaveError, setVaultSaveError] = useState<string | null>(null);
  const [savedVaultDocumentId, setSavedVaultDocumentId] = useState<string | null>(
    null,
  );
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    saveDraftToStorage(draft);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;

    async function loadClients() {
      try {
        const response = await fetch("/api/advisor/overview", {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await response.json()) as AdvisorOverviewResponse;

        if (cancelled) return;

        if (data.ok && data.clients.length > 0) {
          setClientOptions(
            data.clients.map((client) => ({
              value: client.id,
              label: client.displayName,
            })),
          );
          setSelectedClientId((current) => current || data.clients[0]?.id || "");
        } else {
          setClientOptions([]);
        }
      } catch {
        if (!cancelled) {
          setClientOptions([]);
        }
      } finally {
        if (!cancelled) {
          setClientsLoading(false);
        }
      }
    }

    void loadClients();

    return () => {
      cancelled = true;
    };
  }, []);

  const validation = useMemo(() => draftToReportInput(draft), [draft]);
  const fieldErrors = validation.validation.fieldErrors;
  const reportInput = validation.input;

  const ilpPolicies = useMemo(() => getIlpPolicies(draft), [draft]);

  const ilpAllocationPreview = useMemo(() => {
    if (!reportInput) return null;
    const ilpIds = ilpPolicies.map((policy) => policy.id);
    const funds = reportInput.investmentFunds.filter((fund) =>
      ilpIds.includes(fund.policyId)
    );
    if (funds.length === 0) return null;
    return validateILPAllocations(funds, [
      ...new Set(funds.map((fund) => fund.policyId)),
    ]);
  }, [reportInput, ilpPolicies]);

  const updateDraft = useCallback(
    (updater: (current: ProtectionReportDraft) => ProtectionReportDraft) => {
      setDraft((current) => updater(current));
      setActionMessage(null);
    },
    []
  );

  function handleClearDraft() {
    if (
      !window.confirm(
        "Clear all draft data? This removes the saved form from this browser."
      )
    ) {
      return;
    }
    clearDraftFromStorage();
    setDraft(createEmptyDraft());
    setShowPreview(false);
    setValidationAttempted(false);
    setActiveStep("household");
    setActionMessage("Draft cleared.");
  }

  function handleLoadSample() {
    setDraft(draftFromSampleReport());
    setShowPreview(false);
    setValidationAttempted(false);
    setActionMessage("Sample data loaded. Review each section before generating.");
  }

  function handleGeneratePreview() {
    setValidationAttempted(true);
    const result = draftToReportInput(draft);
    if (!result.input) {
      setShowPreview(false);
      setActionMessage("Please resolve the validation issues below.");
      return;
    }
    setShowPreview(true);
    setActiveStep("review");
    setActionMessage("Report preview ready. Use Print / Save as PDF when satisfied.");
  }

  async function handlePrint() {
    if (!reportInput) {
      handleGeneratePreview();
      return;
    }
    if (printing) return;

    setPrinting(true);
    const householdName = reportInput.household.householdName || "Household";
    const safeName = sanitizeReportFilenameBase(householdName);

    try {
      await runBrowserPrint({
        documentTitle: `AEGIS Protection Portfolio — ${safeName}`,
        onError: (message) => setActionMessage(message),
      });
    } finally {
      setPrinting(false);
    }
  }

  async function handleSaveToVault() {
    if (!reportInput) {
      handleGeneratePreview();
      return;
    }

    if (!selectedClientId) {
      setVaultSaveState("error");
      setVaultSaveError("Select a client account before saving to the Document Vault.");
      return;
    }

    const reportRoot = document.getElementById("protection-report-print-root");
    if (!reportRoot) {
      setVaultSaveState("error");
      setVaultSaveError("Report preview is not ready. Generate the preview first.");
      return;
    }

    const summary = summarizeProtectionReport(reportInput);
    setVaultSaveState("saving");
    setVaultSaveError(null);
    setSavedVaultDocumentId(null);

    try {
      const result = await saveProtectionReportToVault({
        clientId: selectedClientId,
        reportRootElement: reportRoot,
        metadata: {
          householdName: reportInput.household.householdName,
          primaryContact: reportInput.household.primaryContact,
          statementPeriod: reportInput.household.statementPeriod,
          adviserName: reportInput.household.adviserName,
          adviserCompany: reportInput.household.adviserCompany,
          policyCount: summary.policyCount,
          totalCoverage: summary.coverageInForce,
          monthlyPremium: summary.monthlyPremium,
        },
      });

      if (!result.ok) {
        setVaultSaveState("error");
        setVaultSaveError(result.error);
        return;
      }

      setVaultSaveState("success");
      setSavedVaultDocumentId(result.documentId);
      setActionMessage(
        `Saved to Document Vault as "${result.fileName}". The client can view it in their vault.`
      );
    } catch (err) {
      setVaultSaveState("error");
      setVaultSaveError(
        err instanceof Error ? err.message : "Failed to save report to vault",
      );
    }
  }

  const canSaveToVault =
    Boolean(reportInput) &&
    showPreview &&
    Boolean(selectedClientId) &&
    vaultSaveState !== "saving";

  const stepIndex = FORM_STEPS.findIndex((step) => step.id === activeStep);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header actions */}
      <div className="report-no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#D1A866]/60">
            Advisor Console
          </p>
          <h2 className="mt-1 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
            Protection Portfolio Summary
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
            Enter household protection data and generate a luxury AEGIS-branded
            printable summary. Drafts autosave in this browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleLoadSample} className={buttonSecondary}>
            Load Sample Data
          </button>
          <button type="button" onClick={handleClearDraft} className={buttonSecondary}>
            Clear Draft
          </button>
        </div>
      </div>

      {actionMessage ? (
        <p className="report-no-print rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 px-4 py-3 text-sm font-light text-[#F3F1EA]/75">
          {actionMessage}
        </p>
      ) : null}

      {/* Step navigation */}
      <nav className="report-no-print sticky top-14 z-20 -mx-1 overflow-x-auto rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/80 px-2 py-2 backdrop-blur-md">
        <ul className="flex min-w-max gap-1">
          {FORM_STEPS.map((step, index) => {
            const isActive = step.id === activeStep;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`rounded-sm px-3 py-2 text-left transition ${
                    isActive
                      ? "bg-[#D1A866]/12 text-[#F3F1EA]"
                      : "text-[#F3F1EA]/50 hover:bg-[#10283A]/60 hover:text-[#F3F1EA]/80"
                  }`}
                >
                  <span className="block text-[9px] uppercase tracking-[0.14em] text-[#D1A866]/60">
                    Step {index + 1}
                  </span>
                  <span className="text-xs font-light tracking-wide">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Form sections */}
      <div className="report-no-print space-y-6">
        {activeStep === "household" ? (
          <section className={panelClass}>
            <h3 className="text-sm font-light tracking-wide text-[#F3F1EA]">
              Household Information
            </h3>
            <div className="mt-5">
              <FieldGrid>
                <div>
                  <FinancialTextInput
                    id="householdName"
                    label="Household Name"
                    value={draft.household.householdName}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        household: { ...current.household, householdName: value },
                      }))
                    }
                  />
                  <FieldError message={fieldErrors["household.householdName"]} />
                </div>
                <div>
                  <FinancialTextInput
                    id="primaryContact"
                    label="Primary Contact"
                    value={draft.household.primaryContact}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        household: { ...current.household, primaryContact: value },
                      }))
                    }
                  />
                  <FieldError message={fieldErrors["household.primaryContact"]} />
                </div>
                <div>
                  <FinancialTextInput
                    id="statementPeriod"
                    label="Statement Period"
                    placeholder="e.g. May 2026"
                    value={draft.household.statementPeriod}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        household: { ...current.household, statementPeriod: value },
                      }))
                    }
                  />
                  <FieldError message={fieldErrors["household.statementPeriod"]} />
                </div>
                <div>
                  <FinancialTextInput
                    id="adviserName"
                    label="Adviser Name"
                    value={draft.household.adviserName}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        household: { ...current.household, adviserName: value },
                      }))
                    }
                  />
                  <FieldError message={fieldErrors["household.adviserName"]} />
                </div>
                <div className="sm:col-span-2">
                  <FinancialTextInput
                    id="adviserCompany"
                    label="Adviser Company"
                    value={draft.household.adviserCompany}
                    onChange={(value) =>
                      updateDraft((current) => ({
                        ...current,
                        household: { ...current.household, adviserCompany: value },
                      }))
                    }
                  />
                  <FieldError message={fieldErrors["household.adviserCompany"]} />
                </div>
              </FieldGrid>
            </div>
          </section>
        ) : null}

        {activeStep === "people" ? (
          <section className="space-y-4">
            {draft.insuredPersons.map((person, index) => {
              const deleteBlock = getPersonDeleteBlockReason(draft, person.id);
              return (
                <div key={person.id} className={panelClass}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-light text-[#F3F1EA]">
                      Insured Person {index + 1}
                    </h3>
                    <button
                      type="button"
                      disabled={Boolean(deleteBlock) || draft.insuredPersons.length <= 1}
                      title={deleteBlock ?? undefined}
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          insuredPersons: current.insuredPersons.filter(
                            (item) => item.id !== person.id
                          ),
                        }))
                      }
                      className={`${buttonSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      Remove
                    </button>
                  </div>
                  {deleteBlock ? <FieldError message={deleteBlock} /> : null}
                  <FieldGrid>
                    <div>
                      <FinancialTextInput
                        id={`person-name-${person.id}`}
                        label="Full Name"
                        value={person.fullName}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            insuredPersons: current.insuredPersons.map((item) =>
                              item.id === person.id ? { ...item, fullName: value } : item
                            ),
                          }))
                        }
                      />
                      <FieldError message={fieldErrors[`person.${person.id}.fullName`]} />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`person-rel-${person.id}`}
                        label="Relationship"
                        placeholder="e.g. Self, Spouse, Son"
                        value={person.relationship}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            insuredPersons: current.insuredPersons.map((item) =>
                              item.id === person.id
                                ? { ...item, relationship: value }
                                : item
                            ),
                          }))
                        }
                      />
                      <FieldError
                        message={fieldErrors[`person.${person.id}.relationship`]}
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`person-age-${person.id}`}
                        label="Age"
                        type="number"
                        min={0}
                        value={person.age}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            insuredPersons: current.insuredPersons.map((item) =>
                              item.id === person.id ? { ...item, age: value } : item
                            ),
                          }))
                        }
                      />
                      <FieldError message={fieldErrors[`person.${person.id}.age`]} />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`person-notes-${person.id}`}
                        label="Health Notes"
                        value={person.healthNotes}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            insuredPersons: current.insuredPersons.map((item) =>
                              item.id === person.id
                                ? { ...item, healthNotes: value }
                                : item
                            ),
                          }))
                        }
                      />
                    </div>
                  </FieldGrid>
                </div>
              );
            })}
            <button
              type="button"
              className={buttonSecondary}
              onClick={() =>
                updateDraft((current) => ({
                  ...current,
                  insuredPersons: [
                    ...current.insuredPersons,
                    {
                      id: generateEntityId("person"),
                      fullName: "",
                      relationship: "",
                      age: "",
                      healthNotes: "",
                    },
                  ],
                }))
              }
            >
              + Add Insured Person
            </button>
          </section>
        ) : null}

        {activeStep === "policies" ? (
          <section className="space-y-4">
            {draft.policies.map((policy, index) => {
              const deleteBlock = getPolicyDeleteBlockReason(draft, policy.id);
              const personOptions = draft.insuredPersons.map((person) => ({
                value: person.id,
                label: person.fullName || "Unnamed person",
              }));

              return (
                <div key={policy.id} className={panelClass}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-light text-[#F3F1EA]">
                      Policy {index + 1}
                    </h3>
                    <button
                      type="button"
                      disabled={Boolean(deleteBlock) || draft.policies.length <= 1}
                      title={deleteBlock ?? undefined}
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          policies: current.policies.filter((item) => item.id !== policy.id),
                        }))
                      }
                      className={`${buttonSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      Remove
                    </button>
                  </div>
                  {deleteBlock ? <FieldError message={deleteBlock} /> : null}
                  <FieldGrid>
                    <div>
                      <FinancialSelect
                        id={`policy-person-${policy.id}`}
                        label="Insured Person"
                        value={policy.insuredPersonId}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, insuredPersonId: value }
                                : item
                            ),
                          }))
                        }
                        options={personOptions}
                        placeholder="Select insured person"
                      />
                      <FieldError
                        message={fieldErrors[`policy.${policy.id}.insuredPersonId`]}
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-plan-${policy.id}`}
                        label="Plan Name"
                        value={policy.planName}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id ? { ...item, planName: value } : item
                            ),
                          }))
                        }
                      />
                      <FieldError message={fieldErrors[`policy.${policy.id}.planName`]} />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-insurer-${policy.id}`}
                        label="Insurer"
                        value={policy.insurer}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id ? { ...item, insurer: value } : item
                            ),
                          }))
                        }
                      />
                      <FieldError message={fieldErrors[`policy.${policy.id}.insurer`]} />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-type-${policy.id}`}
                        label="Policy Type"
                        placeholder="e.g. Whole Life, ILP, Endowment"
                        value={policy.policyType}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id ? { ...item, policyType: value } : item
                            ),
                          }))
                        }
                      />
                      <FieldError message={fieldErrors[`policy.${policy.id}.policyType`]} />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-number-${policy.id}`}
                        label="Policy Number"
                        value={policy.policyNumber}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, policyNumber: value }
                                : item
                            ),
                          }))
                        }
                      />
                      <FieldError
                        message={fieldErrors[`policy.${policy.id}.policyNumber`]}
                      />
                    </div>
                    <div>
                      <FinancialCheckbox
                        id={`policy-nonnumeric-${policy.id}`}
                        label="Non-numeric sum assured (e.g. As charged)"
                        checked={policy.useNonNumericSumAssured}
                        onChange={(checked) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, useNonNumericSumAssured: checked }
                                : item
                            ),
                          }))
                        }
                      />
                    </div>
                    {policy.useNonNumericSumAssured ? (
                      <div>
                        <FinancialTextInput
                          id={`policy-label-${policy.id}`}
                          label="Sum Assured Label"
                          value={policy.sumAssuredLabel}
                          onChange={(value) =>
                            updateDraft((current) => ({
                              ...current,
                              policies: current.policies.map((item) =>
                                item.id === policy.id
                                  ? { ...item, sumAssuredLabel: value }
                                  : item
                              ),
                            }))
                          }
                        />
                        <FieldError
                          message={fieldErrors[`policy.${policy.id}.sumAssuredLabel`]}
                        />
                      </div>
                    ) : (
                      <div>
                        <FinancialTextInput
                          id={`policy-sum-${policy.id}`}
                          label="Sum Assured"
                          type="number"
                          prefix="S$"
                          min={0}
                          value={policy.sumAssured}
                          onChange={(value) =>
                            updateDraft((current) => ({
                              ...current,
                              policies: current.policies.map((item) =>
                                item.id === policy.id
                                  ? { ...item, sumAssured: value }
                                  : item
                              ),
                            }))
                          }
                        />
                        <FieldError
                          message={fieldErrors[`policy.${policy.id}.sumAssured`]}
                        />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <FinancialTextInput
                        id={`policy-covers-${policy.id}`}
                        label="What It Covers"
                        value={policy.whatItCovers}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, whatItCovers: value }
                                : item
                            ),
                          }))
                        }
                      />
                      <FieldError
                        message={fieldErrors[`policy.${policy.id}.whatItCovers`]}
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-monthly-${policy.id}`}
                        label="Monthly Premium"
                        type="number"
                        prefix="S$"
                        min={0}
                        value={policy.monthlyPremium}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, monthlyPremium: value }
                                : item
                            ),
                          }))
                        }
                      />
                      <FieldError
                        message={fieldErrors[`policy.${policy.id}.monthlyPremium`]}
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-value-${policy.id}`}
                        label="Current Value"
                        type="number"
                        prefix="S$"
                        min={0}
                        value={policy.currentValue}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, currentValue: value }
                                : item
                            ),
                          }))
                        }
                      />
                      <FieldError
                        message={fieldErrors[`policy.${policy.id}.currentValue`]}
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-paid-${policy.id}`}
                        label="Paid to Date"
                        type="number"
                        prefix="S$"
                        min={0}
                        value={policy.paidToDate}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, paidToDate: value }
                                : item
                            ),
                          }))
                        }
                      />
                      <FieldError
                        message={fieldErrors[`policy.${policy.id}.paidToDate`]}
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-premium-term-${policy.id}`}
                        label="Premium Term"
                        value={policy.premiumTerm}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, premiumTerm: value }
                                : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-term-${policy.id}`}
                        label="Policy Term"
                        value={policy.policyTerm}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, policyTerm: value }
                                : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-start-${policy.id}`}
                        label="Policy Start"
                        value={policy.policyStart}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, policyStart: value }
                                : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-beneficiary-${policy.id}`}
                        label="Beneficiary"
                        value={policy.beneficiary}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, beneficiary: value }
                                : item
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`policy-projected-${policy.id}`}
                        label="Projected Value"
                        value={policy.projectedValue}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            policies: current.policies.map((item) =>
                              item.id === policy.id
                                ? { ...item, projectedValue: value }
                                : item
                            ),
                          }))
                        }
                      />
                    </div>
                  </FieldGrid>
                </div>
              );
            })}
            <button
              type="button"
              className={buttonSecondary}
              onClick={() =>
                updateDraft((current) => ({
                  ...current,
                  policies: [
                    ...current.policies,
                    {
                      id: generateEntityId("policy"),
                      insuredPersonId: current.insuredPersons[0]?.id ?? "",
                      planName: "",
                      insurer: "",
                      policyType: "",
                      policyNumber: "",
                      sumAssured: "",
                      useNonNumericSumAssured: false,
                      sumAssuredLabel: "As charged",
                      whatItCovers: "",
                      monthlyPremium: "",
                      currentValue: "",
                      paidToDate: "",
                      premiumTerm: "",
                      policyTerm: "",
                      policyStart: "",
                      beneficiary: "",
                      projectedValue: "",
                    },
                  ],
                }))
              }
            >
              + Add Policy
            </button>
          </section>
        ) : null}

        {activeStep === "funds" ? (
          <section className="space-y-4">
            {ilpPolicies.length === 0 ? (
              <div className={panelClass}>
                <p className="text-sm font-light text-[#F3F1EA]/60">
                  No ILP policies defined yet. Add a policy with type containing
                  &ldquo;ILP&rdquo; to allocate investment funds.
                </p>
              </div>
            ) : null}

            {draft.investmentFunds.map((fund, index) => {
              const ilpOptions = ilpPolicies.map((policy) => ({
                value: policy.id,
                label: policy.planName || `Policy ${policy.id}`,
              }));

              return (
                <div key={fund.id} className={panelClass}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-light text-[#F3F1EA]">
                      Investment Fund {index + 1}
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft((current) => ({
                          ...current,
                          investmentFunds: current.investmentFunds.filter(
                            (item) => item.id !== fund.id
                          ),
                        }))
                      }
                      className={buttonSecondary}
                    >
                      Remove
                    </button>
                  </div>
                  <FieldGrid>
                    <div>
                      <FinancialSelect
                        id={`fund-policy-${fund.id}`}
                        label="ILP Policy"
                        value={fund.policyId}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            investmentFunds: current.investmentFunds.map((item) =>
                              item.id === fund.id ? { ...item, policyId: value } : item
                            ),
                          }))
                        }
                        options={ilpOptions}
                        placeholder="Select ILP policy"
                      />
                      <FieldError message={fieldErrors[`fund.${fund.id}.policyId`]} />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`fund-name-${fund.id}`}
                        label="Fund Name"
                        value={fund.fundName}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            investmentFunds: current.investmentFunds.map((item) =>
                              item.id === fund.id ? { ...item, fundName: value } : item
                            ),
                          }))
                        }
                      />
                      <FieldError message={fieldErrors[`fund.${fund.id}.fundName`]} />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`fund-alloc-${fund.id}`}
                        label="Allocation %"
                        type="number"
                        min={0}
                        max={100}
                        value={fund.allocationPercent}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            investmentFunds: current.investmentFunds.map((item) =>
                              item.id === fund.id
                                ? { ...item, allocationPercent: value }
                                : item
                            ),
                          }))
                        }
                      />
                      <FieldError
                        message={fieldErrors[`fund.${fund.id}.allocationPercent`]}
                      />
                    </div>
                    <div>
                      <FinancialTextInput
                        id={`fund-value-${fund.id}`}
                        label="Current Value"
                        type="number"
                        prefix="S$"
                        min={0}
                        value={fund.currentValue}
                        onChange={(value) =>
                          updateDraft((current) => ({
                            ...current,
                            investmentFunds: current.investmentFunds.map((item) =>
                              item.id === fund.id ? { ...item, currentValue: value } : item
                            ),
                          }))
                        }
                      />
                      <FieldError
                        message={fieldErrors[`fund.${fund.id}.currentValue`]}
                      />
                    </div>
                  </FieldGrid>
                </div>
              );
            })}

            {ilpPolicies.length > 0 ? (
              <button
                type="button"
                className={buttonSecondary}
                onClick={() =>
                  updateDraft((current) => ({
                    ...current,
                    investmentFunds: [
                      ...current.investmentFunds,
                      {
                        id: generateEntityId("fund"),
                        policyId: ilpPolicies[0]?.id ?? "",
                        fundName: "",
                        allocationPercent: "",
                        currentValue: "",
                      },
                    ],
                  }))
                }
              >
                + Add Investment Fund
              </button>
            ) : null}

            {ilpAllocationPreview ? (
              <div className={panelClass}>
                <p className={labelClass}>ILP Allocation Check</p>
                <ul className="mt-3 space-y-2">
                  {ilpAllocationPreview.policyResults.map((result) => {
                    const policy = draft.policies.find(
                      (item) => item.id === result.policyId
                    );
                    return (
                      <li
                        key={result.policyId}
                        className={`text-sm font-light ${
                          result.isValid ? "text-emerald-300/85" : "text-red-300/90"
                        }`}
                      >
                        {policy?.planName ?? result.policyId}:{" "}
                        {result.totalPercent.toFixed(1)}%
                        {result.isValid ? " ✓" : " — must total 100%"}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeStep === "review" ? (
          <section className={panelClass}>
            <h3 className="text-sm font-light tracking-wide text-[#F3F1EA]">
              Review & Generate
            </h3>
            <p className="mt-2 text-sm font-light text-[#F3F1EA]/55">
              Validate your entries, preview the report, then print or save as PDF
              from your browser.
            </p>

            {reportInput ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(() => {
                  const summary = summarizeProtectionReport(reportInput);
                  return (
                    <>
                      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/50 px-4 py-3">
                        <p className={labelClass}>Coverage</p>
                        <p className="mt-1 font-mono text-lg text-[#F3F1EA]">
                          S${(summary.coverageInForce / 1_000_000).toFixed(2)}M
                        </p>
                      </div>
                      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/50 px-4 py-3">
                        <p className={labelClass}>Policies</p>
                        <p className="mt-1 font-mono text-lg text-[#F3F1EA]">
                          {summary.policyCount}
                        </p>
                      </div>
                      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/50 px-4 py-3">
                        <p className={labelClass}>Monthly Premium</p>
                        <p className="mt-1 font-mono text-lg text-[#F3F1EA]">
                          S${summary.monthlyPremium.toLocaleString()}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}

            {validationAttempted && !validation.validation.isValid ? (
              <div className="mt-5 rounded-sm border border-red-400/20 bg-red-950/20 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-red-200/80">
                  Validation Issues
                </p>
                <ul className="mt-3 space-y-1">
                  {validation.validation.errors.map((error) => (
                    <li key={error} className="text-sm font-light text-red-200/85">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              <div className="max-w-md">
                <FinancialSelect
                  id="vault-client"
                  label="Save to Client Account"
                  value={selectedClientId}
                  onChange={setSelectedClientId}
                  options={clientOptions}
                  placeholder={
                    clientsLoading ? "Loading clients…" : "Select client account"
                  }
                  hint="The generated PDF is stored in this client's Document Vault"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleGeneratePreview} className={buttonPrimary}>
                  Generate Report Preview
                </button>
                {showPreview && reportInput ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handlePrint()}
                      disabled={printing}
                      className={`${buttonPrimary} disabled:cursor-wait disabled:opacity-60`}
                    >
                      {printing ? "Preparing Print…" : "Print / Save as PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveToVault()}
                      disabled={!canSaveToVault}
                      className={`${buttonPrimary} disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      {vaultSaveState === "saving"
                        ? "Saving to Vault…"
                        : "Save to Document Vault"}
                    </button>
                  </>
                ) : null}
              </div>

              {showPreview && reportInput ? (
                <p className="text-xs font-light text-[#F3F1EA]/45">
                  For best PDF output, disable browser Headers and footers in the
                  print dialog.
                </p>
              ) : null}

              {vaultSaveState === "success" && savedVaultDocumentId ? (
                <p className="text-sm font-light text-emerald-300/85">
                  Report saved successfully.{" "}
                  <Link
                    href="/document-vault"
                    className="underline decoration-emerald-300/40 underline-offset-2 hover:text-emerald-200"
                  >
                    View Document Vault
                  </Link>
                </p>
              ) : null}

              {vaultSaveError ? (
                <p className="text-sm font-light text-red-300/90">{vaultSaveError}</p>
              ) : null}

              {!clientsLoading && clientOptions.length === 0 ? (
                <p className="text-xs font-light text-amber-200/75">
                  No assigned client accounts found. Assign a client in Advisor OS
                  before saving to the vault.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Step navigation buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={stepIndex <= 0}
            onClick={() => setActiveStep(FORM_STEPS[stepIndex - 1].id)}
            className={`${buttonSecondary} disabled:opacity-40`}
          >
            Previous
          </button>
          {activeStep !== "review" ? (
            <button
              type="button"
              onClick={() => setActiveStep(FORM_STEPS[stepIndex + 1].id)}
              className={buttonPrimary}
            >
              Next
            </button>
          ) : null}
        </div>
      </div>

      {/* Printable report preview */}
      {showPreview && reportInput ? (
        <div className="protection-report-print-area mt-8 border-t border-[#D1A866]/10 pt-8">
          <div className="report-no-print mb-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#D1A866]/70">
                Report Preview
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveToVault()}
                  disabled={!canSaveToVault}
                  className={`${buttonPrimary} disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  {vaultSaveState === "saving"
                    ? "Saving…"
                    : "Save to Document Vault"}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePrint()}
                  disabled={printing}
                  className={`${buttonPrimary} disabled:cursor-wait disabled:opacity-60`}
                >
                  {printing ? "Preparing Print…" : "Print / Save as PDF"}
                </button>
              </div>
            </div>
            <p className="text-xs font-light text-[#F3F1EA]/45">
              For best PDF output, disable browser Headers and footers in the print
              dialog (uncheck &ldquo;Headers and footers&rdquo; in Chrome/Edge).
            </p>
          </div>
          <ProtectionReportPreview data={reportInput} />
        </div>
      ) : null}
    </div>
  );
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function ProtectionReportClient() {
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/40 px-5 py-8 text-sm font-light text-[#F3F1EA]/50">
        Loading protection report workspace…
      </div>
    );
  }

  return <ProtectionReportClientLoaded />;
}
