/**
 * Which QA Hub (tracker) items usually satisfy which audit requirement.
 * These are only SUGGESTIONS that get pre-ticked in the "Fill" dialog; staff can change them.
 * Keys are matched against the requirement + criterion text (lowercase). Values are norm()-ed tracker item labels.
 */
export const AUDIT_SUGGESTIONS: [RegExp, string[]][] = [
  [/insurance/, ["epsinsurance", "insurancepolicy"]],
  [/personal goal/, ["pgsinference"]],
  [/ops|preparation seminar/, ["opsagenda", "invitationemailtoops"]],
  [/debrief/, ["invitationemailtodebrief", "debriefagenda", "npsinference"]],
  [/resumption/, []],
  [/visa/, ["epsvisa", "visaemail"]],
  [/cost|contract/, ["epcontract"]],
  [/expa screenshot/, ["jddetailsonexpa"]],
  [/exchange standard|educat/, ["opsagenda", "epkits"]],
  [/(communicat|response).*(he|host)|host/, ["emailtohostentity"]],
];

/** Monthly-report columns -> tracker items (matched on the column header). */
export const MONTHLY_SUGGESTIONS: [RegExp, string[]][] = [
  [/contract/, ["epcontract"]],
  [/payment|invoice/, ["invoice", "paymentproof"]],
  [/visa/, ["epsvisa", "parentspermissionletter", "invitationletter"]],
  [/es delivery|safety/, ["opsagenda", "epkits"]],
];

export const suggestFor = (rules: [RegExp, string[]][], text: string): string[] => {
  const t = text.toLowerCase();
  const out = new Set<string>();
  for (const [re, labels] of rules) if (re.test(t)) labels.forEach((l) => out.add(l));
  return [...out];
};
