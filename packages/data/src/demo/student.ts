import { emailInDomains, VISITOR, type Access } from "@campusnav/core";
import type { StudentAuth, StudentStatus, VerifyConfirm, VerifyStart } from "../types";
import { DEMO_VERIFY_CODE, demoBundle, demoRoster } from "./dataset";

export interface SyncKV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const KEY = "campusnav.student.v1";

interface Stored {
  universityId: string;
  email: string;
  status: "verified" | "pending";
  departmentId: string;
  year: number;
}

/**
 * Demo verification against the fictional roster. Nothing leaves the device;
 * the "emailed" code is shown on screen. It mirrors the real flow so the UI
 * and tests exercise the same steps, but it proves nothing about anyone.
 */
export class DemoStudentAuth implements StudentAuth {
  private pendingEmail: string | null = null;
  constructor(private readonly kv: SyncKV | null) {}

  private read(): Stored | null {
    try {
      const raw = this.kv?.getItem(KEY);
      return raw ? (JSON.parse(raw) as Stored) : null;
    } catch {
      return null;
    }
  }
  private write(v: Stored | null) {
    try {
      if (v) this.kv?.setItem(KEY, JSON.stringify(v));
      else this.kv?.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
  }

  async status(universityId: string): Promise<StudentStatus> {
    const s = this.read();
    if (!s || s.universityId !== universityId) return { access: VISITOR };
    if (s.status === "pending") return { access: VISITOR, email: s.email, pending: { departmentId: s.departmentId, year: s.year } };
    const access: Access = { kind: "student", departmentId: s.departmentId, year: s.year };
    return { access, email: s.email };
  }

  async start(universityId: string, email: string): Promise<VerifyStart> {
    const domains = demoBundle().university.settings.studentEmailDomains ?? [];
    if (!emailInDomains(email, domains)) return { status: "domain_not_allowed", domains };
    this.pendingEmail = email.trim().toLowerCase();
    void universityId;
    return { status: "demo", code: DEMO_VERIFY_CODE };
  }

  async confirm(universityId: string, email: string, code: string): Promise<VerifyConfirm> {
    const e = email.trim().toLowerCase();
    if (code.trim() !== DEMO_VERIFY_CODE || (this.pendingEmail && this.pendingEmail !== e)) return { status: "invalid_code" };
    this.pendingEmail = e;
    const hit = demoRoster.find((r) => r.email === e);
    if (!hit) return { status: "not_on_roster" };
    this.write({ universityId, email: e, status: "verified", departmentId: hit.departmentId, year: hit.year });
    return { status: "verified", departmentId: hit.departmentId, year: hit.year };
  }

  async request(universityId: string, departmentId: string, year: number): Promise<VerifyConfirm> {
    if (!this.pendingEmail) return { status: "error", message: "verify_email_first" };
    // Demo mode has no staff to approve, so the request stays pending.
    this.write({ universityId, email: this.pendingEmail, status: "pending", departmentId, year });
    return { status: "pending", departmentId, year };
  }

  async signOut(): Promise<void> {
    this.pendingEmail = null;
    this.write(null);
  }
}
