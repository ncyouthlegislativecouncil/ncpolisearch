const BASE_URL = "https://api.legiscan.com/";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type LegiScanStatus = "OK" | "ERROR";

interface LegiScanErrorResponse {
  status: "ERROR";
  alert: { message: string };
}

interface LegiScanBaseResponse {
  status: LegiScanStatus;
}

// ---------------------------------------------------------------------------
// getSessionList
// ---------------------------------------------------------------------------

export interface Session {
  session_id: number;
  state_id: number;
  year_start: number;
  year_end: number;
  prefile: number;
  sine_die: number;
  prior: number;
  special: number;
  session_tag: string;
  session_title: string;
  session_name: string;
  dataset_hash: string;
}

interface GetSessionListResponse extends LegiScanBaseResponse {
  sessions: Session[];
}

// ---------------------------------------------------------------------------
// getMasterListRaw
// ---------------------------------------------------------------------------

export interface MasterListRawBill {
  bill_id: number;
  number: string;
  change_hash: string;
  url: string;
  status_date: string;
  status: number;
  last_action_date: string;
  last_action: string;
  title: string;
  description: string;
}

export interface MasterListRawSession {
  session_id: number;
  state_id: number;
  year_start: number;
  year_end: number;
  prefile: number;
  sine_die: number;
  prior: number;
  special: number;
  session_tag: string;
  session_title: string;
  session_name: string;
}

export interface MasterListRaw {
  session: MasterListRawSession;
  [index: string]: MasterListRawBill | MasterListRawSession;
}

interface GetMasterListRawResponse extends LegiScanBaseResponse {
  masterlist: MasterListRaw;
}

// ---------------------------------------------------------------------------
// getBill
// ---------------------------------------------------------------------------

export interface BillSponsor {
  people_id: number;
  person_hash: string;
  party_id: string;
  party: string;
  role_id: number;
  role: string;
  name: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  district: string;
  sponsor_type_id: number;
  sponsor_order: number;
  committee_sponsor: number;
  committee_id: number;
}

export interface BillHistoryAction {
  date: string;
  action: string;
  chamber: string;
  chamber_id: number;
  importance: number;
}

export interface BillProgress {
  date: string;
  event: number;
}

export interface BillReference {
  bill_id: number;
  number: string;
}

export interface BillTextDocument {
  doc_id: number;
  date: string;
  type: string;
  type_id: number;
  mime: string;
  mime_id: number;
  url: string;
  state_link: string;
  text_size: number;
  text_hash: string;
}

// Summary of a roll call as it appears in a bill's `votes` array.
export interface BillVoteSummary {
  roll_call_id: number;
  date: string;
  desc: string;
  yea: number;
  nay: number;
  nv: number;
  absent: number;
  total: number;
  passed: number;
  chamber: string;
  chamber_id: number;
  url: string;
  state_link: string;
}

export interface Bill {
  bill_id: number;
  change_hash: string;
  session_id: number;
  session: MasterListRawSession;
  url: string;
  state_link: string;
  completed: number;
  status: number;
  status_date: string;
  progress: BillProgress[];
  state: string;
  state_id: number;
  bill_number: string;
  bill_type: string;
  bill_type_id: string;
  body: string;
  body_id: number;
  current_body: string;
  current_body_id: number;
  title: string;
  description: string;
  pending_committee_id: number;
  committee: Record<string, unknown>;
  referrals: unknown[];
  history: BillHistoryAction[];
  sponsors: BillSponsor[];
  sasts: unknown[];
  subjects: { subject_id: number; subject_name: string }[];
  texts: BillTextDocument[];
  votes: BillVoteSummary[];
  amendments: unknown[];
  supplements: unknown[];
  calendar: unknown[];
}

interface GetBillResponse extends LegiScanBaseResponse {
  bill: Bill;
}

// ---------------------------------------------------------------------------
// getBillText
// ---------------------------------------------------------------------------

