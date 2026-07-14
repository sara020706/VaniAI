/**
 * Typed API modules — feature pages must import from here, never use raw
 * axios. Endpoints mirror CONTRACTS.md §7 exactly (base path /api/v1 is set
 * on the shared client).
 */
import { apiClient, clearTokens, getRefreshToken, setTokens } from "@/lib/api-client";
import { downloadBlob } from "@/lib/utils";
import type {
  AtRiskStudent,
  AuthResponse,
  Certification,
  CertificationPayload,
  CompareResponse,
  Dataset,
  Department,
  DepartmentAnalytics,
  Distributions,
  DriftStatus,
  Experiment,
  FacultyAnalytics,
  Hackathon,
  HackathonPayload,
  Internship,
  InternshipPayload,
  InterviewScorePayload,
  InterviewScoreResult,
  ModelVersion,
  MonitoringHealth,
  Page,
  PaginationParams,
  PlacementDashboard,
  Prediction,
  PredictionHistoryItem,
  Project,
  ProjectPayload,
  RegisterPayload,
  ResumeAnalysis,
  SkillAnalytics,
  Student,
  StudentListItem,
  StudentListParams,
  StudentProgress,
  StudentUpdatePayload,
  TrainingStartResponse,
  User,
  UserCreatePayload,
  UserListParams,
  UserUpdatePayload,
} from "@/types";

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    setTokens(data.access_token, data.refresh_token);
    return data;
  },

  async register(payload: RegisterPayload): Promise<User> {
    const { data } = await apiClient.post<User>("/auth/register", payload);
    return data;
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await apiClient.post("/auth/logout", { refresh_token: refreshToken });
      }
    } finally {
      clearTokens();
    }
  },

  async me(): Promise<User> {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  },
};

// ---------------------------------------------------------------------------
// students
// ---------------------------------------------------------------------------

export const studentApi = {
  async getMe(): Promise<Student> {
    const { data } = await apiClient.get<Student>("/students/me");
    return data;
  },

  async updateMe(payload: StudentUpdatePayload): Promise<Student> {
    const { data } = await apiClient.put<Student>("/students/me", payload);
    return data;
  },

  async list(params: StudentListParams = {}): Promise<Page<StudentListItem>> {
    const { data } = await apiClient.get<Page<StudentListItem>>("/students", {
      params,
    });
    return data;
  },

  async get(studentId: number): Promise<Student> {
    const { data } = await apiClient.get<Student>(`/students/${studentId}`);
    return data;
  },

  async progress(studentId: number): Promise<StudentProgress> {
    const { data } = await apiClient.get<StudentProgress>(
      `/students/${studentId}/progress`,
    );
    return data;
  },

  async addProject(payload: ProjectPayload): Promise<Project> {
    const { data } = await apiClient.post<Project>(
      "/students/me/projects",
      payload,
    );
    return data;
  },

  async deleteProject(itemId: number): Promise<void> {
    await apiClient.delete(`/students/me/projects/${itemId}`);
  },

  async addInternship(payload: InternshipPayload): Promise<Internship> {
    const { data } = await apiClient.post<Internship>(
      "/students/me/internships",
      payload,
    );
    return data;
  },

  async deleteInternship(itemId: number): Promise<void> {
    await apiClient.delete(`/students/me/internships/${itemId}`);
  },

  async addCertification(
    payload: CertificationPayload,
  ): Promise<Certification> {
    const { data } = await apiClient.post<Certification>(
      "/students/me/certifications",
      payload,
    );
    return data;
  },

  async deleteCertification(itemId: number): Promise<void> {
    await apiClient.delete(`/students/me/certifications/${itemId}`);
  },

  async addHackathon(payload: HackathonPayload): Promise<Hackathon> {
    const { data } = await apiClient.post<Hackathon>(
      "/students/me/hackathons",
      payload,
    );
    return data;
  },

  async deleteHackathon(itemId: number): Promise<void> {
    await apiClient.delete(`/students/me/hackathons/${itemId}`);
  },
};

// ---------------------------------------------------------------------------
// predictions
// ---------------------------------------------------------------------------

export const predictionApi = {
  async predict(studentId: number): Promise<Prediction> {
    const { data } = await apiClient.post<Prediction>(
      `/predictions/students/${studentId}`,
    );
    return data;
  },

  async latest(studentId: number): Promise<Prediction> {
    const { data } = await apiClient.get<Prediction>(
      `/predictions/students/${studentId}/latest`,
    );
    return data;
  },

  async history(studentId: number): Promise<PredictionHistoryItem[]> {
    const { data } = await apiClient.get<PredictionHistoryItem[]>(
      `/predictions/students/${studentId}/history`,
    );
    return data;
  },
};

// ---------------------------------------------------------------------------
// resume
// ---------------------------------------------------------------------------

