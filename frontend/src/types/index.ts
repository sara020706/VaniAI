/**
 * VaniAI shared TypeScript types.
 *
 * These interfaces mirror the backend API response shapes (CONTRACTS.md §7)
 * 1:1 in snake_case — there is intentionally no camelCase mapping layer.
 */

// ---------------------------------------------------------------------------
// Enums / literal unions
// ---------------------------------------------------------------------------

export type Role = "student" | "faculty" | "placement_officer" | "admin";

export type Department = "CSE" | "IT" | "ECE" | "EEE" | "MECH" | "CIVIL";

export type RiskLevel = "low" | "medium" | "high";

export type Priority = "high" | "medium" | "low";

export type ConfidenceLevel = "low" | "medium" | "high";

export type DatasetStatus = "uploaded" | "validated" | "invalid" | "used";

export type ExperimentStatus = "running" | "completed" | "failed";

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  register_number: string;
  department: Department;
  batch: string;
  semester: number;
}

// ---------------------------------------------------------------------------
// Student profile
// ---------------------------------------------------------------------------

export interface Project {
  id: number;
  title: string;
  description: string;
  tech_stack: string;
  url: string | null;
}

export interface Internship {
  id: number;
  company: string;
  role: string;
  duration_months: number;
  description: string | null;
}

export interface Certification {
  id: number;
  name: string;
  issuer: string;
  issued_date: string | null;
  credential_url: string | null;
}

export interface Hackathon {
  id: number;
  name: string;
  position: string | null;
  event_date: string | null;
}

export interface StudentAcademic {
  cgpa: number | null;
  tenth_percentage: number | null;
  twelfth_percentage: number | null;
  attendance_percentage: number | null;
}

export interface StudentSkills {
  coding_score: number | null;
  aptitude_score: number | null;
  communication_score: number | null;
  technical_skill_score: number | null;
  leadership_score: number | null;
}

export interface StudentExperience {
  internship_count: number;
  project_count: number;
  certification_count: number;
  hackathon_count: number;
  projects: Project[];
  internships: Internship[];
  certifications: Certification[];
  hackathons: Hackathon[];
}

export interface StudentProfessional {
  resume_score: number | null;
  mock_interview_score: number | null;
}

export interface Student {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  register_number: string;
  department: Department;
  batch: string;
  semester: number;
  academic: StudentAcademic;
  skills: StudentSkills;
  experience: StudentExperience;
  professional: StudentProfessional;
  latest_prediction: Prediction | null;
}

export interface StudentListItem {
  id: number;
  full_name: string;
  register_number: string;
  department: Department;
  batch: string;
  semester: number;
  cgpa: number | null;
  placement_probability: number | null;
  readiness_overall: number | null;
  risk_level: RiskLevel | null;
}

export interface StudentUpdatePayload {
  full_name?: string;
  department?: Department;
  batch?: string;
  semester?: number;
  cgpa?: number;
  tenth_percentage?: number;
  twelfth_percentage?: number;
  attendance_percentage?: number;
  coding_score?: number;
  aptitude_score?: number;
  communication_score?: number;
  technical_skill_score?: number;
  leadership_score?: number;
}

export interface ProjectPayload {
  title: string;
  description: string;
  tech_stack: string;
  url?: string | null;
}

export interface InternshipPayload {
  company: string;
  role: string;
  duration_months: number;
  description?: string | null;
}

export interface CertificationPayload {
  name: string;
  issuer: string;
  issued_date?: string | null;
  credential_url?: string | null;
}

export interface HackathonPayload {
  name: string;
  position?: string | null;
  event_date?: string | null;
}

// ---------------------------------------------------------------------------
// Progress histories
// ---------------------------------------------------------------------------

export interface AcademicHistoryPoint {
  recorded_at: string;
  cgpa: number;
  attendance_percentage: number;
}

export interface SkillHistoryPoint {
  recorded_at: string;
  coding_score: number;
  aptitude_score: number;
  communication_score: number;
  technical_skill_score: number;
  leadership_score: number;
}

export interface PredictionHistoryPoint {
  created_at: string;
  placement_probability: number;
  readiness_overall: number;
}

export interface StudentProgress {
  academic_history: AcademicHistoryPoint[];
  skill_history: SkillHistoryPoint[];
  prediction_history: PredictionHistoryPoint[];
}

// ---------------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------------

export interface Readiness {
  academic: number;
  technical: number;
  communication: number;
  industry: number;
  overall: number;
}

/**
 * A single explanation factor. SHAP "top" lists carry a signed `impact`;
 * the full `feature_importance` list carries an unsigned `importance`.
 */
export interface ExplanationFactor {
  feature: string;
  label: string;
  impact?: number;
  importance?: number;
}

export interface Explanation {
  top_positive: ExplanationFactor[];
  top_negative: ExplanationFactor[];
  feature_importance: ExplanationFactor[];
}

export interface SkillGap {
  skill: string;
  current: number;
  target: number;
  gap: number;
  severity: Priority;
}

export interface Recommendation {
  id: number;
  category: string;
  priority: Priority;
  text: string;
}

export interface CareerRecommendation {
  role: string;
  match_score: number;
  reasons: string[];
}

export interface Prediction {
  id: number;
  student_id: number;
  model_version: string;
  created_at: string;
  placement_probability: number;
  risk_level: RiskLevel;
  risk_reasons: string[];
  readiness: Readiness;
  explanation: Explanation;
  skill_gaps: SkillGap[];
  recommendations: Recommendation[];
  career_recommendations: CareerRecommendation[];
}

