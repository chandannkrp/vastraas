import { api } from "./api";

export type StageStatus = "pending" | "running" | "done" | "failed";

export interface StageState {
  key: string;
  label: string;
  status: StageStatus;
  detail: string;
}

export interface PipelineProgress {
  stages: StageState[];
  current: string | null;
  percent: number;
  done: boolean;
  failed: boolean;
  error: string | null;
  tokens: number;
  elapsed_seconds?: number | null;
}

export interface SubmissionListItem {
  id: string;
  title: string | null;
  fabric_type: string | null;
  status: string;
  created_at: string;
  stage: string | null;
  percent: number;
  thumbnail_url: string | null;
}

export interface ImageOut {
  id: string;
  kind: string;
  shot_type: string | null;
  url: string;
}

export interface SubmissionDetail {
  submission: {
    id: string;
    title: string | null;
    fabric_type: string | null;
    status: string;
    created_at: string;
  };
  customization: Record<string, unknown> | null;
  progress: PipelineProgress;
  attributes: Record<string, unknown> | null;
  listing: Record<string, unknown> | null;
  marketing: Record<string, unknown> | null;
  images: ImageOut[];
  shopify_status: string | null;
}

export interface ProductCard {
  submission_id: string;
  title: string;
  fabric_type: string | null;
  status: string;
  shopify_status: string | null;
  thumbnail_url: string | null;
  tags: string[];
  created_at: string;
}

export interface AnalyticsSummary {
  total_submissions: number;
  processing: number;
  ready: number;
  failed: number;
  images_generated: number;
  tokens_used: number;
  by_status: Record<string, number>;
}

export interface ConnectorStatus {
  connected: boolean;
  store_domain: string | null;
  shop_name: string | null;
  detail: string | null;
}

export interface Customization {
  image_shots: string[];
  tone: string;
  audience: string;
  length: string;
  finish?: string;
  dye?: string;
  texture?: string;
  pattern?: string;
  custom_prompt?: string;
  image_quality?: string;
}

export interface ImageModel {
  key: string;
  label: string;
  tokens_per_image: number;
  blurb: string;
  recommended?: boolean;
}

export async function getImageModels(): Promise<ImageModel[]> {
  const { data } = await api.get("/submissions/image-models");
  return data.models ?? [];
}

// --- API calls ---------------------------------------------------------

export async function createSubmission(
  files: File[],
  fields: {
    title?: string;
    fabric_type?: string;
    color?: string;
    price_per_meter?: string;
    width_inches?: string;
    notes?: string;
  },
  customization: Customization,
): Promise<{ id: string }> {
  const form = new FormData();
  files.forEach((f) => form.append("images", f));
  Object.entries(fields).forEach(([k, v]) => {
    if (v) form.append(k, v);
  });
  form.append("customization", JSON.stringify(customization));
  const { data } = await api.post("/submissions", form);
  return data;
}

export async function listSubmissions(): Promise<SubmissionListItem[]> {
  const { data } = await api.get("/submissions");
  return data;
}

export async function getSubmission(id: string): Promise<SubmissionDetail> {
  const { data } = await api.get(`/submissions/${id}`);
  return data;
}

export async function listProducts(): Promise<ProductCard[]> {
  const { data } = await api.get("/products");
  return data;
}

export async function getAnalytics(): Promise<AnalyticsSummary> {
  const { data } = await api.get("/analytics/summary");
  return data;
}

export async function getShopifyStatus(): Promise<ConnectorStatus> {
  const { data } = await api.get("/connectors/shopify");
  return data;
}

export interface ShopifyConnectInput {
  store_domain: string;
  admin_token?: string;
  client_id?: string;
  client_secret?: string;
}

export async function connectShopify(input: ShopifyConnectInput): Promise<ConnectorStatus> {
  const { data } = await api.post("/connectors/shopify", input);
  return data;
}

export async function disconnectShopify(): Promise<void> {
  await api.delete("/connectors/shopify");
}

// --- Tokens ------------------------------------------------------------

export interface DailyPoint {
  date: string;
  tokens: number;
}

export interface TokenSummary {
  limit: number;
  used: number;
  remaining: number;
  percent_used: number;
  daily: DailyPoint[];
}

export async function getTokenSummary(): Promise<TokenSummary> {
  const { data } = await api.get("/tokens/summary");
  return data;
}

export async function topUpTokens(amount: number): Promise<TokenSummary> {
  const { data } = await api.post("/tokens/topup", { amount });
  return data;
}

// --- Admin -------------------------------------------------------------

export interface BusinessRow {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  submissions: number;
  published: number;
  tokens_used: number;
  token_limit: number;
}

export interface GrowthMetrics {
  total_sellers: number;
  new_sellers_7d: number;
  total_submissions: number;
  total_published: number;
  total_tokens: number;
  signups_daily: { date: string; count: number }[];
  submissions_daily: { date: string; count: number }[];
}

export interface SellerLogEntry {
  submission_id: string;
  title: string | null;
  status: string;
  stage: string | null;
  tokens: number;
  created_at: string;
}

