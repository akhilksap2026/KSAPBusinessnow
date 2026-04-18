#!/usr/bin/env node
/**
 * BUSINESSNow Product Documentation PDF Generator
 * Generates a comprehensive PDF with all module screenshots and descriptions
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT = "BUSINESSNow_Product_Documentation.pdf";
const SCREENSHOTS = path.join(__dirname, "screenshots");

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  navy:      "#0F1C2E",
  blue:      "#1E4FC2",
  lightBlue: "#3B82F6",
  accent:    "#F97316",
  green:     "#16A34A",
  red:       "#DC2626",
  yellow:    "#CA8A04",
  gray:      "#6B7280",
  lightGray: "#F3F4F6",
  white:     "#FFFFFF",
  text:      "#111827",
  subtext:   "#374151",
};

// ── Page dimensions (Letter) ──────────────────────────────────────────────────
const W = 612;
const H = 792;
const MARGIN = 48;
const CONTENT_W = W - MARGIN * 2;

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
  info: {
    Title:    "BUSINESSNow — Product Documentation",
    Author:   "KSAP Technologies",
    Subject:  "PSA Platform for Oracle Transportation Management Consulting",
    Keywords: "OTM, PSA, project management, consulting, delivery, resource management",
    Creator:  "BUSINESSNow Documentation Generator",
  },
});

const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

// ── Helpers ───────────────────────────────────────────────────────────────────

function img(name) {
  const p = path.join(SCREENSHOTS, name);
  return fs.existsSync(p) ? p : null;
}

function newPage() {
  doc.addPage();
}

function fillRect(x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

function hRule(y, color = C.lightGray) {
  doc.save().moveTo(MARGIN, y).lineTo(W - MARGIN, y).strokeColor(color).lineWidth(0.5).stroke().restore();
}

function badge(text, x, y, bg, fg = C.white) {
  const pad = 5;
  const tw = doc.widthOfString(text, { fontSize: 7 }) + pad * 2;
  doc.save()
    .roundedRect(x, y - 1, tw, 13, 3)
    .fill(bg)
    .font("Helvetica-Bold").fontSize(7).fillColor(fg)
    .text(text, x + pad, y + 1.5, { lineBreak: false })
    .restore();
  return tw;
}

function sectionHeader(title, subtitle = "") {
  // Background strip
  fillRect(0, 0, W, 72, C.navy);
  fillRect(0, 72, W, 3, C.accent);

  doc.font("Helvetica-Bold").fontSize(22).fillColor(C.white)
     .text(title, MARGIN, 18, { width: CONTENT_W });
  if (subtitle) {
    doc.font("Helvetica").fontSize(10).fillColor("#CBD5E1")
       .text(subtitle, MARGIN, 46, { width: CONTENT_W });
  }
  doc.y = 90;
}

function moduleHeader(number, title, role, description) {
  const TOP = 68;
  fillRect(0, 0, W, TOP, C.navy);
  fillRect(0, TOP, W, 2, C.lightBlue);

  // Module number pill
  doc.save()
     .roundedRect(MARGIN, 14, 28, 28, 4).fill(C.lightBlue).restore();
  doc.font("Helvetica-Bold").fontSize(13).fillColor(C.white)
     .text(String(number).padStart(2, "0"), MARGIN + 4, 22, { lineBreak: false });

  doc.font("Helvetica-Bold").fontSize(16).fillColor(C.white)
     .text(title, MARGIN + 36, 14, { width: CONTENT_W - 36 - 80 });
  doc.font("Helvetica").fontSize(9).fillColor("#94A3B8")
     .text(description, MARGIN + 36, 34, { width: CONTENT_W - 36 - 80 });

  // Role badge top right
  doc.save()
     .roundedRect(W - MARGIN - 80, 14, 80, 16, 8).fill("#1E3A5F").restore();
  doc.font("Helvetica").fontSize(7.5).fillColor("#93C5FD")
     .text(role, W - MARGIN - 76, 19, { width: 72, align: "center", lineBreak: false });

  doc.y = TOP + 10;
}

function screenshot(imgPath, caption, opts = {}) {
  if (!imgPath) return;
  const { fullWidth = true, y: startY } = opts;
  const availH = H - (startY || doc.y) - MARGIN - 40;
  const imgW = fullWidth ? CONTENT_W : CONTENT_W * 0.7;
  const imgX = fullWidth ? MARGIN : MARGIN + (CONTENT_W - imgW) / 2;

  // Shadow rect
  doc.save()
     .rect(imgX + 3, (startY || doc.y) + 3, imgW, Math.min(availH, imgW * 0.5625))
     .fill("#D1D5DB")
     .restore();

  // Border rect
  doc.save()
     .rect(imgX - 1, (startY || doc.y) - 1, imgW + 2, Math.min(availH, imgW * 0.5625) + 2)
     .fill("#E5E7EB")
     .restore();

  doc.image(imgPath, imgX, startY || doc.y, {
    width: imgW,
    height: Math.min(availH, imgW * 0.5625),
    cover: [imgW, Math.min(availH, imgW * 0.5625)],
  });

  const imgBottom = (startY || doc.y) + Math.min(availH, imgW * 0.5625);

  if (caption) {
    doc.font("Helvetica").fontSize(7.5).fillColor(C.gray)
       .text(`▲ ${caption}`, imgX, imgBottom + 4, { width: imgW, align: "center" });
  }
  doc.y = imgBottom + 18;
}

function keyPoints(points, cols = 2) {
  const colW = (CONTENT_W - (cols - 1) * 12) / cols;
  const startY = doc.y;
  const startPage = doc.bufferedPageRange ? doc.bufferedPageRange().start : 0;
  let col = 0;
  let colY = startY;

  points.forEach((pt, i) => {
    const x = MARGIN + col * (colW + 12);
    // Bullet box
    doc.save().rect(x, colY, 4, 4).fill(C.lightBlue).restore();
    doc.font("Helvetica").fontSize(8.5).fillColor(C.subtext)
       .text(pt, x + 8, colY - 0.5, { width: colW - 8 });
    colY += doc.heightOfString(pt, { fontSize: 8.5, width: colW - 8 }) + 6;

    if ((i + 1) % Math.ceil(points.length / cols) === 0 && col < cols - 1) {
      col++;
      colY = startY;
    }
  });
  doc.y = Math.max(doc.y, colY) + 6;
}

function reqTable(reqs) {
  const COL = [MARGIN, MARGIN + 80, MARGIN + 240, MARGIN + 400];
  const HEADS = ["REQ ID", "Requirement", "Priority", "Role"];
  const colW = [80, 160, 80, CONTENT_W - 320];

  // Header
  fillRect(MARGIN, doc.y, CONTENT_W, 18, C.navy);
  HEADS.forEach((h, i) => {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.white)
       .text(h, COL[i] + 4, doc.y + 5, { width: colW[i] - 4, lineBreak: false });
  });
  doc.y += 18;

  reqs.forEach((r, idx) => {
    const rowH = 16;
    fillRect(MARGIN, doc.y, CONTENT_W, rowH, idx % 2 === 0 ? C.white : C.lightGray);
    [r.id, r.desc, r.priority, r.role].forEach((cell, i) => {
      const color = i === 2
        ? (cell === "Must" ? C.red : cell === "Should" ? C.yellow : C.green)
        : C.subtext;
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(7.5).fillColor(color)
         .text(String(cell), COL[i] + 4, doc.y + 4, { width: colW[i] - 4, lineBreak: false });
    });
    doc.y += rowH;
  });
  doc.y += 8;
}

// ─────────────────────────────────────────────────────────────────────────────
//  COVER PAGE
// ─────────────────────────────────────────────────────────────────────────────

fillRect(0, 0, W, H, C.navy);
fillRect(0, H * 0.6, W, H * 0.4, "#0B1526");

// Decorative geometric shapes
doc.save().opacity(0.07)
   .circle(W - 60, 120, 180).fill(C.blue).restore();
doc.save().opacity(0.05)
   .circle(60, H - 80, 140).fill(C.lightBlue).restore();
doc.save().opacity(0.08)
   .rect(0, H * 0.55, W, 3).fill(C.accent).restore();

// Logo icon (rounded square)
doc.save()
   .roundedRect(MARGIN, 72, 56, 56, 12).fill(C.lightBlue).restore();
doc.font("Helvetica-Bold").fontSize(28).fillColor(C.white)
   .text("BN", MARGIN + 10, 88, { lineBreak: false });

// Brand name
doc.font("Helvetica-Bold").fontSize(38).fillColor(C.white)
   .text("BUSINESSNow", MARGIN, 148);
doc.font("Helvetica").fontSize(16).fillColor("#94A3B8")
   .text("DELIVERY COMMAND CENTER", MARGIN, 192);

hRule(228, "#1E3A5F");

doc.font("Helvetica-Bold").fontSize(20).fillColor(C.white)
   .text("Product Documentation", MARGIN, 242);
doc.font("Helvetica").fontSize(11).fillColor("#CBD5E1")
   .text("Comprehensive PSA Platform for Oracle Transportation\nManagement Consulting Firms", MARGIN, 268);

// Stats row
const stats = [
  { n: "11", label: "User Roles" },
  { n: "30+", label: "Modules" },
  { n: "32", label: "DB Tables" },
  { n: "35+", label: "API Routes" },
];
const statW = CONTENT_W / stats.length;
stats.forEach((s, i) => {
  const sx = MARGIN + i * statW;
  doc.font("Helvetica-Bold").fontSize(26).fillColor(C.accent)
     .text(s.n, sx, 330, { width: statW, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#94A3B8")
     .text(s.label, sx, 360, { width: statW, align: "center" });
});

hRule(390, "#1E3A5F");

// Module chips
const chips = [
  "Projects", "Milestones", "Tasks", "Timesheets",
  "Resources", "Capacity", "Finance", "Invoices",
  "Contracts", "Rate Cards", "Portfolio", "Pipeline",
];
let chipX = MARGIN; let chipY = 406;
chips.forEach(chip => {
  const cw = doc.widthOfString(chip, { fontSize: 8 }) + 20;
  if (chipX + cw > W - MARGIN) { chipX = MARGIN; chipY += 22; }
  doc.save().roundedRect(chipX, chipY, cw, 16, 8).fill("#1E3A5F").restore();
  doc.font("Helvetica").fontSize(8).fillColor("#93C5FD")
     .text(chip, chipX + 10, chipY + 3.5, { lineBreak: false });
  chipX += cw + 8;
});

// Bottom info
doc.font("Helvetica-Bold").fontSize(13).fillColor(C.white)
   .text("KSAP Technologies", MARGIN, H - 120);
doc.font("Helvetica").fontSize(9).fillColor("#64748B")
   .text("Oracle Transportation Management Consulting", MARGIN, H - 104);

doc.font("Helvetica").fontSize(9).fillColor("#64748B")
   .text(`Generated: ${new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}`, MARGIN, H - 80)
   .text("Confidential — Internal Use Only", MARGIN, H - 64)
   .text("Version 7.0", W - MARGIN - 60, H - 80, { align: "right" });

// ─────────────────────────────────────────────────────────────────────────────
//  TABLE OF CONTENTS
// ─────────────────────────────────────────────────────────────────────────────
newPage();
sectionHeader("Table of Contents", "BUSINESSNow — Delivery Command Center");

const toc = [
  { num: "01", title: "Platform Overview & Architecture", page: 3 },
  { num: "02", title: "User Roles & Permissions", page: 4 },
  { num: "03", title: "Authentication & Login", page: 5 },
  { num: "04", title: "PM Dashboard — Delivery Workspace", page: 6 },
  { num: "05", title: "Projects — List & Command Center", page: 7 },
  { num: "06", title: "Project Detail — Health & Financials", page: 8 },
  { num: "07", title: "Milestones — Cross-Project Tracking", page: 9 },
  { num: "08", title: "Tasks — Cross-Project Queue", page: 10 },
  { num: "09", title: "Time Logs — Weekly Timesheet", page: 11 },
  { num: "10", title: "Timesheet Approval Workflow", page: 12 },
  { num: "11", title: "Team — Resource Utilization Heatmap", page: 13 },
  { num: "12", title: "Assignments — Cross-Project Staffing", page: 14 },
  { num: "13", title: "Staffing Requests", page: 15 },
  { num: "14", title: "Capacity Forecast", page: 16 },
  { num: "15", title: "Customers (Accounts)", page: 17 },
  { num: "16", title: "Customer Detail — Health & Invoice Summary", page: 18 },
  { num: "17", title: "Prospects Pipeline", page: 19 },
  { num: "18", title: "Opportunity Pipeline", page: 20 },
  { num: "19", title: "Finance — WIP, Receivables & Margins", page: 21 },
  { num: "20", title: "Invoices — Kanban & Aging", page: 22 },
  { num: "21", title: "Rate Cards", page: 23 },
  { num: "22", title: "Change Orders", page: 24 },
  { num: "23", title: "Contract Manager", page: 25 },
  { num: "24", title: "Executive Portfolio View", page: 26 },
  { num: "25", title: "Project Blueprints (Templates)", page: 27 },
  { num: "26", title: "Admin Dashboard — Portfolio Command Center", page: 28 },
  { num: "27", title: "System Admin Panel", page: 29 },
  { num: "28", title: "Database Schema Overview", page: 30 },
  { num: "29", title: "API Reference", page: 31 },
  { num: "30", title: "End-to-End Process Flow", page: 32 },
];

toc.forEach((item, i) => {
  const y = doc.y;
  if (y > H - 80) { newPage(); doc.y = MARGIN + 10; }
  const isEven = i % 2 === 0;
  if (isEven) fillRect(MARGIN, doc.y - 1, CONTENT_W, 20, "#F8FAFC");
  // Number badge
  doc.save().roundedRect(MARGIN + 2, doc.y + 3, 24, 13, 3).fill(C.lightBlue).restore();
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.white)
     .text(item.num, MARGIN + 4, doc.y + 5.5, { lineBreak: false });
  // Dotted line
  doc.font("Helvetica").fontSize(9.5).fillColor(C.subtext)
     .text(item.title, MARGIN + 30, doc.y + 4, { lineBreak: false });
  // Page number
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.blue)
     .text(String(item.page), W - MARGIN - 20, doc.y - 8, { lineBreak: false });
  // Dotted rule
  const titleW = doc.widthOfString(item.title, { fontSize: 9.5 });
  doc.save().opacity(0.3)
     .moveTo(MARGIN + 30 + titleW + 6, doc.y - 5)
     .lineTo(W - MARGIN - 26, doc.y - 5)
     .dash(1, { space: 3 }).strokeColor(C.gray).lineWidth(0.5).stroke().restore();
  doc.y += 20;
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1: PLATFORM OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
newPage();
sectionHeader("01 · Platform Overview & Architecture", "BUSINESSNow — PSA Platform for KSAP Technologies");

doc.font("Helvetica").fontSize(10).fillColor(C.subtext)
   .text(
    "BUSINESSNow is a comprehensive Professional Services Automation (PSA) platform built specifically for " +
    "KSAP Technologies, an Oracle Transportation Management (OTM) consulting firm. It provides an integrated " +
    "command center for delivery operations, resource capacity, client health, and financial performance across " +
    "all active engagements.",
    MARGIN, doc.y, { width: CONTENT_W }
   );

doc.y += 16;

// Tech stack grid
const techItems = [
  { label: "Frontend", val: "React 19 + Vite 6, TailwindCSS, Radix UI, Recharts" },
  { label: "Backend", val: "Express 5 (TypeScript), REST API, role-based middleware" },
  { label: "Database", val: "PostgreSQL + Drizzle ORM (32 tables, full relational schema)" },
  { label: "Runtime", val: "Node 20 LTS, pnpm monorepo, KSAP-hosted infrastructure" },
  { label: "Security", val: "Rate limiting (100 req/15 min), requireRole RBAC middleware, morgan request logging, Sentry frontend monitoring" },
  { label: "Ports", val: "API :8080 · Web SPA :5173 · Preview proxy port-forwarding" },
];

const halfW = (CONTENT_W - 12) / 2;
techItems.forEach((t, i) => {
  const x = MARGIN + (i % 2) * (halfW + 12);
  if (i % 2 === 0 && i > 0) doc.y += 0;
  const rowY = doc.y;
  fillRect(x, rowY, halfW, 30, i % 4 < 2 ? C.lightGray : C.white);
  doc.save().rect(x, rowY, 3, 30).fill(C.lightBlue).restore();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(C.navy)
     .text(t.label, x + 8, rowY + 5, { lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(C.subtext)
     .text(t.val, x + 8, rowY + 17, { width: halfW - 12 });
  if (i % 2 === 1) doc.y = rowY + 32;
});

doc.y += 16;

// Module groups
const groups = [
  { name: "PROJECT DELIVERY", color: C.blue, items: ["Projects", "Milestones", "Tasks", "Time Logs", "Timesheet Approval", "Blueprints"] },
  { name: "PEOPLE & CAPACITY", color: C.green, items: ["Team Roster", "Utilization Heatmap", "Assignments", "Staffing Requests", "Capacity Forecast"] },
  { name: "CLIENT PIPELINE", color: C.accent, items: ["Customers", "Customer Detail", "Prospects", "Opportunity Pipeline"] },
  { name: "FINANCE & CONTRACTS", color: "#7C3AED", items: ["Financials / WIP", "Invoices", "Rate Cards", "Change Orders", "Contract Manager"] },
  { name: "EXECUTIVE & ADMIN", color: C.navy, items: ["Portfolio View", "Admin Dashboard", "System Admin Panel"] },
];

const gColW = (CONTENT_W - (groups.length - 1) * 8) / groups.length;
const gStartY = doc.y;
groups.forEach((g, i) => {
  const x = MARGIN + i * (gColW + 8);
  fillRect(x, gStartY, gColW, 16, g.color);
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(C.white)
     .text(g.name, x + 4, gStartY + 4.5, { width: gColW - 8, align: "center" });
  let iy = gStartY + 18;
  g.items.forEach(item => {
    fillRect(x, iy, gColW, 15, "#F8FAFC");
    doc.save().rect(x, iy, 2, 15).fill(g.color).restore();
    doc.font("Helvetica").fontSize(7.5).fillColor(C.subtext)
       .text(item, x + 6, iy + 4, { width: gColW - 10, lineBreak: false });
    iy += 16;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2: USER ROLES
// ─────────────────────────────────────────────────────────────────────────────
newPage();
sectionHeader("02 · User Roles & Permissions", "11 distinct roles with scoped access across all modules");

const roles = [
  { role: "System Admin", key: "admin", desc: "Full platform access. Manages users, system config, data integrity, audit logs.", badge: "#0F1C2E", access: "All modules" },
  { role: "Partner / Executive", key: "executive", desc: "Read-only portfolio view. KPIs, revenue, margin, at-risk projects. No editing.", badge: "#7C3AED", access: "Portfolio, Customers, Pipeline" },
  { role: "Delivery Director", key: "delivery_director", desc: "Cross-project delivery oversight. Approves staffing, reviews all project health.", badge: "#1E4FC2", access: "All delivery + resources" },
  { role: "Project Manager", key: "project_manager", desc: "Manages assigned projects end-to-end. Creates milestones, tasks, approves timesheets.", badge: "#0E7490", access: "Projects, team, finance (own)" },
  { role: "Consultant", key: "consultant", desc: "Logs time, updates assigned tasks, views own project context.", badge: "#059669", access: "Tasks, Time Logs, own projects" },
  { role: "Resource Manager", key: "resource_manager", desc: "Manages staffing, allocations, capacity planning, bench reports.", badge: "#D97706", access: "Team, Assignments, Capacity" },
  { role: "Finance Lead", key: "finance_lead", desc: "Full access to WIP, invoicing, rate cards, contracts, margin analytics.", badge: "#DC2626", access: "All finance modules" },
  { role: "Account Manager", key: "account_manager", desc: "Customer health, renewal tracking, executive relationship view.", badge: "#7C3AED", access: "Customers, Portfolio (read)" },
  { role: "Sales / BD", key: "sales", desc: "Prospects pipeline, opportunity management, ACV tracking.", badge: "#EA580C", access: "Prospects, Opportunities, Customers" },
  { role: "PMO Analyst", key: "pmo", desc: "Templates, blueprints, process governance, cross-project reporting.", badge: "#1D4ED8", access: "Templates, Portfolio (read)" },
  { role: "Subcontractor", key: "subcontractor", desc: "Time entry only. Restricted to assigned project and task views.", badge: "#6B7280", access: "Own Time Logs only" },
];

roles.forEach((r, i) => {
  if (doc.y > H - 100) newPage();
  const rowY = doc.y;
  fillRect(MARGIN, rowY, CONTENT_W, 36, i % 2 === 0 ? C.white : "#F8FAFC");
  doc.save().roundedRect(MARGIN + 4, rowY + 10, 8, 8, 2).fill(r.badge).restore();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.navy)
     .text(r.role, MARGIN + 18, rowY + 4, { width: 140, lineBreak: false });
  doc.save().roundedRect(MARGIN + 16, rowY + 17, 120, 10, 3).fill("#EFF6FF").restore();
  doc.font("Helvetica").fontSize(6.5).fillColor(C.blue)
     .text(`key: ${r.key}`, MARGIN + 20, rowY + 20, { lineBreak: false });
  doc.font("Helvetica").fontSize(8.5).fillColor(C.subtext)
     .text(r.desc, MARGIN + 165, rowY + 4, { width: 290 });
  doc.save().roundedRect(W - MARGIN - 95, rowY + 11, 91, 13, 4).fill("#DBEAFE").restore();
  doc.font("Helvetica").fontSize(7).fillColor(C.blue)
     .text(r.access, W - MARGIN - 91, rowY + 15, { width: 87, align: "center", lineBreak: false });
  doc.y = rowY + 38;
});

// ─────────────────────────────────────────────────────────────────────────────
//  MODULE PAGES  (one per screenshot)
// ─────────────────────────────────────────────────────────────────────────────

const modules = [
  {
    num: 3, title: "Authentication & Login",
    role: "All roles", img: "01_login.jpg",
    desc: "Role-based login screen. Team members select their identity from the roster. Each login loads a scoped workspace tailored to their permissions.",
    points: [
      "User roster with avatar initials and role badges",
      "Role-based sidebar and module access on login",
      "Animated preview pane showing live platform metrics",
      "No password required in demo mode; JWT in production",
      "Auto-redirect to role-appropriate dashboard",
      "Session persisted in localStorage (otmnow_role)",
    ],
    reqs: [
      { id: "REQ-AUTH-01", desc: "Display all active users with role badge", priority: "Must", role: "All" },
      { id: "REQ-AUTH-02", desc: "Load role-scoped sidebar on login", priority: "Must", role: "All" },
      { id: "REQ-AUTH-03", desc: "Redirect to role dashboard after auth", priority: "Must", role: "All" },
    ],
  },
  {
    num: 4, title: "PM Dashboard — Delivery Workspace",
    role: "Project Manager", img: "02_pm_dashboard.jpg",
    desc: "Personalized operational command center for Project Managers. Surfaces overdue milestones, urgent action items, and timesheet compliance alerts.",
    points: [
      "\"Today's Actions\" queue sorted by urgency and priority",
      "Overdue milestone alerts with project context and links",
      "Timesheet non-compliance warning for team members",
      "Real-time refresh button for live data updates",
      "Urgent item count badge on header",
      "Quick-navigate links to relevant module pages",
    ],
    reqs: [
      { id: "REQ-DASH-01", desc: "Show urgent items count in header badge", priority: "Must", role: "PM" },
      { id: "REQ-DASH-02", desc: "Surface overdue milestones with due date & project", priority: "Must", role: "PM" },
      { id: "REQ-DASH-03", desc: "Alert on team members with missing timesheets", priority: "Should", role: "PM" },
      { id: "REQ-DASH-04", desc: "One-click navigation to any action item", priority: "Must", role: "PM" },
    ],
  },
  {
    num: 5, title: "Projects — List View",
    role: "PM · Delivery Director", img: "03_projects.jpg",
    desc: "Central registry of all client engagements. Shows health scores, budget burn, phase, and PM assignment. Supports kanban and table views.",
    points: [
      "Health score (0–100) with colour-coded bar indicator",
      "Budget burn % and total contract value",
      "Current phase, status, and PM assignment",
      "Filter by status, type, PM, customer",
      "Kanban view by delivery phase",
      "Quick-create new project from template",
    ],
    reqs: [
      { id: "REQ-PROJ-01", desc: "Display health score with visual indicator", priority: "Must", role: "PM, DD" },
      { id: "REQ-PROJ-02", desc: "Show budget burn and TCV per project", priority: "Must", role: "PM, Finance" },
      { id: "REQ-PROJ-03", desc: "Filter by status, type, PM, customer", priority: "Must", role: "PM, DD" },
      { id: "REQ-PROJ-04", desc: "Support Kanban and Table view toggle", priority: "Should", role: "PM" },
    ],
  },
  {
    num: 6, title: "Project Detail — Command Center",
    role: "Project Manager", img: "23_project_detail.jpg",
    desc: "Deep-dive into a single engagement. Shows real-time health, budget burn, Gantt timeline, team roster, finance, and milestone status — all in one tabbed workspace.",
    points: [
      "Health score with Schedule Performance Index (SPI)",
      "Budget burn %, margin forecast, invoiced amount",
      "\"Go Live\" countdown with next milestone highlighted",
      "9 tabs: Overview, Team, Milestones, Tasks, Time Logs, Finance, Gantt, Updates, Details",
      "At-risk banners with explanatory text",
      "Inline refresh and baseline comparison",
    ],
    reqs: [
      { id: "REQ-PDET-01", desc: "Show SPI and CPI with risk bands", priority: "Must", role: "PM" },
      { id: "REQ-PDET-02", desc: "Tabbed interface with 9 contextual views", priority: "Must", role: "PM" },
      { id: "REQ-PDET-03", desc: "Display next Go-Live milestone prominently", priority: "Must", role: "PM, DD" },
      { id: "REQ-PDET-04", desc: "Margin forecast and revenue summary", priority: "Should", role: "Finance" },
    ],
  },
  {
    num: 7, title: "Milestones — Cross-Project Tracking",
    role: "Project Manager", img: "04_milestones.jpg",
    desc: "All delivery milestones across every active engagement in a single Kanban board. Tracks status, payment triggers, and overdue items at a glance.",
    points: [
      "Columns: Overdue · Pending · In Progress · Complete",
      "Colour-coded status with payment amount per milestone",
      "Cross-project aggregation with project name context",
      "Table view alternative with sort & filter",
      "Overdue count badge per column",
      "Direct link to parent project command center",
    ],
    reqs: [
      { id: "REQ-MILE-01", desc: "Kanban columns by milestone status", priority: "Must", role: "PM, DD" },
      { id: "REQ-MILE-02", desc: "Show payment trigger amount per milestone", priority: "Must", role: "Finance" },
      { id: "REQ-MILE-03", desc: "Overdue highlighting with due date", priority: "Must", role: "PM" },
      { id: "REQ-MILE-04", desc: "Cross-project view aggregating all milestones", priority: "Must", role: "DD" },
    ],
  },
  {
    num: 8, title: "Tasks — Cross-Project Queue",
    role: "Project Manager · Consultant", img: "05_tasks.jpg",
    desc: "Aggregated task list across all projects. Summary cards for TO DO, IN PROGRESS, BLOCKED, and DONE. Supports list, board, and hierarchy (WBS) views.",
    points: [
      "Status summary cards with count per state",
      "Assignee, priority, due date, hours logged, ETC columns",
      "Filter by status, priority, project, assignee",
      "Board view (Kanban) and Hierarchy (WBS) modes",
      "Search across task name, assignee, project",
      "Inline status update with dropdown",
    ],
    reqs: [
      { id: "REQ-TASK-01", desc: "Status summary cards (TO DO, IN PROGRESS, BLOCKED, DONE)", priority: "Must", role: "PM, Consultant" },
      { id: "REQ-TASK-02", desc: "Filter by status, priority, project, assignee", priority: "Must", role: "PM" },
      { id: "REQ-TASK-03", desc: "List, Board, and Hierarchy (WBS) view modes", priority: "Should", role: "PM" },
    ],
  },
  {
    num: 9, title: "Time Logs — Weekly Timesheet",
    role: "Consultant · All billing roles", img: "06_timesheets.jpg",
    desc: "Weekly time-entry grid with billable/non-billable split. Consultants log hours against project-task rows. Shows totals, submission status, and approval state.",
    points: [
      "Mon–Sun grid per project/task combination",
      "Billable vs. total hours footer per day",
      "TOTAL HOURS, PENDING, APPROVED, REJECTED summary cards",
      "Collaboration hours row for internal team time",
      "Week navigation with today highlight",
      "Submit button per week with status rollup",
    ],
    reqs: [
      { id: "REQ-TIME-01", desc: "Weekly grid with Mon–Sun columns per project/task", priority: "Must", role: "Consultant" },
      { id: "REQ-TIME-02", desc: "Separate billable vs non-billable tracking", priority: "Must", role: "Finance" },
      { id: "REQ-TIME-03", desc: "Submit timesheet week for PM approval", priority: "Must", role: "Consultant" },
      { id: "REQ-TIME-04", desc: "Status summary cards (Pending, Approved, Rejected)", priority: "Must", role: "Consultant" },
    ],
  },
  {
    num: 10, title: "Timesheet Approval Workflow",
    role: "Project Manager", img: "26_timesheet_approvals.jpg",
    desc: "PM-facing queue of all submitted timesheets. Bulk review with approve / reject actions per entry. Filters by status, project, resource, and date range.",
    points: [
      "All submitted timesheets in a tabular queue",
      "23 pending approvals shown with resource, project, hours",
      "Billable flag and billed-role assignment per entry",
      "Approve (✓) / Reject (✗) action buttons inline",
      "Filter by project, resource, date range",
      "Bulk select with checkbox column for mass approval",
    ],
    reqs: [
      { id: "REQ-TAPPR-01", desc: "Queue of all submitted timesheets for PM review", priority: "Must", role: "PM" },
      { id: "REQ-TAPPR-02", desc: "Inline approve and reject actions with icon buttons", priority: "Must", role: "PM" },
      { id: "REQ-TAPPR-03", desc: "Filter by project, resource, date range, status", priority: "Must", role: "PM" },
      { id: "REQ-TAPPR-04", desc: "Bulk select and mass approve functionality", priority: "Should", role: "PM" },
    ],
  },
  {
    num: 11, title: "Team — Resource Utilization Heatmap",
    role: "Resource Manager", img: "08_team.jpg",
    desc: "12-week rolling utilization heatmap for all 32 team members. Colour-coded by utilization band. Toggles between \"By Resource\" and \"By Project\" pivot views.",
    points: [
      "Colour legend: Bench · Available · Optimal · Booked · Overbooked",
      "12-week rolling window (4w / 8w / 12w selector)",
      "Average utilization % in rightmost column",
      "Click row to expand individual resource timeline",
      "\"By Project\" view shows same heatmap pivoted to projects",
      "Overbooked / On-bench counts in header KPI chips",
    ],
    reqs: [
      { id: "REQ-TEAM-01", desc: "Heatmap with utilization colour bands per resource/week", priority: "Must", role: "RM" },
      { id: "REQ-TEAM-02", desc: "4w / 8w / 12w window selector", priority: "Must", role: "RM" },
      { id: "REQ-TEAM-03", desc: "By Resource and By Project pivot toggle", priority: "Should", role: "RM" },
      { id: "REQ-TEAM-04", desc: "Overbooked count with drill-down", priority: "Must", role: "RM" },
    ],
  },
  {
    num: 12, title: "Assignments — Cross-Project Staffing",
    role: "Resource Manager", img: "09_allocations.jpg",
    desc: "All active resource allocations in one table. Shows hard vs. soft allocations, conflict detection, hours/week, and confirmation status.",
    points: [
      "24 hard allocations, 6 soft (pipeline), 2 conflicts shown",
      "Allocation type: Hard (confirmed) · Soft (pipeline)",
      "% utilization with hours/week display",
      "Date range with start/end period per allocation",
      "Conflict banner: \"2 resources over-allocated\"",
      "New Allocation quick-create button",
    ],
    reqs: [
      { id: "REQ-ALLOC-01", desc: "Display all allocations with hard/soft type", priority: "Must", role: "RM" },
      { id: "REQ-ALLOC-02", desc: "Detect and surface over-allocation conflicts", priority: "Must", role: "RM" },
      { id: "REQ-ALLOC-03", desc: "Filter by All, Hard, Soft, Active, Conflicts", priority: "Must", role: "RM" },
    ],
  },
  {
    num: 13, title: "Staffing Requests",
    role: "Resource Manager · PM", img: "10_staffing.jpg",
    desc: "Open role requisitions across all projects. Tracks critical and high-priority staffing gaps with required skills, timeline, and allocation percentage.",
    points: [
      "5 open, 1 in review, 1 critical priority, 1 fulfilled",
      "Role, skills, project, timeline, allocation, and priority columns",
      "Critical / High / Medium / Low priority badge system",
      "Status dropdown: Open · In Review · Fulfilled · Cancelled",
      "Linked to parent project for context",
      "New Request CTA with role and skills fields",
    ],
    reqs: [
      { id: "REQ-SREQ-01", desc: "List open staffing requests with priority badge", priority: "Must", role: "RM, PM" },
      { id: "REQ-SREQ-02", desc: "Skills, timeline, allocation %, project context", priority: "Must", role: "RM" },
      { id: "REQ-SREQ-03", desc: "Status workflow: Open → In Review → Fulfilled", priority: "Must", role: "RM" },
    ],
  },
  {
    num: 14, title: "Capacity Forecast",
    role: "Resource Manager", img: "17_capacity.jpg",
    desc: "12-week bar chart forecast of hard demand vs. soft pipeline demand per OTM specialization. Surfaces constrained roles and capacity gaps.",
    points: [
      "32 resources across all specializations tracked",
      "12-week window with 4w/8w options",
      "Hard demand (solid) vs. Soft demand (pipeline) per bar",
      "Capacity constraint banner for bottleneck roles",
      "Grouped by OTM specialization (AMS, Implementation, etc.)",
      "Bars toggle: weekly bars vs. table view",
    ],
    reqs: [
      { id: "REQ-CAP-01", desc: "Bar chart of capacity vs demand per specialization", priority: "Must", role: "RM, DD" },
      { id: "REQ-CAP-02", desc: "Hard demand vs soft pipeline differentiation", priority: "Must", role: "RM" },
      { id: "REQ-CAP-03", desc: "Capacity constraint alerts for bottleneck roles", priority: "Must", role: "RM, DD" },
    ],
  },
  {
    num: 15, title: "Customers (Accounts)",
    role: "Account Manager · PM", img: "07_customers.jpg",
    desc: "8 enterprise accounts with health scoring, OTM version tracking, ACV, renewal dates, region, and segment. Two at-risk accounts highlighted.",
    points: [
      "8 accounts: 4 active, 4 prospect/inactive",
      "Health score 0–100 with visual progress bar",
      "OTM version per account (23A, 23C, 23D, 24A, 24B)",
      "ACV, renewal date, industry, and region columns",
      "\"At Risk\" badge for health < 65",
      "Filter by status and segment (Enterprise / Mid-Market)",
    ],
    reqs: [
      { id: "REQ-CUST-01", desc: "Health score with visual bar per customer", priority: "Must", role: "AM, PM" },
      { id: "REQ-CUST-02", desc: "OTM version, ACV, renewal date displayed", priority: "Must", role: "AM" },
      { id: "REQ-CUST-03", desc: "At-risk flag for health score < 65", priority: "Must", role: "AM, DD" },
    ],
  },
  {
    num: 16, title: "Customer Detail — Health & Invoice Summary",
    role: "Account Manager", img: "24_customer_detail.jpg",
    desc: "Deep-dive account view with health score breakdown, deduction factors, invoice summary, project roster, change order history, and account info tabs.",
    points: [
      "Health Score: 63/100 with deduction breakdown",
      "Deductions: -24 overdue milestones, -8 overdue invoice, -5 avg health",
      "Upcoming Go-Lives and invoice collection summary",
      "4 tabs: Health Analysis · Projects · Change Orders · Account Info",
      "Outstanding and collected revenue with overdue flag",
      "Project list with individual health scores",
    ],
    reqs: [
      { id: "REQ-CDET-01", desc: "Health score breakdown with deduction reasons", priority: "Must", role: "AM, DD" },
      { id: "REQ-CDET-02", desc: "Invoice summary with outstanding / overdue amounts", priority: "Must", role: "Finance, AM" },
      { id: "REQ-CDET-03", desc: "Tabbed view: Health, Projects, Change Orders, Info", priority: "Must", role: "AM" },
    ],
  },
  {
    num: 17, title: "Prospects Pipeline",
    role: "Sales · Account Manager", img: "15_prospects.jpg",
    desc: "Prospects are managed within the Customers module, filtered by Prospect status. Meridian Carriers ($540K ACV) is shown as a prospect account pending qualification.",
    points: [
      "Prospect accounts shown with \"Prospect\" status badge",
      "ACV potential, industry, region, segment visible",
      "Health score not yet calculated (pre-engagement)",
      "Qualification status and OTM version TBD",
      "Convert to Customer action when deal closes",
      "Link to Opportunity record for sales context",
    ],
    reqs: [
      { id: "REQ-PROS-01", desc: "Prospect accounts visible with status badge", priority: "Must", role: "Sales, AM" },
      { id: "REQ-PROS-02", desc: "ACV, region, industry, segment shown", priority: "Must", role: "Sales" },
      { id: "REQ-PROS-03", desc: "Convert prospect to customer on deal close", priority: "Should", role: "Sales, AM" },
    ],
  },
  {
    num: 18, title: "Opportunity Pipeline",
    role: "Sales · Business Development", img: "16_opportunities.jpg",
    desc: "Full-lifecycle opportunity tracking. 10 opportunities across 7 stages from Lead through Won/Lost. $1.7M active pipeline, $873K weighted value, 67% win rate.",
    points: [
      "$1.7M active pipeline with 7 open opportunities",
      "Probability-adjusted weighted value: $873K",
      "Stage tabs: Lead · Qualified · Discovery · Proposal · Negotiation · Won · Lost",
      "Value, probability %, close date, owner per row",
      "Opportunity type: Cloud Migration, AMS, Custom Dev, Certification",
      "Add Opportunity with guided form",
    ],
    reqs: [
      { id: "REQ-OPP-01", desc: "Pipeline total and weighted value KPI cards", priority: "Must", role: "Sales, DD" },
      { id: "REQ-OPP-02", desc: "Stage-based pipeline with tab filters", priority: "Must", role: "Sales" },
      { id: "REQ-OPP-03", desc: "Probability %, value, close date, owner per opp", priority: "Must", role: "Sales" },
      { id: "REQ-OPP-04", desc: "Kanban view by stage", priority: "Should", role: "Sales" },
    ],
  },
  {
    num: 19, title: "Finance — WIP, Receivables & Margins",
    role: "Finance Lead", img: "11_finance.jpg",
    desc: "Unified financial dashboard. WIP value, total invoiced, outstanding receivables, overdue invoices, timesheet approvals pending, and total contract value — all in one pane.",
    points: [
      "WIP Value: $199K (1077h approved, not yet invoiced)",
      "Total Invoiced: $672K (1 draft pending)",
      "Outstanding Receivables: $422K across 5 invoices",
      "23 timesheets pending review and approval",
      "Contract TCV: $1.9M under management",
      "Tabs: WIP · Receivables · Approvals · Contracts · Margin",
    ],
    reqs: [
      { id: "REQ-FIN-01", desc: "WIP value, hours, and project breakdown", priority: "Must", role: "Finance" },
      { id: "REQ-FIN-02", desc: "Outstanding receivables and overdue count", priority: "Must", role: "Finance" },
      { id: "REQ-FIN-03", desc: "Pending timesheet approval count with quick link", priority: "Must", role: "Finance, PM" },
      { id: "REQ-FIN-04", desc: "Contract TCV and margin analytics tabs", priority: "Should", role: "Finance, DD" },
    ],
  },
  {
    num: 20, title: "Invoices — Kanban & Aging",
    role: "Finance Lead", img: "12_invoices.jpg",
    desc: "12 invoices in a 4-column Kanban: Draft · Sent · Overdue · Paid. $422K outstanding, $124K overdue across 2 invoices. Status filter tabs and invoice search.",
    points: [
      "4-column Kanban: Draft ($28K) · Sent ($298K) · Overdue ($124K) · Paid",
      "Invoice card: number, account, project, amount, due date",
      "Overdue invoices highlighted in red with past-due date",
      "Table view alternative with sorting",
      "Status filter tabs: All · Draft · Sent · Overdue · Paid",
      "Search by invoice #, account, or project name",
    ],
    reqs: [
      { id: "REQ-INV-01", desc: "Kanban view: Draft, Sent, Overdue, Paid columns", priority: "Must", role: "Finance" },
      { id: "REQ-INV-02", desc: "Overdue invoice highlighting with past-due date", priority: "Must", role: "Finance" },
      { id: "REQ-INV-03", desc: "Invoice totals per column in header", priority: "Must", role: "Finance" },
      { id: "REQ-INV-04", desc: "Table view with sort and search", priority: "Should", role: "Finance" },
    ],
  },
  {
    num: 21, title: "Rate Cards",
    role: "Finance Lead", img: "19_rate_cards.jpg",
    desc: "5 global billing rate templates plus 3 project-specific overrides. Shows sell rate, cost rate, and margin % per OTM role. Used to calculate WIP and invoice amounts.",
    points: [
      "5 global templates: OTM Architect, Senior Functional, Rate Engine Specialist, PM, AMS Support",
      "Sell rate and cost rate with margin % (42–44%) displayed",
      "Project-specific cards override global rates per engagement",
      "Currency: CAD with effective date range",
      "New Rate Card creation with role and rate fields",
      "Used by WIP engine to calculate billable revenue",
    ],
    reqs: [
      { id: "REQ-RATE-01", desc: "Global templates and project-specific card separation", priority: "Must", role: "Finance" },
      { id: "REQ-RATE-02", desc: "Sell rate, cost rate, and margin % per role", priority: "Must", role: "Finance" },
      { id: "REQ-RATE-03", desc: "Effective date range for rate validity", priority: "Must", role: "Finance" },
    ],
  },
  {
    num: 22, title: "Change Orders",
    role: "Finance Lead · PM", img: "18_changes.jpg",
    desc: "7-stage change order pipeline tracking scope, cost, and timeline impacts. $66K total cost impact across 7 change orders if all approved.",
    points: [
      "7 change orders across all active projects",
      "Total cost impact: $66K if all approved",
      "7-stage Kanban: Draft · Submitted · Estimating · Internal Review · Client Review · Approved · Rejected",
      "Awaiting Decision: 0 (none in client review currently)",
      "Leakage Risk: 0 (no delivered-before-approval items)",
      "Change type, scope impact, timeline delta per card",
    ],
    reqs: [
      { id: "REQ-CHG-01", desc: "7-stage Kanban pipeline for change orders", priority: "Must", role: "Finance, PM" },
      { id: "REQ-CHG-02", desc: "Total cost impact and count KPI cards", priority: "Must", role: "Finance" },
      { id: "REQ-CHG-03", desc: "Leakage risk detection (delivered before approval)", priority: "Must", role: "Finance, DD" },
    ],
  },
  {
    num: 23, title: "Contract Manager",
    role: "Finance Lead", img: "20_contracts.jpg",
    desc: "8 contracts totalling $1.9M TCV. Tracks billing model (T&M, Fixed Fee, Retainer, Milestone), invoiced amount, remaining value, SLA config, and payment terms.",
    points: [
      "8 contracts: $1.9M TCV, $901K invoiced, $1.0M remaining",
      "Billing models: T&M · Milestone · Fixed Fee · Retainer · AMS",
      "SLA configuration per contract (uptime, hours, response time)",
      "Payment terms: Net 15, Net 30 with monthly billing cycle",
      "Billing milestones with completion status per Milestone contract",
      "Quick filter tabs: All · Active · T&M · Milestone · Fixed Fee · Retainer · AMS",
    ],
    reqs: [
      { id: "REQ-CTR-01", desc: "TCV, invoiced, and remaining value KPI cards", priority: "Must", role: "Finance" },
      { id: "REQ-CTR-02", desc: "Support all 5 billing models with type badge", priority: "Must", role: "Finance" },
      { id: "REQ-CTR-03", desc: "SLA configuration and payment terms per contract", priority: "Should", role: "Finance, AM" },
    ],
  },
  {
    num: 24, title: "Executive Portfolio View",
    role: "Partner / Executive", img: "13_portfolio.jpg",
    desc: "Read-only portfolio dashboard for Partners and Executives. 9 projects, $2.1M total budget, $901K billed, 13.3 FTE allocated, 2 at-risk projects with health < 65.",
    points: [
      "6 active projects out of 9 total in portfolio",
      "At-risk count: 2 projects with health < 65",
      "Go-Lives in 90 days: 0 upcoming",
      "Revenue Billed: $901K, Revenue At Risk: $248K",
      "Allocated FTE: 13.3 (hard allocations only)",
      "Tabs: All Projects · Account Health · Go-Lives · At Risk · Director View",
    ],
    reqs: [
      { id: "REQ-PORT-01", desc: "Portfolio KPI header: active, at-risk, go-lives, budget", priority: "Must", role: "Executive" },
      { id: "REQ-PORT-02", desc: "Project table with health, PM, budget, billed, overdue", priority: "Must", role: "Executive" },
      { id: "REQ-PORT-03", desc: "At-risk tab filtering projects below health threshold", priority: "Must", role: "Executive, DD" },
    ],
  },
  {
    num: 25, title: "Project Blueprints (Templates)",
    role: "Admin · PMO Analyst", img: "22_templates.jpg",
    desc: "Pre-built delivery frameworks for OTM engagements. 3 templates: AMS Managed Services, OTM Certification, Cloud Implementation. Used to launch new projects with pre-defined structure.",
    points: [
      "OTM AMS Retainer: 2 phases, 6-week baseline",
      "OTM Certification — Quarterly: 4 phases, 6-week cycle",
      "OTM Cloud Implementation: 5 phases, 25-week program",
      "Phase names, milestone placeholders, task structure included",
      "Filter by engagement type: AMS, Certification, Implementation",
      "\"Launch Project\" action creates new project from blueprint",
    ],
    reqs: [
      { id: "REQ-TMPL-01", desc: "Template cards with phase, milestone, task counts", priority: "Must", role: "Admin, PMO" },
      { id: "REQ-TMPL-02", desc: "Filter by engagement type", priority: "Must", role: "Admin" },
      { id: "REQ-TMPL-03", desc: "Launch new project pre-populated from blueprint", priority: "Must", role: "PM, Admin" },
    ],
  },
  {
    num: 26, title: "Admin Dashboard — Portfolio Command Center",
    role: "System Admin", img: "14_admin_dash.jpg",
    desc: "Highest-level operational view for Admins. ARR, active projects, invoice collection rate, at-risk projects, plus charts for project status distribution, invoice cash flow, and resource capacity pulse.",
    points: [
      "Total ARR: $2.3M across 8 accounts",
      "Invoice Collection: 33% (2 overdue, $124K outstanding)",
      "Project Status Distribution: 6 Active, 1 At Risk, 1 On Hold",
      "Resource Capacity Pulse: 3 over, 11 available, 5 open requests",
      "Account Health sorted by score",
      "Delivery Risk section: projects with health < 65",
    ],
    reqs: [
      { id: "REQ-ADASH-01", desc: "ARR, active projects, collection rate, at-risk KPIs", priority: "Must", role: "Admin, DD" },
      { id: "REQ-ADASH-02", desc: "Project status distribution chart", priority: "Must", role: "Admin" },
      { id: "REQ-ADASH-03", desc: "Resource capacity pulse with availability breakdown", priority: "Must", role: "Admin, RM" },
      { id: "REQ-ADASH-04", desc: "Margin Watch sorted by remaining margin", priority: "Should", role: "Finance, Admin" },
    ],
  },
  {
    num: 27, title: "System Admin Panel",
    role: "System Admin", img: "21_admin.jpg",
    desc: "Platform governance console. Shows delivery metrics, resource counts, financial summary, entity counts, audit log, and data health checks — all in one admin dashboard.",
    points: [
      "Delivery: 9 projects, 2 at-risk, 16 milestones, 12 overdue",
      "Resources: 32 employees, 0 contractors, 2 overallocated",
      "Finance: 12 invoices, 6 paid, 2 overdue, $672K total",
      "Tabs: Overview · Audit Log · Data Health",
      "Data quality issues surfaced (2 over-allocation alerts)",
      "Entity counts for all 32 database tables",
    ],
    reqs: [
      { id: "REQ-ADMIN-01", desc: "Delivery, resource, finance metric overview", priority: "Must", role: "Admin" },
      { id: "REQ-ADMIN-02", desc: "Audit log with timestamp and actor tracking", priority: "Must", role: "Admin" },
      { id: "REQ-ADMIN-03", desc: "Data health checks with issue count and details", priority: "Must", role: "Admin" },
    ],
  },
];

modules.forEach(mod => {
  newPage();
  moduleHeader(mod.num, mod.title, mod.role, mod.desc);

  const imgPath = img(mod.img);
  if (imgPath) {
    screenshot(imgPath, `${mod.title} — BUSINESSNow v1.0`);
  }

  if (doc.y > H - 180) newPage();

  // Key Points
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.navy)
     .text("KEY FEATURES", MARGIN, doc.y);
  hRule(doc.y + 12, C.lightBlue);
  doc.y += 16;
  keyPoints(mod.points);

  if (doc.y > H - 140) newPage();

  // Requirements table
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.navy)
     .text("REQUIREMENTS", MARGIN, doc.y + 4);
  hRule(doc.y + 16, C.lightBlue);
  doc.y += 20;
  reqTable(mod.reqs);
});

// ─────────────────────────────────────────────────────────────────────────────
//  DATABASE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
newPage();
sectionHeader("28 · Database Schema Overview", "PostgreSQL + Drizzle ORM — 32 tables");

const schemaGroups = [
  {
    name: "Core Delivery", color: C.blue,
    tables: [
      { name: "projects", cols: "id, customer_id, name, status, health_score, phase, budget_total, budget_spent, go_live_date, pm_user_id, type, notes, created_at" },
      { name: "milestones", cols: "id, project_id, name, status, due_date, payment_amount, payment_trigger, completed_at" },
      { name: "tasks", cols: "id, project_id, milestone_id, name, assignee_id, status, priority, due_date, estimated_hours, logged_hours, etc_hours" },
      { name: "project_phases", cols: "id, project_id, name, order_index, start_date, end_date, status" },
      { name: "project_updates", cols: "id, project_id, author_id, content, type, created_at" },
    ],
  },
  {
    name: "People & Capacity", color: C.green,
    tables: [
      { name: "resources", cols: "id, user_id, name, role, seniority, specialization, employment_type, utilization_target, location, timezone" },
      { name: "allocations", cols: "id, resource_id, project_id, role, allocation_pct, hours_per_week, start_date, end_date, type, status" },
      { name: "staffing_requests", cols: "id, project_id, role, skills, allocation_pct, start_date, end_date, priority, status, fulfilled_by_id" },
      { name: "resource_skills", cols: "id, resource_id, skill, experience_years, last_used" },
      { name: "resource_certifications", cols: "id, resource_id, name, issued_by, issued_at, expires_at" },
    ],
  },
  {
    name: "Time & Approvals", color: C.accent,
    tables: [
      { name: "time_entries", cols: "id, resource_id, project_id, task_id, date, hours, billable_hours, notes, status, approved_by, approved_at" },
      { name: "timesheet_weeks", cols: "id, resource_id, week_start, week_end, status, submitted_at, approved_by_id, approved_at, total_hours" },
    ],
  },
  {
    name: "Finance", color: "#7C3AED",
    tables: [
      { name: "invoices", cols: "id, customer_id, project_id, contract_id, invoice_number, amount, status, issued_date, due_date, paid_date, notes" },
      { name: "rate_cards", cols: "id, name, role, sell_rate, cost_rate, currency, effective_from, effective_to, project_id, is_global" },
      { name: "change_orders", cols: "id, project_id, name, description, scope_impact, cost_impact, timeline_impact_days, status, submitted_at, approved_at" },
      { name: "contracts", cols: "id, customer_id, project_id, contract_number, billing_model, total_value, start_date, end_date, payment_terms, billing_cycle, status" },
      { name: "contract_slas", cols: "id, contract_id, metric, target_value, unit, monitoring_cadence" },
      { name: "billing_milestones", cols: "id, contract_id, name, amount, status, due_date, invoiced_at" },
    ],
  },
  {
    name: "Pipeline & Accounts", color: C.navy,
    tables: [
      { name: "customers", cols: "id, name, industry, segment, status, region, otm_version, acv, renewal_date, health_score, notes" },
      { name: "prospects", cols: "id, name, industry, segment, region, acv_potential, source, status, owner_id, notes" },
      { name: "opportunities", cols: "id, customer_id, prospect_id, name, description, type, value, probability, stage, close_date, owner_id" },
      { name: "opportunity_activities", cols: "id, opportunity_id, type, notes, author_id, created_at" },
    ],
  },
  {
    name: "System", color: C.gray,
    tables: [
      { name: "users", cols: "id, email, name, role, avatar_url, is_active, created_at" },
      { name: "templates", cols: "id, name, type, description, phases_json, created_by, created_at" },
      { name: "notifications", cols: "id, user_id, type, title, body, read, created_at, entity_type, entity_id" },
      { name: "audit_logs", cols: "id, user_id, action, entity_type, entity_id, diff_json, created_at" },
      { name: "data_health_issues", cols: "id, type, severity, entity_type, entity_id, description, detected_at, resolved_at" },
    ],
  },
];

schemaGroups.forEach(group => {
  if (doc.y > H - 200) newPage();
  fillRect(MARGIN, doc.y, CONTENT_W, 18, group.color);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.white)
     .text(group.name.toUpperCase(), MARGIN + 8, doc.y + 5);
  doc.y += 20;

  group.tables.forEach((t, i) => {
    if (doc.y > H - 80) newPage();
    const rowH = doc.heightOfString(t.cols, { fontSize: 7.5, width: CONTENT_W - 120 }) + 14;
    fillRect(MARGIN, doc.y, CONTENT_W, rowH, i % 2 === 0 ? C.white : C.lightGray);
    doc.save().rect(MARGIN, doc.y, 3, rowH).fill(group.color).restore();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.navy)
       .text(t.name, MARGIN + 8, doc.y + 6, { width: 115, lineBreak: false });
    doc.font("Courier").fontSize(7.5).fillColor(C.gray)
       .text(t.cols, MARGIN + 128, doc.y + (rowH - doc.heightOfString(t.cols, { fontSize: 7.5, width: CONTENT_W - 140 })) / 2, { width: CONTENT_W - 140 });
    doc.y += rowH;
  });
  doc.y += 8;
});

// ─────────────────────────────────────────────────────────────────────────────
//  API REFERENCE
// ─────────────────────────────────────────────────────────────────────────────
newPage();
sectionHeader("29 · API Reference", "Express 5 REST API — 35+ routes — Port 8080 — Phase 5 Security Hardened");

doc.font("Helvetica").fontSize(9.5).fillColor(C.subtext)
   .text("All routes are prefixed with /api. Role-based access is enforced via the X-User-Role header, which is injected by the frontend's fetch interceptor. No routes are publicly accessible without a role header.", MARGIN, doc.y, { width: CONTENT_W });
doc.y += 14;

// Phase 5 Security callout
fillRect(MARGIN, doc.y, CONTENT_W, 22, "#1E3A5F");
doc.save().rect(MARGIN, doc.y, 4, 22).fill(C.accent).restore();
doc.font("Helvetica-Bold").fontSize(8).fillColor(C.accent)
   .text("PHASE 5 — SECURITY HARDENING", MARGIN + 12, doc.y + 4, { lineBreak: false });
doc.font("Helvetica").fontSize(8).fillColor("#93C5FD")
   .text("  Rate limiting · RBAC middleware · Request logging · Sentry frontend monitoring", MARGIN + 12 + doc.widthOfString("PHASE 5 — SECURITY HARDENING", { fontSize: 8 }), doc.y + 4, { lineBreak: false });
doc.y += 26;

const secItems = [
  { label: "Rate Limiting", val: "100 requests / 15-minute window per IP. Returns HTTP 429 when exceeded. Configured via express-rate-limit on all /api/* routes." },
  { label: "Auth Middleware", val: "requireRole(...roles) guard on every route. Reads X-User-Role header; rejects with 401 if missing or 403 if role is not permitted." },
  { label: "Request Logger", val: "morgan 'combined' format logs every request: method, path, status code, response time, and IP address to stdout." },
  { label: "Sentry (Frontend)", val: "@sentry/react captures runtime exceptions, unhandled promise rejections, and React error boundaries in production. DSN configured via VITE_SENTRY_DSN." },
  { label: "RBAC Field Access", val: "Finance fields (bill_rate, cost_rate, margin) filtered server-side based on role — consultants receive null for sensitive financial columns." },
];

secItems.forEach((item, i) => {
  if (doc.y > H - 60) newPage();
  const rowH = doc.heightOfString(item.val, { fontSize: 8, width: CONTENT_W - 120 }) + 14;
  fillRect(MARGIN, doc.y, CONTENT_W, rowH, i % 2 === 0 ? C.white : C.lightGray);
  doc.save().rect(MARGIN, doc.y, 3, rowH).fill("#1E3A5F").restore();
  doc.font("Helvetica-Bold").fontSize(8).fillColor(C.navy)
     .text(item.label, MARGIN + 8, doc.y + 6, { width: 110, lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(C.subtext)
     .text(item.val, MARGIN + 124, doc.y + 6, { width: CONTENT_W - 128 });
  doc.y += rowH;
});
doc.y += 12;

const apiGroups = [
  {
    prefix: "/api/projects", color: C.blue, routes: [
      { method: "GET", path: "/", desc: "List all projects with health, budget, PM, phase" },
      { method: "GET", path: "/:id", desc: "Get project detail — all 9 tabs' data aggregated" },
      { method: "GET", path: "/:id/team", desc: "Project team members with allocation details" },
      { method: "GET", path: "/:id/milestones", desc: "Project milestones with status and payment trigger" },
      { method: "GET", path: "/:id/tasks", desc: "Project task list with assignee and status" },
      { method: "GET", path: "/:id/time-entries", desc: "Time entries for project (all resources)" },
      { method: "GET", path: "/:id/finance", desc: "WIP, invoices, margin, contract for project" },
    ],
  },
  {
    prefix: "/api/resources", color: C.green, routes: [
      { method: "GET", path: "/", desc: "All resources with utilization heatmap data" },
      { method: "GET", path: "/:id", desc: "Resource profile, skills, certifications, 12-wk load" },
      { method: "GET", path: "/capacity", desc: "12-week capacity forecast by specialization" },
    ],
  },
  {
    prefix: "/api/allocations", color: C.accent, routes: [
      { method: "GET", path: "/", desc: "All allocations — hard & soft with conflict detection" },
      { method: "POST", path: "/", desc: "Create new allocation (hard or soft)" },
      { method: "PUT", path: "/:id", desc: "Update allocation percentage or dates" },
      { method: "DELETE", path: "/:id", desc: "Remove allocation" },
    ],
  },
  {
    prefix: "/api/finance", color: "#7C3AED", routes: [
      { method: "GET", path: "/", desc: "WIP value, receivables, overdue invoices, TCV" },
      { method: "GET", path: "/invoices", desc: "All invoices with status and aging" },
      { method: "GET", path: "/rate-cards", desc: "Global and project-specific rate cards" },
      { method: "GET", path: "/change-orders", desc: "All change orders across projects" },
      { method: "GET", path: "/contracts", desc: "All contracts with SLA and billing milestones" },
    ],
  },
  {
    prefix: "/api/timesheets", color: C.navy, routes: [
      { method: "GET", path: "/my", desc: "Current user's time entries (week filter)" },
      { method: "POST", path: "/", desc: "Log a time entry for a project/task" },
      { method: "GET", path: "/approval", desc: "All submitted timesheets pending PM approval" },
      { method: "POST", path: "/approve", desc: "Approve or reject a timesheet entry" },
    ],
  },
  {
    prefix: "/api/customers & /api/pipeline", color: C.gray, routes: [
      { method: "GET", path: "/api/customers", desc: "All customers with health, ACV, OTM version" },
      { method: "GET", path: "/api/customers/:id", desc: "Customer health breakdown, invoice summary, projects" },
      { method: "GET", path: "/api/opportunities", desc: "Opportunity pipeline with stage and value" },
      { method: "GET", path: "/api/staffing-requests", desc: "Open staffing requests across all projects" },
      { method: "GET", path: "/api/dashboard/admin", desc: "Admin portfolio command center data" },
      { method: "GET", path: "/api/dashboard/pm", desc: "PM delivery workspace — urgent items" },
    ],
  },
];

apiGroups.forEach(group => {
  if (doc.y > H - 160) newPage();
  fillRect(MARGIN, doc.y, CONTENT_W, 18, group.color);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.white)
     .text(group.prefix, MARGIN + 8, doc.y + 5);
  doc.y += 20;

  group.routes.forEach((r, i) => {
    if (doc.y > H - 60) newPage();
    const rowH = 18;
    fillRect(MARGIN, doc.y, CONTENT_W, rowH, i % 2 === 0 ? C.white : C.lightGray);
    const methodColor = { GET: "#059669", POST: "#1D4ED8", PUT: "#D97706", DELETE: "#DC2626" }[r.method] || C.gray;
    doc.save().roundedRect(MARGIN + 4, doc.y + 4, 32, 11, 2).fill(methodColor).restore();
    doc.font("Helvetica-Bold").fontSize(7).fillColor(C.white)
       .text(r.method, MARGIN + 6, doc.y + 6.5, { width: 28, align: "center", lineBreak: false });
    doc.font("Courier").fontSize(8).fillColor(C.navy)
       .text(r.path, MARGIN + 42, doc.y + 5, { width: 160, lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor(C.subtext)
       .text(r.desc, MARGIN + 210, doc.y + 5, { width: CONTENT_W - 214, lineBreak: false });
    doc.y += rowH;
  });
  doc.y += 6;
});

// ─────────────────────────────────────────────────────────────────────────────
//  END-TO-END PROCESS FLOW
// ─────────────────────────────────────────────────────────────────────────────
newPage();
sectionHeader("30 · End-to-End Process Flow", "6-stage delivery lifecycle managed in BUSINESSNow");

const stages = [
  {
    n: "1", title: "PIPELINE", color: "#7C3AED",
    steps: ["Prospect entered in Customers module with status=Prospect",
            "Opportunity created and tracked through sales pipeline",
            "SOW and rate card negotiated, contract created",
            "Deal closed — account converted to active Customer"],
  },
  {
    n: "2", title: "INITIATION", color: C.blue,
    steps: ["Project created from Blueprint template",
            "PM assigned, go-live date and budget set",
            "Team staffed via Staffing Requests → Allocations",
            "Contract attached, billing model configured"],
  },
  {
    n: "3", title: "PLANNING", color: "#0891B2",
    steps: ["Phases and milestones defined from blueprint",
            "Tasks created with assignees, estimates, due dates",
            "Baseline budget set for burn tracking",
            "Rate cards applied to project for WIP calculation"],
  },
  {
    n: "4", title: "EXECUTION", color: C.green,
    steps: ["Consultants log time weekly via Timesheet grid",
            "PMs review and approve/reject time entries",
            "Milestones marked complete, triggering payment",
            "Change orders raised for scope changes"],
  },
  {
    n: "5", title: "FINANCE", color: C.accent,
    steps: ["WIP engine calculates billable value from approved hours",
            "Finance creates invoices against milestones / WIP",
            "Invoices sent to client, tracked in AR aging",
            "Payments collected, margin % tracked vs target"],
  },
  {
    n: "6", title: "CLOSE", color: "#DC2626",
    steps: ["All milestones completed, project closed",
            "Final invoice issued and collected",
            "Resource allocations removed, capacity freed",
            "Project archived, health history retained for AM"],
  },
];

const stageW = (CONTENT_W - 5 * 8) / 3;
stages.forEach((s, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = MARGIN + col * (stageW + 8);
  const y = doc.y + row * 170;

  fillRect(x, y, stageW, 28, s.color);
  doc.save().roundedRect(x + 6, y + 7, 18, 14, 3).fill("rgba(255,255,255,0.2)").restore();
  doc.font("Helvetica-Bold").fontSize(11).fillColor(C.white)
     .text(s.n, x + 9, y + 9.5, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.white)
     .text(s.title, x + 32, y + 10, { lineBreak: false });

  let sy = y + 32;
  s.steps.forEach((step, j) => {
    fillRect(x, sy, stageW, 30, j % 2 === 0 ? "#F8FAFC" : C.white);
    doc.save().rect(x, sy, 3, 30).fill(s.color).restore();
    doc.save().circle(x + 10, sy + 15, 4).fill(s.color).restore();
    doc.font("Helvetica").fontSize(7.5).fillColor(C.subtext)
       .text(step, x + 18, sy + 6, { width: stageW - 22 });
    sy += 31;
  });

  // Arrow connector (horizontal)
  if (col < 2) {
    const arrowX = x + stageW + 2;
    const arrowY = y + 14;
    doc.save().moveTo(arrowX, arrowY).lineTo(arrowX + 6, arrowY)
       .strokeColor(C.lightGray).lineWidth(1.5).stroke().restore();
    doc.save().moveTo(arrowX + 4, arrowY - 3).lineTo(arrowX + 8, arrowY)
       .lineTo(arrowX + 4, arrowY + 3)
       .strokeColor(C.lightGray).lineWidth(1.5).stroke().restore();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  BACK COVER
// ─────────────────────────────────────────────────────────────────────────────
newPage();
fillRect(0, 0, W, H, C.navy);
fillRect(0, H * 0.65, W, H * 0.35, "#0B1526");
fillRect(0, H * 0.63, W, 3, C.accent);

doc.save().opacity(0.06).circle(W - 80, H * 0.3, 200).fill(C.lightBlue).restore();
doc.save().opacity(0.04).circle(60, H * 0.8, 120).fill(C.blue).restore();

doc.font("Helvetica-Bold").fontSize(30).fillColor(C.white)
   .text("BUSINESSNow", MARGIN, H * 0.2, { align: "center", width: CONTENT_W });
doc.font("Helvetica").fontSize(13).fillColor("#94A3B8")
   .text("Delivery Command Center", MARGIN, H * 0.2 + 38, { align: "center", width: CONTENT_W });

hRule(H * 0.2 + 66, "#1E3A5F");

doc.font("Helvetica").fontSize(11).fillColor("#CBD5E1")
   .text("Built for KSAP Technologies\nOracle Transportation Management Consulting", MARGIN, H * 0.2 + 80, { align: "center", width: CONTENT_W });

doc.font("Helvetica").fontSize(9).fillColor("#64748B")
   .text("This document is confidential and intended for internal use only.\nAll rights reserved © KSAP Technologies.", MARGIN, H * 0.8, { align: "center", width: CONTENT_W });

doc.font("Helvetica").fontSize(8.5).fillColor("#475569")
   .text(`BUSINESSNow v7.0  ·  ${new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long" })}  ·  ksaptechnologies.com`, MARGIN, H * 0.88, { align: "center", width: CONTENT_W });

// ── Finalize ─────────────────────────────────────────────────────────────────
doc.end();
stream.on("finish", () => {
  const size = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`✓ PDF generated: ${OUT} (${size} MB)`);
});
stream.on("error", err => {
  console.error("PDF error:", err);
  process.exit(1);
});