export const resumeApi = {
  async upload(file: File): Promise<ResumeAnalysis> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post<ResumeAnalysis>(
      "/resume/upload",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async latest(studentId: number): Promise<ResumeAnalysis> {
    const { data } = await apiClient.get<ResumeAnalysis>(
      `/resume/students/${studentId}/latest`,
    );
    return data;
  },
};

// ---------------------------------------------------------------------------
// faculty
// ---------------------------------------------------------------------------

export const facultyApi = {
  async analytics(
    params: { department?: Department; batch?: string } = {},
  ): Promise<FacultyAnalytics> {
    const { data } = await apiClient.get<FacultyAnalytics>(
      "/faculty/analytics",
      { params },
    );
    return data;
  },

  async compare(studentIds: number[]): Promise<CompareResponse> {
    const { data } = await apiClient.get<CompareResponse>("/faculty/compare", {
      params: { student_ids: studentIds.join(",") },
    });
    return data;
  },

  async submitInterviewScore(
    payload: InterviewScorePayload,
  ): Promise<InterviewScoreResult> {
    const { data } = await apiClient.post<InterviewScoreResult>(
      "/faculty/interview-scores",
      payload,
    );
    return data;
  },
};

// ---------------------------------------------------------------------------
// placement
// ---------------------------------------------------------------------------

export const placementApi = {
  async dashboard(): Promise<PlacementDashboard> {
    const { data } = await apiClient.get<PlacementDashboard>(
      "/placement/dashboard",
    );
    return data;
  },

  async atRisk(
    params: StudentListParams = {},
  ): Promise<Page<AtRiskStudent>> {
    const { data } = await apiClient.get<Page<AtRiskStudent>>(
      "/placement/at-risk",
      { params },
    );
    return data;
  },

  /** Downloads the placement CSV export in the browser. */
  async exportCsv(): Promise<void> {
    const { data } = await apiClient.get<Blob>("/placement/export", {
      responseType: "blob",
    });
    downloadBlob(data, "vaniai_placement_export.csv");
  },
};

// ---------------------------------------------------------------------------
// analytics
// ---------------------------------------------------------------------------

export const analyticsApi = {
  async distributions(): Promise<Distributions> {
    const { data } = await apiClient.get<Distributions>(
      "/analytics/distributions",
    );
    return data;
  },

  async departments(): Promise<DepartmentAnalytics[]> {
    const { data } = await apiClient.get<DepartmentAnalytics[]>(
      "/analytics/departments",
    );
    return data;
  },

  async skills(
    params: { department?: Department } = {},
  ): Promise<SkillAnalytics> {
    const { data } = await apiClient.get<SkillAnalytics>("/analytics/skills", {
      params,
    });
    return data;
  },
};

// ---------------------------------------------------------------------------
// reports (PDF downloads — authenticated blob fetches)
// ---------------------------------------------------------------------------

export const reportApi = {
  studentReportUrl(studentId: number): string {
    return `/api/v1/reports/students/${studentId}`;
  },

  departmentReportUrl(department: Department): string {
    return `/api/v1/reports/department/${department}`;
  },

  placementReportUrl(): string {
    return "/api/v1/reports/placement";
  },

  async downloadStudentReport(studentId: number): Promise<void> {
    const { data } = await apiClient.get<Blob>(
      `/reports/students/${studentId}`,
      { responseType: "blob" },
    );
    downloadBlob(data, `vaniai_student_report_${studentId}.pdf`);
  },

  async downloadDepartmentReport(department: Department): Promise<void> {
    const { data } = await apiClient.get<Blob>(
      `/reports/department/${department}`,
      { responseType: "blob" },
    );
    downloadBlob(data, `vaniai_department_report_${department}.pdf`);
  },

  async downloadPlacementReport(): Promise<void> {
    const { data } = await apiClient.get<Blob>("/reports/placement", {
      responseType: "blob",
    });
    downloadBlob(data, "vaniai_placement_report.pdf");
  },
};

// ---------------------------------------------------------------------------
// admin
// ---------------------------------------------------------------------------

export const adminApi = {
  async listUsers(params: UserListParams = {}): Promise<Page<User>> {
    const { data } = await apiClient.get<Page<User>>("/admin/users", {
      params,
    });
    return data;
  },

  async createUser(payload: UserCreatePayload): Promise<User> {
    const { data } = await apiClient.post<User>("/admin/users", payload);
    return data;
  },

  async updateUser(userId: number, payload: UserUpdatePayload): Promise<User> {
    const { data } = await apiClient.put<User>(
      `/admin/users/${userId}`,
      payload,
    );
    return data;
  },

  async deleteUser(userId: number): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}`);
  },

  async datasets(params: PaginationParams = {}): Promise<Page<Dataset>> {
    const { data } = await apiClient.get<Page<Dataset>>("/admin/datasets", {
      params,
    });
    return data;
  },

  async uploadDataset(file: File, name?: string): Promise<Dataset> {
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);
    const { data } = await apiClient.post<Dataset>(
      "/admin/datasets/upload",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async startTraining(datasetId: number): Promise<TrainingStartResponse> {
    const { data } = await apiClient.post<TrainingStartResponse>(
      "/admin/training/start",
      { dataset_id: datasetId },
    );
    return data;
  },

  async trainingHistory(
    params: PaginationParams = {},
  ): Promise<Page<Experiment>> {
    const { data } = await apiClient.get<Page<Experiment>>(
      "/admin/training/history",
      { params },
    );
    return data;
  },

  async models(): Promise<ModelVersion[]> {
    const { data } = await apiClient.get<ModelVersion[]>("/admin/models");
    return data;
  },

  async deployModel(version: string): Promise<ModelVersion> {
    const { data } = await apiClient.post<ModelVersion>(
      `/admin/models/${version}/deploy`,
    );
    return data;
  },

  async triggerRetraining(): Promise<TrainingStartResponse> {
    const { data } = await apiClient.post<TrainingStartResponse>(
      "/admin/retraining/trigger",
    );
    return data;
  },

  async monitoringHealth(): Promise<MonitoringHealth> {
    const { data } = await apiClient.get<MonitoringHealth>(
      "/monitoring/health",
    );
    return data;
  },

  async drift(): Promise<DriftStatus> {
    const { data } = await apiClient.get<DriftStatus>("/monitoring/drift");
    return data;
  },

  async runDrift(): Promise<DriftStatus> {
    const { data } = await apiClient.post<DriftStatus>("/monitoring/drift/run");
    return data;
  },
};
