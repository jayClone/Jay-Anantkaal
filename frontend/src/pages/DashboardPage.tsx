import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth.service";
import { taskService } from "../services/task.service";
import type {
  CreateTaskInput,
  Task,
  TaskFilterStatus,
  TaskGuidance,
  TaskPriority,
  TaskStatus,
} from "../types";

type FormState = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "",
};

const filterOptions: Array<{ label: string; value?: TaskFilterStatus }> = [
  { label: "All" },
  { label: "To Do", value: "To Do" },
  { label: "In Progress", value: "In Progress" },
  { label: "Completed", value: "Completed" },
];

const statusLabelMap: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Completed",
};

const priorityToneMap: Record<TaskPriority, string> = {
  HIGH: "bg-rose-100 text-rose-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-emerald-100 text-emerald-700",
};

const extractErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return "Something went wrong. Please try again.";
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "No deadline";
  }

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeFilter, setActiveFilter] = useState<TaskFilterStatus | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [guidanceTask, setGuidanceTask] = useState<Task | null>(null);
  const [guidance, setGuidance] = useState<TaskGuidance | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    void loadTasks(activeFilter);
  }, [activeFilter]);

  const metrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === "DONE").length;
    const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
    const highPriority = tasks.filter((task) => task.priority === "HIGH").length;

    return { total, completed, inProgress, highPriority };
  }, [tasks]);

  async function loadTasks(filter?: TaskFilterStatus) {
    setLoading(true);
    setErrorMessage("");

    try {
      const nextTasks = await taskService.getTasks(filter);
      setTasks(nextTasks);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const resetComposer = () => {
    setSelectedTask(null);
    setForm(emptyForm);
  };

  const startEdit = (task: Task) => {
    setSelectedTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    });
  };

  const updateForm =
    <K extends keyof FormState>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((current) => ({ ...current, [key]: event.target.value as FormState[K] }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const payload: CreateTaskInput = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
    };

    try {
      if (selectedTask) {
        await taskService.updateTask(selectedTask.id, {
          ...payload,
          dueDate: form.dueDate || null,
        });
      } else {
        await taskService.createTask(payload);
      }

      resetComposer();
      await loadTasks(activeFilter);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    setErrorMessage("");

    try {
      await taskService.deleteTask(taskId);
      if (selectedTask?.id === taskId) {
        resetComposer();
      }
      await loadTasks(activeFilter);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    }
  };

  const advanceStatus = async (task: Task) => {
    const nextStatus: TaskStatus =
      task.status === "TODO" ? "IN_PROGRESS" : task.status === "IN_PROGRESS" ? "DONE" : "TODO";

    setErrorMessage("");

    try {
      await taskService.patchTask(task.id, { status: nextStatus });
      await loadTasks(activeFilter);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    }
  };

  const openGuidance = async (task: Task) => {
    setGuidanceTask(task);
    setGuidance(null);
    setGuidanceLoading(true);
    setErrorMessage("");

    try {
      const nextGuidance = await taskService.generateGuidance(task.id);
      setGuidance(nextGuidance);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setGuidanceLoading(false);
    }
  };

  const closeGuidance = () => {
    setGuidanceTask(null);
    setGuidance(null);
    setGuidanceLoading(false);
  };

  const updatePasswordField =
    (key: "currentPassword" | "newPassword" | "confirmPassword") =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordForm((current) => ({ ...current, [key]: event.target.value }));
    };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirm password must match.");
      return;
    }

    setPasswordSubmitting(true);

    try {
      const response = await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMessage(response.message);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      setPasswordError(extractErrorMessage(error));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface lg:pl-72">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(53,37,205,0.12),transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(107,56,212,0.16),transparent_28%),linear-gradient(160deg,#f8f9fa_0%,#f2f4ff_58%,#f8f9fa_100%)]" />

      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-white/50 lg:bg-white/70 lg:px-6 lg:py-8 lg:backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-secondary p-3 text-white shadow-lg shadow-primary/20">
            <SparkIcon />
          </div>
          <div>
            <p className="font-headline text-2xl font-extrabold tracking-tight text-primary">TaskFlow</p>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant/60">
              Ops dashboard
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-3">
          <SidebarTile title="Your workspace" value={user?.name || user?.username || "Task owner"} />
          <SidebarTile title="Email" value={user?.email || "Not available"} subtle />
        </div>

        <div className="mt-10 rounded-[1.75rem] bg-gradient-to-br from-primary to-secondary p-6 text-white shadow-xl shadow-primary/20">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Quick pulse</p>
          <p className="mt-4 font-headline text-4xl font-extrabold">{metrics.total}</p>
          <p className="mt-1 text-sm text-white/80">Tasks inside your current workflow.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
            <div className="rounded-2xl bg-white/15 px-3 py-3">{metrics.completed} done</div>
            <div className="rounded-2xl bg-white/15 px-3 py-3">{metrics.inProgress} active</div>
          </div>
        </div>

        <button
          onClick={logout}
          className="mt-auto rounded-full border border-primary/15 bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-primary transition hover:bg-primary hover:text-white"
        >
          Log Out
        </button>
      </aside>

      <main className="w-full px-5 py-6 sm:px-8 lg:px-10">
        <header className="glass-panel rounded-[2rem] px-6 py-5 shadow-lg shadow-primary/5">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-on-surface-variant/55">
                Task management system
              </p>
              <h1 className="mt-2 font-headline text-4xl font-extrabold tracking-tight text-primary">
                {user?.name ? `Welcome back, ${user.name}` : "Your Task Dashboard"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                Manage work, edit priorities, and keep everything synced with the backend in one clean flow.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Total" value={metrics.total} />
              <MetricCard label="Done" value={metrics.completed} />
              <MetricCard label="Active" value={metrics.inProgress} />
              <MetricCard label="High" value={metrics.highPriority} />
            </div>
          </div>
        </header>

        <section className="mt-8 grid items-start gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="glass-panel rounded-[2rem] p-6 shadow-lg shadow-primary/5">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant/55">
                    Composer
                  </p>
                  <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight">
                    {selectedTask ? "Edit task" : "Create task"}
                  </h2>
                </div>

                {selectedTask ? (
                  <button
                    onClick={resetComposer}
                    className="rounded-full border border-primary/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"
                  >
                    New
                  </button>
                ) : null}
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <Field
                  label="Task title"
                  placeholder="Design recruiter-ready dashboard"
                  value={form.title}
                  onChange={updateForm("title")}
                />
                <TextAreaField
                  label="Description"
                  placeholder="Add acceptance criteria, notes, or implementation details."
                  value={form.description}
                  onChange={updateForm("description")}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Status" value={form.status} onChange={updateForm("status")}>
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Completed</option>
                  </SelectField>
                  <SelectField label="Priority" value={form.priority} onChange={updateForm("priority")}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </SelectField>
                </div>

                <Field
                  label="Due date"
                  type="date"
                  placeholder=""
                  value={form.dueDate}
                  onChange={updateForm("dueDate")}
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-4 text-sm font-bold uppercase tracking-[0.22em] text-white shadow-xl shadow-primary/20 transition hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Saving..." : selectedTask ? "Save Changes" : "Create Task"}
                </button>
              </form>
            </div>

            <div className="glass-panel rounded-[2rem] p-6 shadow-lg shadow-primary/5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant/55">Filters</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {filterOptions.map((filter) => {
                  const isActive = activeFilter === filter.value || (!activeFilter && !filter.value);
                  return (
                    <button
                      key={filter.label}
                      onClick={() => setActiveFilter(filter.value)}
                      className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
                        isActive
                          ? "bg-primary text-white shadow-lg shadow-primary/20"
                          : "bg-white text-on-surface-variant hover:text-primary"
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {errorMessage ? (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : null}
            </div>

            <div className="glass-panel rounded-[2rem] p-6 shadow-lg shadow-primary/5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant/55">Security</p>
              <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                Change password
              </h3>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                If you signed up with Google and do not have a password yet, just set a new one here.
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleChangePassword}>
                {user?.provider === "LOCAL" ? (
                  <Field
                    label="Current password"
                    type="password"
                    placeholder="Enter current password"
                    value={passwordForm.currentPassword}
                    onChange={updatePasswordField("currentPassword")}
                  />
                ) : null}
                <Field
                  label="New password"
                  type="password"
                  placeholder="Enter new password"
                  value={passwordForm.newPassword}
                  onChange={updatePasswordField("newPassword")}
                />
                <Field
                  label="Confirm password"
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordForm.confirmPassword}
                  onChange={updatePasswordField("confirmPassword")}
                />

                {passwordError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {passwordError}
                  </div>
                ) : null}

                {passwordMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {passwordMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="w-full rounded-full border border-primary/15 bg-white px-5 py-4 text-sm font-bold uppercase tracking-[0.22em] text-primary transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {passwordSubmitting ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-5">
            {loading ? (
              <div className="glass-panel rounded-[2rem] p-8 text-center text-sm text-on-surface-variant">
                Loading your tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="glass-panel rounded-[2rem] p-8 text-center">
                <p className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                  No tasks yet
                </p>
                <p className="mt-3 text-sm text-on-surface-variant">
                  Create your first task from the composer and it will appear here instantly.
                </p>
              </div>
            ) : (
              tasks.map((task) => (
                <article
                  key={task.id}
                  className="glass-panel rounded-[2rem] p-6 shadow-lg shadow-primary/5 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${priorityToneMap[task.priority]}`}>
                          {task.priority}
                        </span>
                        <span className="rounded-full bg-primary/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                          {statusLabelMap[task.status]}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                          {task.title}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                          {task.description || "No description added yet."}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                        <span>Due {formatDate(task.dueDate)}</span>
                        <span>Created {formatDate(task.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 md:w-56 md:justify-end">
                      <button
                        onClick={() => void openGuidance(task)}
                        className="rounded-full border border-primary/15 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-primary"
                      >
                        AI Assist
                      </button>
                      <button
                        onClick={() => advanceStatus(task)}
                        className="rounded-full bg-primary px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-primary/20"
                      >
                        Move Status
                      </button>
                      <button
                        onClick={() => startEdit(task)}
                        className="rounded-full border border-primary/15 bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDelete(task.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}

            {guidanceTask ? (
              <section className="glass-panel rounded-[2rem] p-6 shadow-lg shadow-primary/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant/55">
                      AI Assist
                    </p>
                    <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                      {guidanceTask.title}
                    </h3>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      Actionable next steps, risks, and a sharper execution plan for this task.
                    </p>
                  </div>

                  <button
                    onClick={closeGuidance}
                    className="rounded-full border border-primary/15 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary"
                  >
                    Close
                  </button>
                </div>

                {guidanceLoading ? (
                  <div className="mt-6 rounded-[1.5rem] bg-white/80 p-5 text-sm text-on-surface-variant">
                    Generating guidance...
                  </div>
                ) : guidance ? (
                  <div className="mt-6 space-y-5">
                    <div className="rounded-[1.5rem] bg-white/80 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/55">
                        Summary
                      </p>
                      <p className="mt-3 text-sm leading-7 text-on-surface">{guidance.summary}</p>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="rounded-[1.5rem] bg-white/80 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/55">
                          Next Steps
                        </p>
                        <ul className="mt-3 space-y-3">
                          {guidance.nextSteps.map((step, index) => (
                            <li key={`${guidance.id}-step-${index}`} className="flex gap-3 text-sm leading-6 text-on-surface">
                              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                                {index + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-[1.5rem] bg-white/80 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant/55">
                          Risks
                        </p>
                        <ul className="mt-3 space-y-3">
                          {guidance.risks.map((risk, index) => (
                            <li key={`${guidance.id}-risk-${index}`} className="flex gap-3 text-sm leading-6 text-on-surface">
                              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                                !
                              </span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-white/80 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant/65">
                        Generated by {guidance.generatedBy}
                      </p>
                      <button
                        onClick={() => void openGuidance(guidanceTask)}
                        className="rounded-full bg-gradient-to-r from-primary to-secondary px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.4rem] bg-white/85 px-4 py-4 text-center shadow-sm">
      <div className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/65">
        {label}
      </div>
    </div>
  );
}

function SidebarTile({ title, value, subtle = false }: { title: string; value: string; subtle?: boolean }) {
  return (
    <div className={`rounded-[1.6rem] p-4 ${subtle ? "bg-surface-container-low" : "bg-white shadow-sm"}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">{title}</p>
      <p className="mt-2 text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="ml-1 text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant/70">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/60 bg-white/85 px-4 py-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/35 focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="ml-1 text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant/70">
        {label}
      </span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={5}
        className="w-full rounded-[1.6rem] border border-white/60 bg-white/85 px-4 py-4 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/35 focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="ml-1 text-xs font-bold uppercase tracking-[0.22em] text-on-surface-variant/70">
        {label}
      </span>
      <select
        value={value}
        onChange={onChange}
        className="w-full rounded-2xl border border-white/60 bg-white/85 px-4 py-4 text-sm text-on-surface outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
      >
        {children}
      </select>
    </label>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M12 2.5L13.9 8.1L19.5 10L13.9 11.9L12 17.5L10.1 11.9L4.5 10L10.1 8.1L12 2.5Z"
        fill="currentColor"
      />
      <path d="M18.5 16L19.4 18.6L22 19.5L19.4 20.4L18.5 23L17.6 20.4L15 19.5L17.6 18.6L18.5 16Z" fill="currentColor" />
    </svg>
  );
}