export interface BusinessDetail {
  business: BusinessRow;
  logs: SellerLogEntry[];
}

export async function getBusinesses(): Promise<BusinessRow[]> {
  const { data } = await api.get("/admin/sellers");
  return data;
}

export async function getBusinessDetail(id: string): Promise<BusinessDetail> {
  const { data } = await api.get(`/admin/sellers/${id}`);
  return data;
}

export async function getGrowth(): Promise<GrowthMetrics> {
  const { data } = await api.get("/admin/growth");
  return data;
}

// --- Admin: system config, usage, files ---

export interface AdminConfig {
  effective: Record<string, string | null>;
  options: Record<string, string[]>;
}

export async function getAdminConfig(): Promise<AdminConfig> {
  const { data } = await api.get("/admin/config");
  return data;
}

export async function updateAdminConfig(patch: Record<string, string>): Promise<{ effective: Record<string, string | null> }> {
  const { data } = await api.put("/admin/config", patch);
  return data;
}

export interface ModelUsage {
  providers: Record<string, string | null>;
  runs: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  images_generated: number;
  image_tiers: ImageModel[];
}

export async function getModelUsage(): Promise<ModelUsage> {
  const { data } = await api.get("/admin/usage");
  return data;
}

export interface StoredFile {
  key: string;
  size: number;
  last_modified: number;
  url?: string | null;
}

export async function listAdminFiles(prefix = "", limit = 60): Promise<{ files: StoredFile[]; backend: string }> {
  const { data } = await api.get("/admin/files", { params: { prefix, limit } });
  return data;
}

export async function deleteAdminFile(key: string): Promise<void> {
  await api.delete("/admin/files", { data: { key } });
}

// --- Billing / packs ---------------------------------------------------

export interface TokenPack {
  id: string;
  label: string;
  tokens: number;
  amount: number; // paise
  approx_products: number;
  popular?: boolean;
}

export interface PacksResponse {
  packs: TokenPack[];
  currency: string;
  stripe: boolean;
}

export async function getPacks(): Promise<PacksResponse> {
  const { data } = await api.get("/billing/packs");
  return data;
}

export async function checkout(packId: string): Promise<{ mock?: boolean; url?: string; credited?: number }> {
  const { data } = await api.post("/billing/checkout", { pack_id: packId });
  return data;
}

export async function verifyCheckout(sessionId: string): Promise<{ ok: boolean; credited?: number }> {
  const { data } = await api.post("/billing/verify", { session_id: sessionId });
  return data;
}

// --- Product edit / images --------------------------------------------

export async function updateListing(
  submissionId: string,
  payload: { title?: string; description_html?: string; tags?: string[] },
): Promise<SubmissionDetail> {
  const { data } = await api.patch(`/submissions/${submissionId}/listing`, payload);
  return data;
}

export async function regenerateImage(
  submissionId: string,
  body: { shot_type: string; prompt?: string },
): Promise<ImageOut> {
  const { data } = await api.post(`/submissions/${submissionId}/regenerate-image`, body);
  return data;
}

export async function deleteImage(imageId: string): Promise<void> {
  await api.delete(`/images/${imageId}`);
}

export async function selectImage(imageId: string, approved: boolean): Promise<void> {
  await api.post(`/images/${imageId}/select`, { approved });
}

export interface ShopifyCollection {
  id: string;
  title: string;
}

export async function getShopifyCollections(): Promise<ShopifyCollection[]> {
  const { data } = await api.get("/connectors/shopify/collections");
  return data.collections ?? [];
}

export interface PublishPayload {
  title?: string;
  description_html?: string;
  product_type?: string;
  vendor?: string;
  tags?: string[];
  status?: "DRAFT" | "ACTIVE";
  price?: number;
  compare_at_price?: number;
  image_ids?: string[];
  collection_ids?: string[];
  set_contents?: string;
  care?: string;
  gsm?: string;
  width?: string;
  composition?: string;
}

export async function publishToShopify(
  submissionId: string,
  payload: PublishPayload,
): Promise<{ gid: string; admin_url: string; online_url?: string; status: string }> {
  const { data } = await api.post(`/submissions/${submissionId}/publish`, payload);
  return data;
}

export interface SetPublishPayload {
  submission_ids: string[];
  title?: string;
  description_html?: string;
  product_type?: string;
  status?: "DRAFT" | "ACTIVE";
  price?: number;
  compare_at_price?: number;
  tags?: string[];
  collection_ids?: string[];
  set_contents?: string;
  care?: string;
  composition?: string;
}

export async function publishSetToShopify(
  payload: SetPublishPayload,
): Promise<{ gid: string; admin_url: string; online_url?: string; status: string; submission_ids: string[] }> {
  const { data } = await api.post(`/submissions/publish-set`, payload);
  return data;
}

export async function downloadImagesZip(submissionId: string, filename: string): Promise<void> {
  const res = await api.get(`/submissions/${submissionId}/images.zip`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
