/**
 * Business rules you may want to edit. Everything else is read from the sheet.
 * Keys are item names lowercased with only letters/digits (see norm()).
 */
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Items that take several files. Each gets its own sub-folder. Matched with "starts with". */
export const MULTI_FILE_PREFIXES = [
  "opsagenda", "ldainference", "expsettinginference", "flightticket", "ipsagenda",
  "expsettingemail", "alignmentspace", "agendafordswop", "checkpointproof",
  "testimonial", "documentationduring", "assistedphoto", "pickupphoto",
];

/**
 * Realization item -> Preparation-tab row that holds the SAME file.
 * (Derived from your sheet: these pairs already point at identical Drive files.)
 * One upload fills both tabs.
 */
export const PREP_MAP: Record<string, string> = {
  passport: "passport",
  acceptancenotebyhostentity: "acceptancenote",
  contractorloawithhomeentity: "epcontract",
  epcontract: "epcontract",
  jddetailsoncontract: "epcontract",
  epsvisa: "visa",
  parentspermissionletter: "parentspermissionletter",
  invitationletter: "invitationletter",
  epsinsurance: "insurancepolicy",
};

/** Items that are literally the same document: uploading one fills all of them. */
export const ALIAS_GROUPS: string[][] = [
  ["contractorloawithhomeentity", "epcontract", "jddetailsoncontract"],
];

/** Preparation-tab rows that are not file slots. */
export const PREP_IGNORE = ["insurancetype"];

/** New uploads go into this sub-folder of each EP's existing folder, so they never mix with EPM-made folders. "" = directly in the EP folder. */
export const APP_SUBFOLDER = "QA Hub";