export interface BillTextDoc {
  doc_id: number;
  bill_id: number;
  date: string;
  type: string;
  type_id: number;
  mime: string;
  mime_id: number;
  text_size: number;
  text_hash: string;
  // Base64-encoded document body (PDF, HTML, etc. per `mime`).
  doc: string;
}

interface GetBillTextResponse extends LegiScanBaseResponse {
  text: BillTextDoc;
}

// ---------------------------------------------------------------------------
// getRollCall
// ---------------------------------------------------------------------------

export interface RollCallVote {
  people_id: number;
  vote_id: number;
  vote_text: string;
}

export interface RollCall {
  roll_call_id: number;
  bill_id: number;
  date: string;
  desc: string;
  yea: number;
  nay: number;
  nv: number;
  absent: number;
  total: number;
  passed: number;
  chamber: string;
  chamber_id: number;
  url: string;
  state_link: string;
  votes: RollCallVote[];
}

interface GetRollCallResponse extends LegiScanBaseResponse {
  roll_call: RollCall;
}

// ---------------------------------------------------------------------------
// getDatasetList
// ---------------------------------------------------------------------------

export interface DatasetListItem {
  state_id: number;
  session_id: number;
  special: number;
  year_start: number;
  year_end: number;
  session_name: string;
  session_title: string;
  dataset_hash: string;
  dataset_date: string;
  dataset_size: number;
  access_key: string;
}

interface GetDatasetListResponse extends LegiScanBaseResponse {
  datasetlist: DatasetListItem[];
}

// ---------------------------------------------------------------------------
// getDataset
// ---------------------------------------------------------------------------

export interface Dataset {
  state_id: number;
  session_id: number;
  session_name: string;
  dataset_hash: string;
  dataset_date: string;
  dataset_size: number;
  mime: string;
  zip: string;
}

interface GetDatasetResponse extends LegiScanBaseResponse {
  dataset: Dataset;
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.LEGISCAN_API_KEY;
  if (!key) {
    throw new Error(
      "LEGISCAN_API_KEY is not set. Add it to your environment (.env.local)."
    );
  }
  return key;
}

async function request<T extends LegiScanBaseResponse>(
  op: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const url = new URL(BASE_URL);
  url.searchParams.set("key", getApiKey());
  url.searchParams.set("op", op);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, String(value));
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`LegiScan ${op} HTTP ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as T | LegiScanErrorResponse;

  if (data.status === "ERROR") {
    const message = (data as LegiScanErrorResponse).alert?.message ?? "unknown error";
    throw new Error(`LegiScan ${op} returned ERROR: ${message}`);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getSessionList(state: string): Promise<Session[]> {
  const data = await request<GetSessionListResponse>("getSessionList", { state });
  return data.sessions;
}

export async function getMasterListRaw(sessionId: number): Promise<MasterListRaw> {
  const data = await request<GetMasterListRawResponse>("getMasterListRaw", {
    id: sessionId,
  });
  return data.masterlist;
}

export async function getBill(billId: number): Promise<Bill> {
  const data = await request<GetBillResponse>("getBill", { id: billId });
  return data.bill;
}

export async function getRollCall(rollCallId: number): Promise<RollCall> {
  const data = await request<GetRollCallResponse>("getRollCall", {
    id: rollCallId,
  });
  return data.roll_call;
}

export async function getBillText(docId: number): Promise<BillTextDoc> {
  const data = await request<GetBillTextResponse>("getBillText", { id: docId });
  return data.text;
}

export async function getDatasetList(state: string): Promise<DatasetListItem[]> {
  const data = await request<GetDatasetListResponse>("getDatasetList", { state });
  return data.datasetlist;
}

export async function getDataset(
  sessionId: number,
  accessKey: string
): Promise<Dataset> {
  const data = await request<GetDatasetResponse>("getDataset", {
    id: sessionId,
    access_key: accessKey,
  });
  return data.dataset;
}