export interface PredictionHistoryItem {
  id: number;
  created_at: string;
  placement_probability: number;
  risk_level: RiskLevel;
  readiness_overall: number;
  model_version: string;
}

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export interface ResumeExtracted {
  skills: string[];
  projects: string[];
  experience: string[];
  education: string[];
}

export interface ResumeAnalysis {
  id: number;
  filename: string;
  resume_score: number;
  ats_score: number;
  extracted: ResumeExtracted;
  missing_sections: string[];
  suggestions: string[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Faculty
// ---------------------------------------------------------------------------

export interface SkillAverages {
  coding: number;
  aptitude: number;
  communication: number;
  technical: number;
  leadership: number;
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
}

export interface FacultyAnalytics {
  student_count: number;
  average_cgpa: number;
  average_readiness: number;
  average_probability: number;
  at_risk_count: number;
  skill_averages: SkillAverages;
  top_performers: StudentListItem[];
  weak_students: StudentListItem[];
  risk_distribution: RiskDistribution;
}

export interface StudentCompareItem extends StudentListItem {
  skills: StudentSkills;
  readiness: Readiness;
}

export interface CompareResponse {
  students: StudentCompareItem[];
}

export interface InterviewScorePayload {
  student_id: number;
  mock_interview_score: number;
  confidence_level: ConfidenceLevel;
  notes?: string;
}

export interface InterviewReadiness {
  score: number;
  confidence_level: ConfidenceLevel;
  suggestions: string[];
}

export interface InterviewScoreResult {
  id: number;
  student_id: number;
  mock_interview_score: number;
  confidence_level: ConfidenceLevel;
  interview_readiness: InterviewReadiness;
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export interface DistributionBucket {
  bucket: string;
  count: number;
}

export interface DepartmentComparisonItem {
  department: Department;
  average_probability: number;
  average_readiness: number;
  student_count: number;
  ready_count: number;
}

export interface TopSkillItem {
  skill: string;
  average: number;
}

export interface WeakSkillItem {
  skill: string;
  students_below_target: number;
}

export interface RiskHeatmapCell {
  department: Department;
  batch: string;
  high_risk_count: number;
  student_count: number;
}

export interface PlacementDashboard {
  total_students: number;
  placement_ready_count: number;
  average_probability: number;
  probability_distribution: DistributionBucket[];
  department_comparison: DepartmentComparisonItem[];
  risk_distribution: RiskDistribution;
  top_skills: TopSkillItem[];
  common_weak_skills: WeakSkillItem[];
  risk_heatmap: RiskHeatmapCell[];
}

export interface AtRiskStudent extends StudentListItem {
  risk_reasons: string[];
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface Distributions {
  probability: DistributionBucket[];
  readiness: DistributionBucket[];
  resume_score: DistributionBucket[];
  risk: RiskDistribution;
}

export interface DepartmentAnalytics {
  department: Department;
  student_count: number;
  average_cgpa: number;
  average_probability: number;
  average_readiness: number;
  ready_count: number;
  at_risk_count: number;
}

export interface SkillDistributionItem {
  skill: string;
  buckets: DistributionBucket[];
}

export interface SkillAnalytics {
  skill_averages: SkillAverages;
  skill_distribution: SkillDistributionItem[];
}

// ---------------------------------------------------------------------------
// Admin — users, datasets, training, models
// ---------------------------------------------------------------------------

export interface UserCreatePayload {
  email: string;
  password: string;
  full_name: string;
  role: Role;
}

export interface UserUpdatePayload {
  full_name?: string;
  role?: Role;
  is_active?: boolean;
  password?: string;
}

export interface Dataset {
  id: number;
  name: string;
  filename: string;
  row_count: number;
  status: DatasetStatus;
  validation_errors: string[] | null;
  created_at: string;
}

export interface Experiment {
  id: number;
  mlflow_run_id: string | null;
  dataset_id: number | null;
  model_type: string;
  params: Record<string, unknown>;
  metrics: Record<string, number> | null;
  status: ExperimentStatus;
  started_at: string;
  finished_at: string | null;
}

export interface ModelVersion {
  id: number;
  version: string;
  model_type: string;
  metrics: Record<string, number>;
  is_active: boolean;
  created_at: string;
}

export interface TrainingStartResponse {
  experiment_id: number;
  status: "running";
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

export interface MonitoringHealth {
  status: string;
  database: boolean;
  model_loaded: boolean;
  model_version: string;
  is_fallback: boolean;
  mlflow_configured: boolean;
  uptime_seconds: number;
}

export interface DataDriftResult {
  data_drift_detected: boolean;
  share_drifted: number;
  drifted_features: string[];
  checked_at: string;
}

export interface PredictionDriftResult {
  psi: number;
  drift_detected: boolean;
  checked_at: string;
}

export interface DriftHistoryItem {
  id: number;
  metric_type: "data_drift" | "prediction_drift" | "system";
  drift_detected: boolean;
  created_at: string;
}

export interface DriftStatus {
  data_drift: DataDriftResult | null;
  prediction_drift: PredictionDriftResult | null;
  history: DriftHistoryItem[];
}

// ---------------------------------------------------------------------------
// Common list query params
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface StudentListParams extends PaginationParams {
  department?: Department;
  batch?: string;
  risk_level?: RiskLevel;
  search?: string;
}

export interface UserListParams extends PaginationParams {
  role?: Role;
  search?: string;
}
