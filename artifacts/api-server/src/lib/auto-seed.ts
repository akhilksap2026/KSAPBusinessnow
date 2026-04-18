import { db } from "@workspace/db";
import { sql, eq, lt } from "drizzle-orm";
import {
  usersTable,
  accountsTable,
  projectsTable,
  milestonesTable,
  tasksTable,
  resourcesTable,
  allocationsTable,
  timesheetsTable,
  invoicesTable,
  contractsTable,
  changeRequestsTable,
  notificationsTable,
  phasesTable,
  opportunitiesTable,
  rateCardsTable,
  prospectsTable,
  proposalsTable,
  templatesTable,
  templateTasksTable,
  automationsTable,
  formsTable,
  renewalSignalsTable,
  closureChecklistsTable,
  handoverSummariesTable,
  timeEntryCategoriesTable,
  taskCommentsTable,
  milestoneCommentsTable,
  staffingRequestsTable,
} from "@workspace/db";

export async function autoSeedIfEmpty() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(accountsTable);
  if (Number(count) > 0) {
    console.log("[auto-seed] Database already has data — skipping seed.");
    await seedSupplementalIfEmpty();
    return;
  }
  await runSeed();
}

export async function runSeed() {
  console.log("[auto-seed] Seeding demo data...");

  // ── Users ─────────────────────────────────────────────────────────────────
  const users = await db.insert(usersTable).values([
    { name: "Rachel Nguyen",   email: "rachel.nguyen@businessnow.com",       role: "admin",               title: "System Administrator",   active: true },
    { name: "James Whitfield", email: "james.whitfield@businessnow.com",     role: "executive",            title: "Managing Partner",       active: true },
    { name: "Jana Kovac",      email: "jana.kovac@businessnow.com",          role: "delivery_director",    title: "VP of Delivery",         active: true },
    { name: "Alex Okafor",     email: "alex.okafor@businessnow.com",         role: "project_manager",      title: "Senior Project Manager", active: true },
    { name: "Priya Mehta",     email: "priya.mehta@businessnow.com",         role: "project_manager",      title: "Project Manager",        active: true },
    { name: "Tom Kirkland",    email: "tom.kirkland@businessnow.com",        role: "project_manager",      title: "Project Manager",        active: true },
    { name: "Derek Tran",      email: "derek.tran@businessnow.com",          role: "technical_consultant", title: "Principal OTM Specialist",  active: true },
    { name: "Aisha Johnson",   email: "aisha.johnson@businessnow.com",       role: "technical_consultant", title: "OTM Rate Engine Specialist", active: true },
    { name: "Marcus Webb",     email: "marcus.webb@businessnow.com",         role: "technical_consultant", title: "OTM Functional Consultant",  active: true },
    { name: "Maria Santos",    email: "maria.santos@businessnow.com",        role: "resource_manager",     title: "HR & People Manager",    active: true },
    { name: "Sandra Liu",      email: "sandra.liu@businessnow.com",          role: "finance_lead",         title: "Accounts Head",          active: true },
    { name: "Ben Patterson",   email: "ben.patterson@businessnow.com",       role: "finance_lead",         title: "Senior Accountant",      active: true },
    { name: "Diana Flores",    email: "diana.flores@businessnow.com",        role: "sales",                title: "Account Executive",      active: true },
    { name: "Chris Morgan",    email: "chris.morgan@businessnow.com",        role: "sales",                title: "Account Executive",      active: true },
    { name: "Yuki Nakamura",   email: "yuki.nakamura@businessnow.com",       role: "account_manager",      title: "Account Manager",        active: true },
    { name: "Carlos Rivera",   email: "carlos.rivera@businessnow.com",       role: "account_manager",      title: "Account Manager",        active: true },
    { name: "Robert Chen",     email: "robert.chen@client.globaltrans.com",  role: "client_stakeholder",   title: "IT Director",            active: true },
    { name: "Angela Torres",   email: "angela.torres@client.apexlogistics.com", role: "client_stakeholder", title: "VP Operations",        active: true },
  ]).returning();
  console.log(`[auto-seed] Inserted ${users.length} users`);

  const admin      = users[0];  // Rachel Nguyen  (id 1)
  const exec       = users[1];  // James Whitfield (id 2)
  const director   = users[2];  // Jana Kovac     (id 3)
  const pm1        = users[3];  // Alex Okafor    (id 4)
  const pm2        = users[4];  // Priya Mehta    (id 5)
  const pm3        = users[5];  // Tom Kirkland   (id 6)
  const consultant1= users[6];  // Derek Tran     (id 7)
  const consultant2= users[7];  // Aisha Johnson  (id 8)
  const consultant3= users[8];  // Marcus Webb    (id 9)
  const rm1        = users[9];  // Maria Santos   (id 10)
  const fin1       = users[10]; // Sandra Liu     (id 11)
  const fin2       = users[11]; // Ben Patterson  (id 12)

  // ── Reporting hierarchy (reportsToId) ─────────────────────────────────────
  await Promise.all([
    db.update(usersTable).set({ reportsToId: exec.id     }).where(eq(usersTable.id, director.id)),     // Jana  → James
    db.update(usersTable).set({ reportsToId: director.id }).where(eq(usersTable.id, pm1.id)),          // Alex  → Jana
    db.update(usersTable).set({ reportsToId: director.id }).where(eq(usersTable.id, pm2.id)),          // Priya → Jana
    db.update(usersTable).set({ reportsToId: director.id }).where(eq(usersTable.id, pm3.id)),          // Tom   → Jana
    db.update(usersTable).set({ reportsToId: pm1.id      }).where(eq(usersTable.id, consultant1.id)),  // Derek  → Alex
    db.update(usersTable).set({ reportsToId: pm2.id      }).where(eq(usersTable.id, consultant2.id)),  // Aisha  → Priya
    db.update(usersTable).set({ reportsToId: pm3.id      }).where(eq(usersTable.id, consultant3.id)),  // Marcus → Tom
    db.update(usersTable).set({ reportsToId: director.id }).where(eq(usersTable.id, rm1.id)),          // Maria → Jana
    db.update(usersTable).set({ reportsToId: admin.id    }).where(eq(usersTable.id, fin1.id)),         // Sandra → Rachel
    db.update(usersTable).set({ reportsToId: fin1.id     }).where(eq(usersTable.id, fin2.id)),         // Ben    → Sandra
  ]);
  console.log("[auto-seed] Org hierarchy (reportsToId) set");
  const sales1     = users[12]; // Diana Flores
  const sales2     = users[13]; // Chris Morgan
  const am1        = users[14]; // Yuki Nakamura
  const am2        = users[15]; // Carlos Rivera
  const clientStk1 = users[16]; // Robert Chen
  const clientStk2 = users[17]; // Angela Torres

  // ── Accounts ──────────────────────────────────────────────────────────────
  const accounts = await db.insert(accountsTable).values([
    // 0
    { name: "GlobalTrans Corp",        industry: "Third-Party Logistics",  segment: "enterprise", status: "active",   healthScore: 82, annualContractValue: "480000", accountOwnerId: sales1.id, region: "North America", otmVersion: "23D", cloudDeployment: true,  renewalDate: "2025-06-30" },
    // 1
    { name: "Apex Logistics",          industry: "Supply Chain",           segment: "enterprise", status: "at_risk",  healthScore: 58, annualContractValue: "320000", accountOwnerId: sales1.id, region: "EMEA",          otmVersion: "23C", cloudDeployment: false, renewalDate: "2025-08-15" },
    // 2
    { name: "NorthStar Freight",       industry: "Freight Forwarding",     segment: "mid_market", status: "active",   healthScore: 91, annualContractValue: "210000", accountOwnerId: sales2.id, region: "North America", otmVersion: "24A", cloudDeployment: true,  renewalDate: "2025-12-31" },
    // 3
    { name: "Pacific Distribution",    industry: "Distribution",           segment: "mid_market", status: "active",   healthScore: 73, annualContractValue: "175000", accountOwnerId: sales2.id, region: "APAC",          otmVersion: "23B", cloudDeployment: false, renewalDate: "2025-09-30" },
    // 4
    { name: "Meridian Carriers",       industry: "Transportation",         segment: "enterprise", status: "prospect", healthScore: 0,  annualContractValue: "540000", accountOwnerId: sales1.id, region: "North America", otmVersion: null,  cloudDeployment: true,  renewalDate: null },
    // 5
    { name: "BlueStar Transport",      industry: "LTL Freight",            segment: "enterprise", status: "active",   healthScore: 77, annualContractValue: "395000", accountOwnerId: sales2.id, region: "North America", otmVersion: "24B", cloudDeployment: true,  renewalDate: "2026-01-31" },
    // 6
    { name: "Summit Freight Partners", industry: "Intermodal Logistics",   segment: "mid_market", status: "at_risk",  healthScore: 61, annualContractValue: "155000", accountOwnerId: sales1.id, region: "North America", otmVersion: "23C", cloudDeployment: false, renewalDate: "2025-07-31" },
    // 7
    { name: "Harbor Logistics Group",  industry: "Ocean Freight",          segment: "enterprise", status: "inactive", healthScore: 34, annualContractValue: "0",      accountOwnerId: sales2.id, region: "EMEA",          otmVersion: "23A", cloudDeployment: false, renewalDate: null },
  ]).returning();
  console.log(`[auto-seed] Inserted ${accounts.length} accounts`);

  // ── Projects ──────────────────────────────────────────────────────────────
  const projects = await db.insert(projectsTable).values([
    // 0
    { name: "GlobalTrans OTM Cloud Migration",     accountId: accounts[0].id, accountName: accounts[0].name, type: "cloud_migration",   status: "active",   healthScore: 78, pmId: pm1.id, pmName: pm1.name, startDate: "2024-09-01", endDate: "2026-10-31", goLiveDate: "2025-05-15", budgetHours: "2400", consumedHours: "1620", budgetValue: "480000", billedValue: "280000", completionPct: 67, visibility: "shared_with_client", description: "Full OTM cloud migration from on-premise 23C to Oracle SaaS including data migration, integration re-platforming, and UAT." },
    // 1
    { name: "Apex OTM Rate Engine Implementation", accountId: accounts[1].id, accountName: accounts[1].name, type: "implementation",    status: "at_risk",  healthScore: 55, pmId: pm2.id, pmName: pm2.name, startDate: "2024-11-01", endDate: "2025-07-31", goLiveDate: "2025-07-01", budgetHours: "1800", consumedHours: "980",  budgetValue: "320000", billedValue: "145000", completionPct: 45, visibility: "shared_with_client", description: "OTM rate engine configuration and rate maintenance system implementation for EMEA freight operations." },
    // 2
    { name: "NorthStar AMS Retainer",              accountId: accounts[2].id, accountName: accounts[2].name, type: "ams",               status: "active",   healthScore: 94, pmId: pm3.id, pmName: pm3.name, startDate: "2024-01-01", endDate: "2026-12-31", goLiveDate: null,         budgetHours: "960",  consumedHours: "520",  budgetValue: "210000", billedValue: "112500", completionPct: 54, visibility: "shared_with_client", description: "Ongoing AMS including monthly OTM certification support, break-fix, and enhancement delivery." },
    // 3
    { name: "Pacific OTM 23D Certification",       accountId: accounts[3].id, accountName: accounts[3].name, type: "certification",     status: "active",   healthScore: 70, pmId: pm1.id, pmName: pm1.name, startDate: "2025-03-01", endDate: "2026-10-31", goLiveDate: "2025-05-30", budgetHours: "320",  consumedHours: "140",  budgetValue: "56000",  billedValue: "28000",  completionPct: 44, visibility: "internal_only", description: "Quarterly OTM certification testing for 23D release including regression suite and issue resolution." },
    // 4
    { name: "GlobalTrans Data Acceleration",       accountId: accounts[0].id, accountName: accounts[0].name, type: "data_acceleration", status: "on_hold",  healthScore: 62, pmId: pm2.id, pmName: pm2.name, startDate: "2025-02-01", endDate: "2025-04-30", goLiveDate: null,         budgetHours: "480",  consumedHours: "120",  budgetValue: "95000",  billedValue: "22000",  completionPct: 25, visibility: "internal_only", description: "Bulk rate and shipment data loading using OTM data accelerator tools and ETL automation." },
    // 5
    { name: "BlueStar OTM Cloud Implementation",   accountId: accounts[5].id, accountName: accounts[5].name, type: "cloud_migration",   status: "active",   healthScore: 82, pmId: pm3.id, pmName: pm3.name, startDate: "2024-12-01", endDate: "2025-11-30", goLiveDate: "2025-08-30", budgetHours: "1920", consumedHours: "780",  budgetValue: "395000", billedValue: "148000", completionPct: 41, visibility: "shared_with_client", description: "End-to-end OTM SaaS implementation for LTL carrier management and shipment optimization." },
    // 6
    { name: "Summit Freight AMS Support",          accountId: accounts[6].id, accountName: accounts[6].name, type: "ams",               status: "active",   healthScore: 65, pmId: pm2.id, pmName: pm2.name, startDate: "2024-06-01", endDate: "2025-05-31", goLiveDate: null,         budgetHours: "480",  consumedHours: "390",  budgetValue: "155000", billedValue: "130000", completionPct: 81, visibility: "shared_with_client", description: "Annual AMS retainer for OTM incident management, certifications, and minor enhancements." },
    // 7
    { name: "Apex EMEA Order Management Module",   accountId: accounts[1].id, accountName: accounts[1].name, type: "implementation",    status: "active",   healthScore: 71, pmId: pm1.id, pmName: pm1.name, startDate: "2025-04-01", endDate: "2025-12-31", goLiveDate: "2025-11-01", budgetHours: "960",  consumedHours: "120",  budgetValue: "215000", billedValue: "35000",  completionPct: 13, visibility: "shared_with_client", description: "Phase 2 expansion adding Order Management and Shipment Execution modules for EMEA operations." },
    // 8
    { name: "GlobalTrans Integration Upgrade",     accountId: accounts[0].id, accountName: accounts[0].name, type: "implementation",    status: "planning", healthScore: 88, pmId: pm3.id, pmName: pm3.name, startDate: "2025-06-01", endDate: "2025-12-31", goLiveDate: "2025-11-30", budgetHours: "640",  consumedHours: "0",    budgetValue: "175000", billedValue: "0",      completionPct: 0,  visibility: "internal_only", description: "Modernize GlobalTrans OTM integrations to REST APIs after cloud migration go-live, replacing legacy EDI connectors." },
  ]).returning();
  console.log(`[auto-seed] Inserted ${projects.length} projects`);

  // ── Milestones ────────────────────────────────────────────────────────────
  const milestones = await db.insert(milestonesTable).values([
    // Project 0 — GlobalTrans Cloud Migration
    { projectId: projects[0].id, projectName: projects[0].name, name: "Integration Assessment Complete",    dueDate: "2025-01-31", completedDate: "2025-01-28", status: "completed",   isBillable: true,  billableAmount: "45000", invoiced: true,  visibility: "shared_with_client", description: "Document all existing OTM integrations and design cloud-compatible architecture" },
    { projectId: projects[0].id, projectName: projects[0].name, name: "DEV Environment Configuration",     dueDate: "2025-02-28", completedDate: "2025-03-05", status: "completed",   isBillable: true,  billableAmount: "65000", invoiced: true,  visibility: "shared_with_client", description: "Configure OTM SaaS DEV environment with initial data loads" },
    { projectId: projects[0].id, projectName: projects[0].name, name: "System Integration Testing",        dueDate: "2025-04-15", completedDate: null,          status: "in_progress", isBillable: true,  billableAmount: "80000", invoiced: false, visibility: "shared_with_client", description: "End-to-end SIT including all integration touchpoints" },
    { projectId: projects[0].id, projectName: projects[0].name, name: "User Acceptance Testing",           dueDate: "2025-05-01", completedDate: null,          status: "pending",     isBillable: true,  billableAmount: "55000", invoiced: false, visibility: "shared_with_client", description: "Client UAT with sign-off documentation" },
    { projectId: projects[0].id, projectName: projects[0].name, name: "Go-Live & Hypercare",               dueDate: "2025-05-15", completedDate: null,          status: "pending",     isBillable: true,  billableAmount: "90000", invoiced: false, visibility: "shared_with_client", description: "Production cutover and 2-week hypercare support" },
    // Project 1 — Apex Rate Engine
    { projectId: projects[1].id, projectName: projects[1].name, name: "Rate Engine Design",                dueDate: "2025-01-15", completedDate: null,          status: "overdue",     isBillable: true,  billableAmount: "35000", invoiced: false, visibility: "shared_with_client", description: "Configuration design for all carrier rate types and surcharges" },
    { projectId: projects[1].id, projectName: projects[1].name, name: "Rate Build Complete",               dueDate: "2025-03-31", completedDate: null,          status: "at_risk",     isBillable: true,  billableAmount: "60000", invoiced: false, visibility: "shared_with_client", description: "All rate records entered and validated in DEV" },
    // Project 2 — NorthStar AMS
    { projectId: projects[2].id, projectName: projects[2].name, name: "Q1 2025 Certification",             dueDate: "2025-03-31", completedDate: "2025-03-28", status: "completed",   isBillable: true,  billableAmount: "18000", invoiced: true,  visibility: "shared_with_client", description: "OTM 24A quarterly certification test execution" },
    { projectId: projects[2].id, projectName: projects[2].name, name: "Q2 2025 Certification",             dueDate: "2025-06-30", completedDate: null,          status: "pending",     isBillable: true,  billableAmount: "18000", invoiced: false, visibility: "shared_with_client", description: "OTM 24B quarterly certification test execution" },
    // Project 3 — Pacific 23D
    { projectId: projects[3].id, projectName: projects[3].name, name: "23D Test Plan Finalized",           dueDate: "2025-03-15", completedDate: null,          status: "overdue",     isBillable: false, billableAmount: null,    invoiced: false, visibility: "internal_only",       description: "Complete test plan for 23D with regression scope" },
    { projectId: projects[3].id, projectName: projects[3].name, name: "23D Certification Complete",        dueDate: "2025-05-30", completedDate: null,          status: "pending",     isBillable: true,  billableAmount: "28000", invoiced: false, visibility: "shared_with_client", description: "All regression tests passed, release approved" },
    // Project 5 — BlueStar
    { projectId: projects[5].id, projectName: projects[5].name, name: "Blueprint & Architecture Sign-Off", dueDate: "2025-01-31", completedDate: "2025-01-29", status: "completed",   isBillable: true,  billableAmount: "55000", invoiced: true,  visibility: "shared_with_client", description: "Approved architecture design for OTM SaaS implementation" },
    { projectId: projects[5].id, projectName: projects[5].name, name: "OTM Configuration Complete",        dueDate: "2025-04-15", completedDate: null,          status: "in_progress", isBillable: true,  billableAmount: "95000", invoiced: false, visibility: "shared_with_client", description: "Core OTM module configuration in DEV and QA environments" },
    { projectId: projects[5].id, projectName: projects[5].name, name: "UAT Sign-Off",                      dueDate: "2025-07-31", completedDate: null,          status: "pending",     isBillable: true,  billableAmount: "70000", invoiced: false, visibility: "shared_with_client", description: "Full user acceptance testing with client sign-off" },
    { projectId: projects[5].id, projectName: projects[5].name, name: "Go-Live",                           dueDate: "2025-08-30", completedDate: null,          status: "pending",     isBillable: true,  billableAmount: "85000", invoiced: false, visibility: "shared_with_client", description: "Production cutover and hypercare period" },
    // Project 7 — Apex EMEA
    { projectId: projects[7].id, projectName: projects[7].name, name: "EMEA Scoping & Design",             dueDate: "2025-05-15", completedDate: null,          status: "in_progress", isBillable: true,  billableAmount: "35000", invoiced: false, visibility: "shared_with_client", description: "Requirements analysis and solution design for EMEA order management" },
  ]).returning();
  console.log(`[auto-seed] Inserted ${milestones.length} milestones`);

  // ── Resources ─────────────────────────────────────────────────────────────
  // Org structure:
  //   [0]      System Administrator
  //   [1]      Delivery Director
  //   [2-3]    Finance (Accounts Head + Accountant)
  //   [4]      HR Manager
  //   [5-7]    Project Managers (3)
  //   [8-17]   OTM Specialists (10)
  //   [18-27]  Software Developers (10)
  //   [28-31]  Additional: Solution Architect, Cloud Architect, QA Lead, Test Engineer
  const resources = await db.insert(resourcesTable).values([
    // ── [0] System Administrator ──────────────────────────────────────────
    { userId: admin.id,       name: "Rachel Nguyen",     title: "System Administrator",           practiceArea: "admin",          employmentType: "employee",  skills: ["Platform Administration","User Management","Data Governance"],          certifications: [],                                                                                                      specialties: ["System Configuration","Access Control","Reporting"],                           utilizationTarget: 0,  currentUtilization: 0,   status: "available",      hourlyRate: "0",   costRate: "55",  currency: "USD", location: "Austin, TX",        timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Manages the BUSINESSNow platform configuration, user access, and data governance." },
    // ── [1] Delivery Director ─────────────────────────────────────────────
    { userId: director.id,    name: "Jana Kovac",        title: "VP of Delivery",                 practiceArea: "delivery",       employmentType: "employee",  skills: ["Delivery Management","P&L","OTM Practice","Executive Stakeholder Mgmt","Pre-Sales"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist","PMP"],            specialties: ["OTM Practice Leadership","Revenue Growth","Delivery Excellence"],              utilizationTarget: 40, currentUtilization: 35,  status: "available",      hourlyRate: "275", costRate: "130", currency: "USD", location: "Chicago, IL",       timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "VP of Delivery overseeing all OTM implementations and AMS engagements. 16 years in Oracle OTM consulting." },
    // ── [2] Accounts Head ─────────────────────────────────────────────────
    { userId: fin1.id,        name: "Sandra Liu",        title: "Accounts Head",                  practiceArea: "finance",        employmentType: "employee",  skills: ["Financial Reporting","Revenue Recognition","Project Billing","Budgeting","AR/AP"],  certifications: ["CPA","QuickBooks Certified"],                                                   specialties: ["Time & Billing","P&L Analysis","Invoice Management"],                          utilizationTarget: 0,  currentUtilization: 0,   status: "available",      hourlyRate: "0",   costRate: "90",  currency: "USD", location: "Chicago, IL",       timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Heads the finance function overseeing project billing, AR/AP, and financial reporting for all client engagements." },
    // ── [3] Accountant ────────────────────────────────────────────────────
    { userId: fin2.id,        name: "Ben Patterson",     title: "Senior Accountant",              practiceArea: "finance",        employmentType: "employee",  skills: ["Accounts Receivable","Invoice Processing","Expense Reporting","Payroll","Tax Compliance"], certifications: ["CPA (In Progress)"],                                                        specialties: ["Invoice Reconciliation","Expense Management","Month-End Close"],               utilizationTarget: 0,  currentUtilization: 0,   status: "available",      hourlyRate: "0",   costRate: "70",  currency: "USD", location: "Nashville, TN",     timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Manages day-to-day accounting operations including AR, AP, payroll support, and month-end close activities." },
    // ── [4] HR Manager ────────────────────────────────────────────────────
    { userId: rm1.id,         name: "Maria Santos",      title: "HR & People Manager",            practiceArea: "hr",             employmentType: "employee",  skills: ["Talent Acquisition","Employee Relations","Onboarding","Performance Management","Resource Planning"], certifications: ["SHRM-CP"],                                                              specialties: ["Consultant Onboarding","Resource Utilization","PTO Management"],               utilizationTarget: 0,  currentUtilization: 0,   status: "available",      hourlyRate: "0",   costRate: "80",  currency: "USD", location: "Dallas, TX",        timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Manages HR operations including talent acquisition, onboarding, PTO tracking, and resource capacity planning." },
    // ── [5] Senior PM ─────────────────────────────────────────────────────
    { userId: pm1.id,         name: "Alex Okafor",       title: "Senior Project Manager",         practiceArea: "delivery",       employmentType: "employee",  skills: ["Project Management","Risk Management","OTM Delivery","RAID Management","Executive Reporting"], certifications: ["PMP","Oracle OTM Cloud Certified Implementation Specialist"],            specialties: ["Enterprise Cloud Migrations","Stakeholder Management","Go-Live Planning"],     utilizationTarget: 80, currentUtilization: 85,  status: "allocated",      hourlyRate: "210", costRate: "100", currency: "USD", location: "Chicago, IL",       timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Senior PM with 11 years leading complex OTM cloud migrations and multi-phase implementations across North America." },
    // ── [6] Project Manager ───────────────────────────────────────────────
    { userId: pm2.id,         name: "Priya Mehta",       title: "Project Manager",                practiceArea: "delivery",       employmentType: "employee",  skills: ["Project Management","Agile","OTM Delivery","Stakeholder Mgmt","Budget Tracking"],    certifications: ["PMP","Agile Certified Practitioner"],                                          specialties: ["Rate Engine Projects","AMS Engagements","Client Communication"],               utilizationTarget: 80, currentUtilization: 90,  status: "allocated",      hourlyRate: "190", costRate: "90",  currency: "USD", location: "Houston, TX",       timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Project Manager specializing in OTM rate engine and AMS retainer engagements. Strong background in Agile delivery." },
    // ── [7] Project Manager ───────────────────────────────────────────────
    { userId: pm3.id,         name: "Tom Kirkland",      title: "Project Manager",                practiceArea: "delivery",       employmentType: "employee",  skills: ["Project Management","OTM Delivery","Change Management","Risk Tracking","MS Project"],  certifications: ["PMP","Oracle OTM Cloud Certified Implementation Specialist"],            specialties: ["OTM SaaS Implementations","AMS Transitions","Go-Live Coordination"],          utilizationTarget: 80, currentUtilization: 75,  status: "allocated",      hourlyRate: "190", costRate: "90",  currency: "USD", location: "Atlanta, GA",       timezone: "America/New_York",    isContractor: false, dailyHoursCapacity: 8, bio: "Project Manager with 8 years in OTM SaaS implementations and AMS transition projects for logistics clients." },
    // ── [8-17] OTM Specialists ────────────────────────────────────────────
    // [8] Principal OTM Specialist
    { userId: consultant1.id, name: "Derek Tran",        title: "Principal OTM Specialist",       practiceArea: "implementation", employmentType: "employee",  skills: ["OTM Configuration","Rate Engine","Carrier Management","Transportation Planning","OTM APIs"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist","Oracle Cloud Infrastructure Foundations"], specialties: ["OTM Carrier Management","Rate Configuration","S&OP Integration"],   utilizationTarget: 80, currentUtilization: 100, status: "allocated",      hourlyRate: "235", costRate: "112", currency: "USD", location: "Chicago, IL",       timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Principal OTM Specialist with 14 years configuring OTM for global shippers. Expert in rate engine, carrier management, and transportation planning." },
    // [9] OTM Rate Engine Specialist
    { userId: consultant2.id, name: "Aisha Johnson",     title: "OTM Rate Engine Specialist",     practiceArea: "implementation", employmentType: "employee",  skills: ["OTM Rate Engine","Carrier Rate Analysis","EDI 204/990/214","Rate Maintenance","Spot Quoting"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist"],              specialties: ["Rate Management","Carrier Rate Negotiation","Surcharge Configuration"],        utilizationTarget: 80, currentUtilization: 85,  status: "allocated",      hourlyRate: "200", costRate: "95",  currency: "USD", location: "Dallas, TX",        timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Rate engine specialist with 9 years configuring OTM carrier rates, surcharges, and spot quote automation across NA and EMEA." },
    // [10] OTM Functional Lead (India / APAC)
    { name: "Ramesh Iyer",     title: "OTM Functional Lead",            practiceArea: "implementation", employmentType: "employee",  skills: ["OTM Configuration","Functional Design","Order Management","Shipment Execution","Business Process Reengineering"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist","Oracle Transportation Cloud 2023 Implementation"], specialties: ["OTM Functional Architecture","Order Management","APAC Logistics"], utilizationTarget: 80, currentUtilization: 110, status: "over_allocated", hourlyRate: "180", costRate: "55",  currency: "USD", location: "Bengaluru, India",  timezone: "Asia/Kolkata",        isContractor: false, dailyHoursCapacity: 8, bio: "Functional lead with 10 years in OTM implementations across APAC. Deep expertise in order management and shipment execution modules." },
    // [11] OTM Transportation Planning Specialist (India / APAC)
    { name: "Kavya Nair",      title: "OTM Transportation Planning Specialist", practiceArea: "implementation", employmentType: "employee", skills: ["OTM Transportation Planning","Route Optimization","Bulk Planning","Carrier Allocation","Load Building"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist"],             specialties: ["Bulk Planning","Route Optimization","Carrier Allocation"],                     utilizationTarget: 80, currentUtilization: 80,  status: "allocated",      hourlyRate: "165", costRate: "50",  currency: "USD", location: "Hyderabad, India",  timezone: "Asia/Kolkata",        isContractor: false, dailyHoursCapacity: 8, bio: "Specialist in OTM transportation planning, route optimization, and bulk shipment planning for large-scale logistics networks." },
    // [12] OTM Carrier Management Specialist (Mexico / LATAM)
    { name: "Santiago Gomez",  title: "OTM Carrier Management Specialist", practiceArea: "implementation", employmentType: "employee", skills: ["OTM Carrier Management","Carrier Scorecard","EDI X12","Carrier Onboarding","Rate Compliance"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist"],              specialties: ["Carrier Onboarding","EDI Integration","LATAM Carrier Networks"],               utilizationTarget: 80, currentUtilization: 70,  status: "allocated",      hourlyRate: "155", costRate: "48",  currency: "USD", location: "Mexico City, Mexico",timezone: "America/Mexico_City", isContractor: false, dailyHoursCapacity: 8, bio: "Carrier management specialist with expertise in OTM carrier onboarding, EDI configuration, and LATAM carrier network optimization." },
    // [13] OTM AMS Specialist (India / APAC)
    { name: "Preethi Sundaram",title: "OTM AMS Specialist",              practiceArea: "ams",            employmentType: "employee",  skills: ["OTM Support","Incident Management","OTM Configuration","Release Management","Certification Testing"], certifications: ["Oracle OTM Support Specialist","ITIL Foundation"],                    specialties: ["AMS Delivery","SLA Management","Monthly Certification"],                       utilizationTarget: 80, currentUtilization: 75,  status: "allocated",      hourlyRate: "150", costRate: "45",  currency: "USD", location: "Chennai, India",    timezone: "Asia/Kolkata",        isContractor: false, dailyHoursCapacity: 8, bio: "AMS specialist managing Tier 2/3 OTM support, monthly certifications, and enhancement delivery for AMS clients." },
    // [14] OTM Functional Consultant (US / NA)
    { userId: consultant3.id, name: "Marcus Webb",       title: "OTM Functional Consultant",      practiceArea: "implementation", employmentType: "employee",  skills: ["OTM Configuration","Functional Design","User Training","UAT Management","Documentation"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist"],               specialties: ["UAT Management","Training Delivery","Functional Documentation"],               utilizationTarget: 80, currentUtilization: 65,  status: "allocated",      hourlyRate: "175", costRate: "85",  currency: "USD", location: "Denver, CO",        timezone: "America/Denver",      isContractor: false, dailyHoursCapacity: 8, bio: "Functional consultant with 7 years in OTM configuration, UAT management, and end-user training for North American clients." },
    // [15] OTM Cloud Specialist (US / NA)
    { name: "Lena Park",       title: "OTM Cloud Specialist",           practiceArea: "cloud_migration",employmentType: "employee",  skills: ["OTM SaaS","OCI","Cloud Migration","Integration Re-platforming","OTM Functional"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist","Oracle Cloud Infrastructure Foundations"], specialties: ["OTM SaaS Migration","OCI Architecture","Functional Configuration"], utilizationTarget: 80, currentUtilization: 90,  status: "allocated",      hourlyRate: "195", costRate: "95",  currency: "USD", location: "Seattle, WA",       timezone: "America/Los_Angeles", isContractor: false, dailyHoursCapacity: 8, bio: "Cloud specialist combining OTM functional expertise with OCI architecture knowledge for end-to-end SaaS migrations." },
    // [16] OTM Configuration Specialist (Mexico / LATAM)
    { name: "Carlos Vega",     title: "OTM Configuration Specialist",   practiceArea: "ams",            employmentType: "employee",  skills: ["OTM Configuration","AMS Support","Incident Triage","Rate Maintenance","Carrier Setup"], certifications: ["Oracle OTM Support Specialist"],                                          specialties: ["AMS Support","OTM Configuration","Incident Management"],                       utilizationTarget: 80, currentUtilization: 72,  status: "allocated",      hourlyRate: "145", costRate: "42",  currency: "USD", location: "Guadalajara, Mexico",timezone: "America/Mexico_City", isContractor: false, dailyHoursCapacity: 8, bio: "OTM configuration and AMS specialist supporting NA and LATAM clients with incident management and enhancement delivery." },
    // [17] OTM Integration Functional Specialist (India / APAC)
    { name: "Haruto Nakamura", title: "OTM Integration Functional Specialist", practiceArea: "integration", employmentType: "employee", skills: ["OTM Integration","Functional Integration Design","OIC","REST APIs","EDI"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist","Oracle Integration Cloud Specialist"], specialties: ["OTM-ERP Functional Integration","API Design","Message Mapping"], utilizationTarget: 80, currentUtilization: 60,  status: "allocated",      hourlyRate: "160", costRate: "48",  currency: "USD", location: "Pune, India",       timezone: "Asia/Kolkata",        isContractor: false, dailyHoursCapacity: 8, bio: "Integration functional specialist bridging OTM configuration and technical integration design for ERP/WMS connectivity projects." },
    // ── [18-27] Software Developers ───────────────────────────────────────
    // [18] Senior Java Developer (US / NA)
    { name: "Kevin Hart",      title: "Senior Java Developer",          practiceArea: "development",    employmentType: "employee",  skills: ["Java","OTM Webservices","REST APIs","Spring Boot","OTM Customization"],          certifications: ["Oracle Certified Professional Java SE 11","Oracle OTM Technical Specialist"], specialties: ["OTM Custom Business Objects","Java Integration","REST Service Development"], utilizationTarget: 80, currentUtilization: 85,  status: "allocated",      hourlyRate: "210", costRate: "100", currency: "USD", location: "Austin, TX",        timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Senior Java developer specializing in OTM webservice customization, REST API development, and Java-based OTM extensions." },
    // [19] Senior Technical Developer (India / APAC)
    { name: "Arun Sharma",     title: "Senior Technical Developer",     practiceArea: "development",    employmentType: "employee",  skills: ["Java","Groovy","OTM Data Accelerator","ETL","SQL","Python"],                    certifications: ["Oracle OTM Technical Specialist","Oracle Database SQL Certified"],             specialties: ["OTM Data Migration","ETL Pipelines","Groovy Scripting"],                       utilizationTarget: 80, currentUtilization: 75,  status: "allocated",      hourlyRate: "185", costRate: "55",  currency: "USD", location: "Bengaluru, India",  timezone: "Asia/Kolkata",        isContractor: false, dailyHoursCapacity: 8, bio: "Senior developer with deep expertise in OTM technical customization, data migration pipelines, and Groovy scripting." },
    // [20] Java/Groovy Developer (India / APAC)
    { name: "Priya Deshpande", title: "Java & Groovy Developer",        practiceArea: "development",    employmentType: "employee",  skills: ["Java","Groovy","XSL","OTM Webservices","SOAP","Custom Agents"],                certifications: ["Oracle OTM Technical Specialist"],                                              specialties: ["Groovy Scripting","Custom Agents","OTM Webservice Integration"],               utilizationTarget: 80, currentUtilization: 80,  status: "allocated",      hourlyRate: "165", costRate: "50",  currency: "USD", location: "Pune, India",       timezone: "Asia/Kolkata",        isContractor: false, dailyHoursCapacity: 8, bio: "Specialist in OTM Groovy scripting, custom agents, and XSL transformation for complex business rule automation." },
    // [21] Integration Developer (Mexico / LATAM)
    { name: "Andrés Medina",   title: "Integration Developer",          practiceArea: "integration",    employmentType: "employee",  skills: ["OIC","REST APIs","SOAP","EDI X12","OTM Integration","MuleSoft"],                certifications: ["Oracle Integration Cloud Specialist","MuleSoft Certified Developer Level 1"], specialties: ["OTM-ERP Integration","OIC Pipelines","EDI Re-platforming"],                    utilizationTarget: 80, currentUtilization: 90,  status: "allocated",      hourlyRate: "175", costRate: "52",  currency: "USD", location: "Monterrey, Mexico",  timezone: "America/Mexico_City", isContractor: false, dailyHoursCapacity: 8, bio: "Integration developer specializing in OTM-to-ERP/WMS connectivity using Oracle Integration Cloud, REST, and EDI X12." },
    // [22] OTM Technical Developer (US / NA)
    { name: "Brendan Walsh",   title: "OTM Technical Developer",        practiceArea: "development",    employmentType: "employee",  skills: ["OTM Customization","Java","Rate Entry Automation","OTM Webservices","SQL"],    certifications: ["Oracle OTM Technical Specialist"],                                              specialties: ["Rate Engine Automation","Bulk Data Loading","OTM Custom Development"],          utilizationTarget: 80, currentUtilization: 80,  status: "allocated",      hourlyRate: "185", costRate: "88",  currency: "USD", location: "Memphis, TN",       timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "OTM technical developer focused on rate automation, bulk data loading scripts, and custom OTM webservice integrations." },
    // [23] API Integration Developer (India / APAC)
    { name: "Hui Chen",        title: "API Integration Developer",      practiceArea: "integration",    employmentType: "employee",  skills: ["REST APIs","OIC","JSON","API Gateway","OTM Integration","Postman"],             certifications: ["Oracle Integration Cloud Specialist"],                                          specialties: ["REST API Development","OIC Flow Design","API Testing"],                        utilizationTarget: 80, currentUtilization: 55,  status: "soft_booked",    hourlyRate: "155", costRate: "47",  currency: "USD", location: "Bengaluru, India",  timezone: "Asia/Kolkata",        isContractor: false, dailyHoursCapacity: 8, bio: "API integration developer building and testing OTM REST integrations using Oracle Integration Cloud and Postman automation." },
    // [24] Backend Developer (Mexico / LATAM)
    { name: "Sofia Martínez",  title: "Backend Developer",              practiceArea: "development",    employmentType: "employee",  skills: ["Java","Spring Boot","SQL","OTM APIs","Microservices","Docker"],                 certifications: ["Oracle Certified Professional Java SE 11"],                                      specialties: ["Microservices Architecture","OTM API Integration","Backend Development"],      utilizationTarget: 80, currentUtilization: 60,  status: "available",      hourlyRate: "160", costRate: "48",  currency: "USD", location: "Mexico City, Mexico",timezone: "America/Mexico_City", isContractor: false, dailyHoursCapacity: 8, bio: "Backend developer focused on Java microservices and OTM API integrations for supply chain technology platforms." },
    // [25] Senior OTM Developer (US / NA)
    { name: "James Osei",      title: "Senior OTM Developer",           practiceArea: "development",    employmentType: "employee",  skills: ["OTM Customization","Java","Groovy","OTM Webservices","Technical Architecture"], certifications: ["Oracle OTM Technical Specialist","Oracle Certified Professional Java SE 11"], specialties: ["OTM Technical Architecture","Webservice Customization","Performance Tuning"],  utilizationTarget: 80, currentUtilization: 95,  status: "over_allocated", hourlyRate: "215", costRate: "102", currency: "USD", location: "Atlanta, GA",       timezone: "America/New_York",    isContractor: false, dailyHoursCapacity: 8, bio: "Senior OTM developer and technical architect with 10 years building high-performance OTM customizations for enterprise logistics." },
    // [26] Full Stack Developer (India / APAC)
    { name: "Meera Krishnan",  title: "Full Stack Developer",           practiceArea: "development",    employmentType: "employee",  skills: ["Java","React","OTM APIs","SQL","REST APIs","Node.js"],                          certifications: ["Oracle Certified Associate Java SE 8"],                                          specialties: ["Full Stack Development","OTM Portal Development","Dashboard Reporting"],        utilizationTarget: 80, currentUtilization: 70,  status: "allocated",      hourlyRate: "160", costRate: "48",  currency: "USD", location: "Hyderabad, India",  timezone: "Asia/Kolkata",        isContractor: false, dailyHoursCapacity: 8, bio: "Full stack developer building custom OTM user portals, reporting dashboards, and integration utility tools." },
    // [27] DevOps / Cloud Developer (US / NA)
    { name: "Tyler Brooks",    title: "DevOps & Cloud Developer",       practiceArea: "cloud_migration",employmentType: "employee",  skills: ["OCI","Terraform","CI/CD","Docker","Kubernetes","Shell Scripting","OTM SaaS"], certifications: ["Oracle Cloud Infrastructure Developer Associate","HashiCorp Terraform Associate"], specialties: ["OCI Deployment","CI/CD Pipelines","Cloud Infrastructure Automation"],       utilizationTarget: 80, currentUtilization: 45,  status: "available",      hourlyRate: "195", costRate: "93",  currency: "USD", location: "Portland, OR",      timezone: "America/Los_Angeles", isContractor: false, dailyHoursCapacity: 8, bio: "DevOps engineer automating OTM SaaS deployments on Oracle Cloud Infrastructure using Terraform, Docker, and CI/CD pipelines." },
    // ── [28-31] Additional Roles ──────────────────────────────────────────
    // [28] Solution Architect (US / NA)
    { name: "Kevin O'Brien",   title: "Solution Architect",             practiceArea: "implementation", employmentType: "employee",  skills: ["OTM Solution Design","Enterprise Architecture","OCI","Integration Architecture","Pre-Sales"], certifications: ["Oracle OTM Cloud Certified Implementation Specialist","Oracle Cloud Infrastructure Architect Professional"], specialties: ["Solution Architecture","OTM Enterprise Design","Technical Pre-Sales"], utilizationTarget: 80, currentUtilization: 95,  status: "over_allocated", hourlyRate: "250", costRate: "118", currency: "USD", location: "Chicago, IL",       timezone: "America/Chicago",     isContractor: false, dailyHoursCapacity: 8, bio: "Solution architect designing end-to-end OTM enterprise architectures for large-scale cloud migrations and multi-phase implementations." },
    // [29] Cloud Migration Architect (US / NA)
    { name: "Yuki Tanaka",     title: "Cloud Migration Architect",      practiceArea: "cloud_migration",employmentType: "employee",  skills: ["OTM SaaS","OCI Architecture","Integration Re-platforming","Cloud Strategy","OTM Migration"], certifications: ["Oracle Cloud Infrastructure Architect Associate","Oracle OTM Cloud Certified Implementation Specialist"], specialties: ["OCI Architecture","OTM SaaS Migration","Integration Re-platforming"], utilizationTarget: 80, currentUtilization: 85,  status: "allocated",      hourlyRate: "240", costRate: "115", currency: "USD", location: "San Francisco, CA", timezone: "America/Los_Angeles", isContractor: false, dailyHoursCapacity: 8, bio: "Cloud architect specializing in moving complex on-prem OTM instances to Oracle Cloud Infrastructure with minimal disruption." },
    // [30] QA Lead (Mexico / LATAM)
    { name: "Diana Cruz",      title: "QA Lead",                        practiceArea: "qa_certification",employmentType: "employee", skills: ["OTM Testing","Test Management","Regression Testing","UAT Coordination","JIRA","Selenium"], certifications: ["ISTQB Certified Tester Foundation Level","Oracle OTM QA Specialist"],    specialties: ["OTM Certification Testing","Regression Suite Management","UAT"],              utilizationTarget: 80, currentUtilization: 80,  status: "allocated",      hourlyRate: "155", costRate: "46",  currency: "USD", location: "Guadalajara, Mexico",timezone: "America/Mexico_City", isContractor: false, dailyHoursCapacity: 8, bio: "QA lead managing OTM release certifications, regression suites, and UAT coordination for cloud migration and implementation projects." },
    // [31] Test Engineer (India / APAC)
    { name: "Vikram Patel",    title: "Test Engineer",                  practiceArea: "qa_certification",employmentType: "employee", skills: ["OTM Testing","Manual Testing","Test Case Design","Defect Management","UAT Support"], certifications: ["ISTQB Certified Tester Foundation Level"],                                    specialties: ["OTM Regression Testing","Defect Analysis","Test Automation"],                  utilizationTarget: 80, currentUtilization: 65,  status: "allocated",      hourlyRate: "135", costRate: "40",  currency: "USD", location: "Chennai, India",    timezone: "Asia/Kolkata",        isContractor: false, dailyHoursCapacity: 8, bio: "Test engineer executing OTM regression suites, writing test cases, and managing defect tracking for certification and UAT phases." },
  ]).returning();
  console.log(`[auto-seed] Inserted ${resources.length} resources`);

  // ── Allocations ───────────────────────────────────────────────────────────
  // Resource index guide:
  //  [5]=Alex PM  [6]=Priya PM  [7]=Tom PM  [8]=Derek(OTM)  [9]=Aisha(Rate)
  //  [10]=Ramesh  [11]=Kavya    [12]=Santiago  [13]=Preethi  [14]=Marcus(OTM)
  //  [15]=Lena    [16]=Carlos V [17]=Haruto    [18]=Kevin H(Dev)  [19]=Arun
  //  [20]=Priya D [21]=Andrés   [22]=Brendan   [23]=Hui      [25]=James
  //  [28]=Kevin O'Brien(Arch)  [29]=Yuki(Cloud)  [30]=Diana Cruz(QA)  [31]=Vikram
  await db.insert(allocationsTable).values([
    // Project 0 — GlobalTrans Cloud Migration
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[28].id, resourceName: resources[28].name, role: "Solution Architect",       allocationPct: 60, startDate: "2024-09-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "24" },
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[21].id, resourceName: resources[21].name, role: "Integration Developer",     allocationPct: 80, startDate: "2024-09-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "32" },
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[19].id, resourceName: resources[19].name, role: "Data Migration Lead",       allocationPct: 60, startDate: "2024-11-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "24" },
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[29].id, resourceName: resources[29].name, role: "Cloud Architect",           allocationPct: 50, startDate: "2025-03-01", endDate: "2026-10-31", status: "tentative", allocationType: "soft", hoursPerWeek: "20" },
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[30].id, resourceName: resources[30].name, role: "QA Lead",                   allocationPct: 40, startDate: "2025-03-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "16" },
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[8].id,  resourceName: resources[8].name,  role: "Principal OTM Specialist",  allocationPct: 40, startDate: "2025-03-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "16" },
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[1].id,  resourceName: resources[1].name,  role: "Delivery Oversight",        allocationPct: 20, startDate: "2025-01-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "8"  },
    // Project 1 — Apex Rate Engine
    { projectId: projects[1].id, projectName: projects[1].name, resourceId: resources[9].id,  resourceName: resources[9].name,  role: "Rate Engine Specialist",    allocationPct: 100,startDate: "2024-11-01", endDate: "2026-09-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "40" },
    { projectId: projects[1].id, projectName: projects[1].name, resourceId: resources[10].id, resourceName: resources[10].name, role: "OTM Functional Lead",       allocationPct: 60, startDate: "2024-11-01", endDate: "2026-09-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "24" },
    { projectId: projects[1].id, projectName: projects[1].name, resourceId: resources[22].id, resourceName: resources[22].name, role: "Technical Developer",       allocationPct: 50, startDate: "2025-01-01", endDate: "2026-09-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "20" },
    { projectId: projects[1].id, projectName: projects[1].name, resourceId: resources[28].id, resourceName: resources[28].name, role: "Solution Architect",        allocationPct: 30, startDate: "2024-11-01", endDate: "2026-09-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "12" },
    // Project 2 — NorthStar AMS
    { projectId: projects[2].id, projectName: projects[2].name, resourceId: resources[13].id, resourceName: resources[13].name, role: "AMS Specialist",            allocationPct: 70, startDate: "2024-01-01", endDate: "2026-12-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "28" },
    { projectId: projects[2].id, projectName: projects[2].name, resourceId: resources[23].id, resourceName: resources[23].name, role: "Integration Developer",     allocationPct: 30, startDate: "2025-04-01", endDate: "2026-12-31", status: "tentative", allocationType: "soft", hoursPerWeek: "12" },
    { projectId: projects[2].id, projectName: projects[2].name, resourceId: resources[31].id, resourceName: resources[31].name, role: "Test Engineer",             allocationPct: 25, startDate: "2025-01-01", endDate: "2026-12-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "10" },
    // Project 3 — Pacific 23D Certification
    { projectId: projects[3].id, projectName: projects[3].name, resourceId: resources[30].id, resourceName: resources[30].name, role: "QA Lead",                   allocationPct: 75, startDate: "2025-03-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "30" },
    { projectId: projects[3].id, projectName: projects[3].name, resourceId: resources[31].id, resourceName: resources[31].name, role: "Test Engineer",             allocationPct: 40, startDate: "2025-03-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "16" },
    { projectId: projects[3].id, projectName: projects[3].name, resourceId: resources[8].id,  resourceName: resources[8].name,  role: "OTM Functional Support",    allocationPct: 20, startDate: "2025-03-01", endDate: "2026-10-31", status: "tentative", allocationType: "soft", hoursPerWeek: "8"  },
    // Project 4 — GlobalTrans Data Acceleration (on hold)
    { projectId: projects[4].id, projectName: projects[4].name, resourceId: resources[19].id, resourceName: resources[19].name, role: "Data Migration Specialist", allocationPct: 40, startDate: "2025-02-01", endDate: "2025-04-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "16" },
    { projectId: projects[4].id, projectName: projects[4].name, resourceId: resources[22].id, resourceName: resources[22].name, role: "Technical Developer",       allocationPct: 30, startDate: "2025-02-01", endDate: "2025-04-30", status: "tentative", allocationType: "soft", hoursPerWeek: "12" },
    // Project 5 — BlueStar Cloud Implementation
    { projectId: projects[5].id, projectName: projects[5].name, resourceId: resources[29].id, resourceName: resources[29].name, role: "Cloud Architect",           allocationPct: 80, startDate: "2024-12-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "32" },
    { projectId: projects[5].id, projectName: projects[5].name, resourceId: resources[15].id, resourceName: resources[15].name, role: "OTM Cloud Specialist",      allocationPct: 90, startDate: "2024-12-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "36" },
    { projectId: projects[5].id, projectName: projects[5].name, resourceId: resources[18].id, resourceName: resources[18].name, role: "Integration Developer",     allocationPct: 50, startDate: "2025-02-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "20" },
    { projectId: projects[5].id, projectName: projects[5].name, resourceId: resources[30].id, resourceName: resources[30].name, role: "QA Lead",                   allocationPct: 40, startDate: "2025-05-01", endDate: "2026-06-30", status: "tentative", allocationType: "soft", hoursPerWeek: "16" },
    { projectId: projects[5].id, projectName: projects[5].name, resourceId: resources[20].id, resourceName: resources[20].name, role: "Groovy Developer",          allocationPct: 60, startDate: "2025-02-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "24" },
    // Project 6 — Summit Freight AMS
    { projectId: projects[6].id, projectName: projects[6].name, resourceId: resources[16].id, resourceName: resources[16].name, role: "AMS Specialist",            allocationPct: 70, startDate: "2024-06-01", endDate: "2026-05-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "28" },
    { projectId: projects[6].id, projectName: projects[6].name, resourceId: resources[14].id, resourceName: resources[14].name, role: "OTM Functional Consultant", allocationPct: 30, startDate: "2024-06-01", endDate: "2026-05-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "12" },
    // Project 7 — Apex EMEA Order Management
    { projectId: projects[7].id, projectName: projects[7].name, resourceId: resources[28].id, resourceName: resources[28].name, role: "Solution Architect",        allocationPct: 30, startDate: "2025-04-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "12" },
    { projectId: projects[7].id, projectName: projects[7].name, resourceId: resources[11].id, resourceName: resources[11].name, role: "OTM Functional Lead",       allocationPct: 80, startDate: "2025-04-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "32" },
    { projectId: projects[7].id, projectName: projects[7].name, resourceId: resources[25].id, resourceName: resources[25].name, role: "Senior OTM Developer",      allocationPct: 50, startDate: "2025-05-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "20" },
    { projectId: projects[7].id, projectName: projects[7].name, resourceId: resources[17].id, resourceName: resources[17].name, role: "Integration Specialist",    allocationPct: 60, startDate: "2025-05-01", endDate: "2026-06-30", status: "tentative", allocationType: "soft", hoursPerWeek: "24" },
  ]);
  console.log("[auto-seed] Inserted allocations");

  // ── Timesheets ────────────────────────────────────────────────────────────
  const weeks = ["2025-03-03","2025-03-10","2025-03-17","2025-03-24","2025-03-31","2025-04-07"];
  const timesheetData: any[] = [];
  const tsPairs: Array<{ proj: number; res: number; billable: boolean }> = [
    { proj: 0, res: 28, billable: true  }, // Kevin O'Brien → GlobalTrans Migration
    { proj: 0, res: 21, billable: true  }, // Andrés Medina → GlobalTrans Migration
    { proj: 0, res: 19, billable: true  }, // Arun Sharma → GlobalTrans Migration
    { proj: 0, res: 29, billable: true  }, // Yuki Tanaka → GlobalTrans Migration
    { proj: 1, res: 9,  billable: true  }, // Aisha Johnson → Apex Rate Engine
    { proj: 1, res: 10, billable: true  }, // Ramesh Iyer → Apex Rate Engine
    { proj: 2, res: 13, billable: true  }, // Preethi Sundaram → NorthStar AMS
    { proj: 3, res: 30, billable: true  }, // Diana Cruz → Pacific 23D
    { proj: 5, res: 29, billable: true  }, // Yuki Tanaka → BlueStar
    { proj: 5, res: 15, billable: true  }, // Lena Park → BlueStar
    { proj: 6, res: 16, billable: true  }, // Carlos Vega → Summit AMS
  ];
  for (const week of weeks) {
    for (const pair of tsPairs) {
      const hours = 28 + Math.floor(Math.random() * 14);
      const billable = pair.billable ? hours - Math.floor(Math.random() * 4) : 0;
      const isOld = week < "2025-03-24";
      const isCurrent = week === "2025-03-24" || week === "2025-03-31";
      timesheetData.push({
        projectId:    projects[pair.proj].id,
        projectName:  projects[pair.proj].name,
        resourceId:   resources[pair.res].id,
        resourceName: resources[pair.res].name,
        weekStart:    week,
        hoursLogged:  String(hours),
        billableHours:String(billable),
        status:  isOld ? "approved" : isCurrent ? "submitted" : "draft",
        notes:   isOld ? "Week completed and approved" : null,
      });
    }
  }
  await db.insert(timesheetsTable).values(timesheetData);
  console.log(`[auto-seed] Inserted ${timesheetData.length} timesheets`);

  // ── Invoices ──────────────────────────────────────────────────────────────
  await db.insert(invoicesTable).values([
    { invoiceNumber: "INV-0001", projectId: projects[0].id, projectName: projects[0].name, accountId: accounts[0].id, accountName: accounts[0].name, milestoneId: milestones[0].id,  amount: "45000",  status: "paid",    issueDate: "2025-02-01", dueDate: "2025-03-01", paidDate: "2025-02-25", notes: "Integration Assessment milestone" },
    { invoiceNumber: "INV-0002", projectId: projects[0].id, projectName: projects[0].name, accountId: accounts[0].id, accountName: accounts[0].name, milestoneId: milestones[1].id,  amount: "65000",  status: "paid",    issueDate: "2025-03-10", dueDate: "2025-04-10", paidDate: "2025-04-02", notes: "DEV Environment Configuration milestone" },
    { invoiceNumber: "INV-0003", projectId: projects[0].id, projectName: projects[0].name, accountId: accounts[0].id, accountName: accounts[0].name, milestoneId: null,              amount: "170000", status: "sent",    issueDate: "2025-03-31", dueDate: "2025-04-30", paidDate: null,         notes: "March T&M invoice" },
    { invoiceNumber: "INV-0004", projectId: projects[2].id, projectName: projects[2].name, accountId: accounts[2].id, accountName: accounts[2].name, milestoneId: milestones[7].id,  amount: "18000",  status: "paid",    issueDate: "2025-04-01", dueDate: "2025-05-01", paidDate: "2025-04-15", notes: "Q1 Certification" },
    { invoiceNumber: "INV-0005", projectId: projects[1].id, projectName: projects[1].name, accountId: accounts[1].id, accountName: accounts[1].name, milestoneId: null,              amount: "85000",  status: "overdue", issueDate: "2025-02-28", dueDate: "2025-03-28", paidDate: null,         notes: "Feb T&M invoice — payment outstanding" },
    { invoiceNumber: "INV-0006", projectId: projects[3].id, projectName: projects[3].name, accountId: accounts[3].id, accountName: accounts[3].name, milestoneId: null,              amount: "28000",  status: "draft",   issueDate: "2025-04-01", dueDate: "2025-05-01", paidDate: null,         notes: "23D Certification work in progress" },
    { invoiceNumber: "INV-0007", projectId: projects[5].id, projectName: projects[5].name, accountId: accounts[5].id, accountName: accounts[5].name, milestoneId: milestones[11].id, amount: "55000",  status: "paid",    issueDate: "2025-02-05", dueDate: "2025-03-05", paidDate: "2025-02-28", notes: "BlueStar Blueprint milestone" },
    { invoiceNumber: "INV-0008", projectId: projects[5].id, projectName: projects[5].name, accountId: accounts[5].id, accountName: accounts[5].name, milestoneId: null,              amount: "93000",  status: "sent",    issueDate: "2025-04-01", dueDate: "2025-05-01", paidDate: null,         notes: "BlueStar Q1 T&M" },
    { invoiceNumber: "INV-0009", projectId: projects[6].id, projectName: projects[6].name, accountId: accounts[6].id, accountName: accounts[6].name, milestoneId: null,              amount: "38500",  status: "overdue", issueDate: "2025-03-01", dueDate: "2025-03-31", paidDate: null,         notes: "Summit AMS — February retainer" },
    { invoiceNumber: "INV-0010", projectId: projects[2].id, projectName: projects[2].name, accountId: accounts[2].id, accountName: accounts[2].name, milestoneId: null,              amount: "17500",  status: "paid",    issueDate: "2025-03-01", dueDate: "2025-04-01", paidDate: "2025-03-20", notes: "NorthStar AMS — March retainer" },
    { invoiceNumber: "INV-0011", projectId: projects[7].id, projectName: projects[7].name, accountId: accounts[1].id, accountName: accounts[1].name, milestoneId: milestones[15].id, amount: "35000",  status: "sent",    issueDate: "2025-05-10", dueDate: "2025-06-10", paidDate: null,         notes: "Apex EMEA scoping & design milestone" },
    { invoiceNumber: "INV-0012", projectId: projects[4].id, projectName: projects[4].name, accountId: accounts[0].id, accountName: accounts[0].name, milestoneId: null,              amount: "22000",  status: "paid",    issueDate: "2025-02-15", dueDate: "2025-03-15", paidDate: "2025-03-10", notes: "Data Acceleration Phase 1 T&M" },
  ]);
  console.log("[auto-seed] Inserted invoices");

  // ── Tasks ─────────────────────────────────────────────────────────────────
  await db.insert(tasksTable).values([
    { projectId: projects[0].id, milestoneId: milestones[0].id, name: "Current-State Integration Inventory",  description: "Document all active OTM integrations: EDI, APIs, custom jobs",                           assignedToId: resources[21].id, assignedToName: resources[21].name, status: "completed",   priority: "high",     dueDate: "2025-01-20", estimatedHours: "40", loggedHours: "38", visibility: "internal_only" },
    { projectId: projects[0].id, milestoneId: milestones[0].id, name: "Cloud Architecture Design Document",   description: "Produce target-state architecture diagram and decision log",                             assignedToId: resources[28].id, assignedToName: resources[28].name, status: "completed",   priority: "high",     dueDate: "2025-01-28", estimatedHours: "32", loggedHours: "35", visibility: "shared_with_client" },
    { projectId: projects[0].id, milestoneId: milestones[2].id, name: "SIT Test Execution — Wave 1",          description: "Execute Wave 1 SIT test cases covering order management and rate engine",                assignedToId: resources[30].id, assignedToName: resources[30].name, status: "in_progress", priority: "high",     dueDate: "2025-04-08", estimatedHours: "60", loggedHours: "22", visibility: "shared_with_client" },
    { projectId: projects[0].id, milestoneId: milestones[2].id, name: "Integration Defect Remediation",       description: "Fix SIT defects raised in Wave 1 — carrier portal and EDI 214 failures",                assignedToId: resources[21].id, assignedToName: resources[21].name, status: "in_progress", priority: "critical", dueDate: "2025-04-10", estimatedHours: "48", loggedHours: "18", visibility: "internal_only", blockerNote: "Waiting on client to provide updated EDI spec from Carrier B" },
    { projectId: projects[0].id, milestoneId: milestones[3].id, name: "UAT Scenario Authoring",               description: "Write 80 UAT test scenarios with client SMEs",                                         assignedToId: resources[28].id, assignedToName: resources[28].name, status: "pending",     priority: "medium",   dueDate: "2025-04-20", estimatedHours: "40", loggedHours: "0",  visibility: "shared_with_client" },
    { projectId: projects[0].id, milestoneId: milestones[4].id, name: "Go-Live Runbook",                      description: "Document full cutover sequence: pre-go-live, cutover, hypercare steps",                assignedToId: resources[5].id,  assignedToName: resources[5].name,  status: "pending",     priority: "medium",   dueDate: "2025-05-05", estimatedHours: "24", loggedHours: "0",  visibility: "shared_with_client" },
    { projectId: projects[1].id, milestoneId: milestones[5].id, name: "Carrier Rate Analysis — EMEA",         description: "Analyze 18-carrier rate matrix and map to OTM rate types",                               assignedToId: resources[9].id,  assignedToName: resources[9].name,  status: "in_progress", priority: "high",     dueDate: "2025-01-10", estimatedHours: "80", loggedHours: "65", visibility: "shared_with_client" },
    { projectId: projects[1].id, milestoneId: milestones[6].id, name: "Rate Record Entry — All Carriers",     description: "Enter all approved rates into OTM DEV environment",                                     assignedToId: resources[22].id, assignedToName: resources[22].name, status: "in_progress", priority: "high",     dueDate: "2025-03-20", estimatedHours: "120",loggedHours: "45", visibility: "shared_with_client" },
    { projectId: projects[1].id, name: "Client Status Report — Week 12",                                       description: "Weekly project status report: RAG, schedule, financials",                             assignedToId: pm2.id,           assignedToName: pm2.name,           status: "in_progress", priority: "low",      dueDate: "2025-03-28", estimatedHours: "4",  loggedHours: "2",  visibility: "shared_with_client" },
    { projectId: projects[2].id, milestoneId: milestones[7].id, name: "24A Regression Suite — Core OTM",     description: "Execute core OTM regression tests for 24A release",                                     assignedToId: resources[13].id, assignedToName: resources[13].name, status: "completed",   priority: "medium",   dueDate: "2025-03-25", estimatedHours: "32", loggedHours: "30", visibility: "shared_with_client" },
    { projectId: projects[2].id, name: "AMS Monthly Report — March 2025",                                      description: "Compile AMS incident log, SLA metrics, and trend analysis for March",                 assignedToId: resources[13].id, assignedToName: resources[13].name, status: "in_progress", priority: "low",      dueDate: "2025-04-05", estimatedHours: "6",  loggedHours: "3",  visibility: "shared_with_client" },
    { projectId: projects[3].id, milestoneId: milestones[9].id, name: "23D Test Plan — Scope Definition",    description: "Define regression scope for 23D: modules, data sets, environments",                      assignedToId: resources[30].id, assignedToName: resources[30].name, status: "overdue",     priority: "high",     dueDate: "2025-03-10", estimatedHours: "16", loggedHours: "8",  visibility: "internal_only" },
    { projectId: projects[3].id, milestoneId: milestones[10].id,name: "23D Regression Execution",            description: "Execute full regression suite for 23D certification",                                   assignedToId: resources[31].id, assignedToName: resources[31].name, status: "pending",     priority: "medium",   dueDate: "2025-05-20", estimatedHours: "48", loggedHours: "0",  visibility: "shared_with_client" },
    { projectId: projects[5].id, milestoneId: milestones[11].id,name: "BlueStar Functional Blueprint",        description: "Document business requirements and OTM solution design for all modules",                assignedToId: resources[15].id, assignedToName: resources[15].name, status: "completed",   priority: "high",     dueDate: "2025-01-20", estimatedHours: "64", loggedHours: "62", visibility: "shared_with_client" },
    { projectId: projects[5].id, milestoneId: milestones[12].id,name: "OTM Core Module Configuration — DEV", description: "Configure Carrier Management, Rate Management, and Shipment Execution in DEV",          assignedToId: resources[15].id, assignedToName: resources[15].name, status: "in_progress", priority: "high",     dueDate: "2025-04-30", estimatedHours: "80", loggedHours: "45", visibility: "shared_with_client" },
    { projectId: projects[5].id, milestoneId: milestones[12].id,name: "BlueStar Integration Build — TMS/WMS", description: "Build REST integrations between OTM and client WMS (Manhattan) and ERP (SAP)",         assignedToId: resources[18].id, assignedToName: resources[18].name, status: "in_progress", priority: "high",     dueDate: "2025-05-15", estimatedHours: "96", loggedHours: "32", visibility: "internal_only" },
    { projectId: projects[6].id, name: "Summit AMS April Incident Report",                                     description: "Monthly incident summary and SLA compliance report for Summit Freight",               assignedToId: resources[16].id, assignedToName: resources[16].name, status: "in_progress", priority: "low",      dueDate: "2025-05-05", estimatedHours: "6",  loggedHours: "2",  visibility: "shared_with_client" },
    { projectId: projects[7].id, milestoneId: milestones[15].id,name: "Apex EMEA Requirements Workshop",     description: "3-day workshop with EMEA ops team to capture order management requirements",             assignedToId: resources[11].id, assignedToName: resources[11].name, status: "completed",   priority: "high",     dueDate: "2025-04-15", estimatedHours: "24", loggedHours: "26", visibility: "shared_with_client" },
    { projectId: projects[7].id, milestoneId: milestones[15].id,name: "Apex EMEA Solution Design Document",  description: "Write solution design document for Order Management and Shipment Execution EMEA scope",   assignedToId: resources[28].id, assignedToName: resources[28].name, status: "in_progress", priority: "high",     dueDate: "2025-05-10", estimatedHours: "32", loggedHours: "10", visibility: "shared_with_client" },
  ]);
  console.log("[auto-seed] Inserted tasks");

  // ── Contracts ─────────────────────────────────────────────────────────────
  await db.insert(contractsTable).values([
    { name: "GlobalTrans OTM Cloud Migration — SOW",   contractNumber: "CTR-0001", projectId: projects[0].id, accountId: accounts[0].id, accountName: accounts[0].name, projectName: projects[0].name, billingModel: "time_and_materials", status: "active",  totalValue: "480000.00", remainingValue: "200000.00", invoicedValue: "280000.00", startDate: "2024-09-01", endDate: "2026-10-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "monthly",   slaConfig: { response_time: "4 hours", uptime: "99.5%", report_cadence: "weekly" }, billingMilestones: [{ name: "Integration Assessment", amount: 45000, triggerEvent: "milestone_complete", status: "completed" }, { name: "DEV Configuration", amount: 65000, triggerEvent: "milestone_complete", status: "completed" }, { name: "SIT", amount: 80000, triggerEvent: "milestone_complete", status: "pending" }, { name: "Go-Live", amount: 90000, triggerEvent: "go_live", status: "pending" }], assumptions: "All integrations within scope per SOW Appendix A. Change orders required for additional carrier integrations." },
    { name: "Apex Rate Engine — Fixed Fee SOW",        contractNumber: "CTR-0002", projectId: projects[1].id, accountId: accounts[1].id, accountName: accounts[1].name, projectName: projects[1].name, billingModel: "fixed_fee",         status: "active",  totalValue: "320000.00", remainingValue: "175000.00", invoicedValue: "145000.00", startDate: "2024-11-01", endDate: "2025-07-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "milestone",  assumptions: "Rate record count not to exceed 3,000 per SOW scope. Additional records subject to change order." },
    { name: "NorthStar AMS Retainer Agreement",        contractNumber: "CTR-0003", projectId: projects[2].id, accountId: accounts[2].id, accountName: accounts[2].name, projectName: projects[2].name, billingModel: "retainer",          status: "active",  totalValue: "210000.00", remainingValue: "97500.00",  invoicedValue: "112500.00", startDate: "2024-01-01", endDate: "2026-12-31", paymentTerms: "Net 15", currencyCode: "USD", billingCycle: "monthly",   slaConfig: { response_time: "2 hours", uptime: "99.9%", monthly_hours: 80 } },
    { name: "Pacific 23D Certification SOW",           contractNumber: "CTR-0004", projectId: projects[3].id, accountId: accounts[3].id, accountName: accounts[3].name, projectName: projects[3].name, billingModel: "time_and_materials", status: "active",  totalValue: "56000.00",  remainingValue: "28000.00",  invoicedValue: "28000.00",  startDate: "2025-03-01", endDate: "2026-10-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "milestone" },
    { name: "GlobalTrans Data Acceleration SOW",       contractNumber: "CTR-0005", projectId: projects[4].id, accountId: accounts[0].id, accountName: accounts[0].name, projectName: projects[4].name, billingModel: "time_and_materials", status: "on_hold", totalValue: "95000.00",  remainingValue: "73000.00",  invoicedValue: "22000.00",  startDate: "2025-02-01", endDate: "2025-04-30", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "monthly",   notes: "On hold pending client IT resource availability." },
    { name: "BlueStar OTM Cloud Implementation — SOW", contractNumber: "CTR-0006", projectId: projects[5].id, accountId: accounts[5].id, accountName: accounts[5].name, projectName: projects[5].name, billingModel: "time_and_materials", status: "active",  totalValue: "395000.00", remainingValue: "247000.00", invoicedValue: "148000.00", startDate: "2024-12-01", endDate: "2025-11-30", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "monthly",   slaConfig: { response_time: "4 hours", report_cadence: "bi-weekly" }, assumptions: "Scope limited to LTL carrier management and rate engine. International trade is out of scope." },
    { name: "Summit Freight AMS Retainer",             contractNumber: "CTR-0007", projectId: projects[6].id, accountId: accounts[6].id, accountName: accounts[6].name, projectName: projects[6].name, billingModel: "retainer",          status: "active",  totalValue: "155000.00", remainingValue: "25000.00",  invoicedValue: "130000.00", startDate: "2024-06-01", endDate: "2025-05-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "monthly",   slaConfig: { response_time: "4 hours", uptime: "99.0%", monthly_hours: 40 } },
    { name: "Apex EMEA Order Management — SOW",        contractNumber: "CTR-0008", projectId: projects[7].id, accountId: accounts[1].id, accountName: accounts[1].name, projectName: projects[7].name, billingModel: "time_and_materials", status: "active",  totalValue: "215000.00", remainingValue: "180000.00", invoicedValue: "35000.00",  startDate: "2025-04-01", endDate: "2025-12-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "monthly",   assumptions: "EMEA scope only; NA operations not in scope. Integration with SAP S/4HANA included." },
  ]);
  console.log("[auto-seed] Inserted contracts");

  // ── Change Requests ────────────────────────────────────────────────────────
  await db.insert(changeRequestsTable).values([
    { projectId: projects[0].id, projectName: projects[0].name, changeOrderNumber: "CR-001", title: "Additional Carrier Portal Integration — FedEx",      description: "Client requests custom FedEx portal integration not covered in original SOW.",                           category: "extra_integration", requestedByName: "GlobalTrans IT Director",    status: "approved",        priority: "high",   impactHours: "120", impactCost: "28000.00", impactWeeks: 3,  internalApproverName: director.name, internalApprovedAt: "2025-02-15", clientApproverName: clientStk1.name, clientApprovedAt: "2025-02-20", submittedDate: "2025-02-10", approvedDate: "2025-02-20", deliveredBeforeApproval: false },
    { projectId: projects[0].id, projectName: projects[0].name, changeOrderNumber: "CR-003", title: "Scope Reduction — Remove Data Archival Module",       description: "Client de-scoped the data archival module due to budget constraints.",                                    category: "scope_reduction",   requestedByName: "GlobalTrans CIO",            status: "approved",        priority: "low",    impactHours: "-160",impactCost: "-32000.00",impactWeeks: -2, internalApproverName: fin1.name,     internalApprovedAt: "2025-01-20", clientApproverName: clientStk1.name, clientApprovedAt: "2025-01-25", submittedDate: "2025-01-15", approvedDate: "2025-01-25", deliveredBeforeApproval: false },
    { projectId: projects[1].id, projectName: projects[1].name, changeOrderNumber: "CR-002", title: "Custom Executive Dashboard Reports",                  description: "Client requests 3 custom Power BI reports using OTM data.",                                                  category: "new_requirement",   requestedByName: "Apex VP Operations",         status: "pending_client",  priority: "medium", impactHours: "80",  impactCost: "18500.00", impactWeeks: 2,  internalApproverName: director.name, internalApprovedAt: "2025-03-10", submittedDate: "2025-03-05", deliveredBeforeApproval: false },
    { projectId: projects[1].id, projectName: projects[1].name, changeOrderNumber: "CR-004", title: "Additional EMEA Carrier Rate Records (+800 records)", description: "Original SOW capped at 3,000 rate records. Client now requires 3,800 for expanded EMEA network.",          category: "scope_expansion",   requestedByName: clientStk2.name,              status: "pending_internal",priority: "high",   impactHours: "96",  impactCost: "21500.00", impactWeeks: 2,  submittedDate: "2025-04-01", deliveredBeforeApproval: false },
    { projectId: projects[5].id, projectName: projects[5].name, changeOrderNumber: "CR-005", title: "Add UPS Ground Carrier Integration",                  description: "Client requests UPS Ground REST API integration as part of carrier connectivity scope.",                   category: "extra_integration", requestedByName: "BlueStar VP Technology",     status: "approved",        priority: "medium", impactHours: "40",  impactCost: "9200.00",  impactWeeks: 1,  internalApproverName: director.name, internalApprovedAt: "2025-03-20", clientApproverName: "BlueStar VP Technology", clientApprovedAt: "2025-03-25", submittedDate: "2025-03-15", approvedDate: "2025-03-25", deliveredBeforeApproval: false },
    { projectId: projects[5].id, projectName: projects[5].name, changeOrderNumber: "CR-006", title: "Expedited UAT Timeline — 3-Week Compression",         description: "Client requests UAT compressed from 5 weeks to 3 weeks to meet Q3 board presentation deadline.",           category: "timeline_change",   requestedByName: "BlueStar CIO",               status: "pending_client",  priority: "high",   impactHours: "40",  impactCost: "8500.00",  impactWeeks: -2, internalApproverName: pm3.name,      internalApprovedAt: "2025-04-05", submittedDate: "2025-04-02", deliveredBeforeApproval: false },
    { projectId: projects[2].id, projectName: projects[2].name, changeOrderNumber: "CR-007", title: "Add Custom OTM Rate Optimization Script",             description: "NorthStar requests a Groovy-based rate optimization script delivered as part of AMS scope.",               category: "new_requirement",   requestedByName: "NorthStar IT Lead",          status: "rejected",        priority: "low",    impactHours: "60",  impactCost: "12000.00", impactWeeks: 0,  internalApproverName: director.name, internalApprovedAt: "2025-03-01", submittedDate: "2025-02-20", deliveredBeforeApproval: false, notes: "Rejected — out of AMS retainer scope. Referred to NorthStar Rate Upgrade opportunity." },
  ]);
  console.log("[auto-seed] Inserted change requests");

  // ── Notifications ─────────────────────────────────────────────────────────
  await db.insert(notificationsTable).values([
    { userId: pm2.id,      title: "Milestone Overdue",           message: "Rate Engine Design milestone is overdue on Apex OTM Rate Engine project",          type: "milestone_overdue",       priority: "action", entityType: "milestone", entityId: milestones[5].id,  read: false },
    { userId: fin1.id,     title: "Invoice Overdue",             message: "INV-0005 ($85,000) from Apex Logistics is overdue by 28 days",                     type: "invoice_overdue",         priority: "action", entityType: "invoice",   entityId: null,              read: false },
    { userId: fin1.id,     title: "Invoice Overdue",             message: "INV-0009 ($38,500) from Summit Freight Partners is overdue by 14 days",            type: "invoice_overdue",         priority: "action", entityType: "invoice",   entityId: null,              read: false },
    { userId: director.id, title: "Project At Risk",             message: "Apex OTM Rate Engine Implementation health dropped to 55 — action required",       type: "project_at_risk",         priority: "action", entityType: "project",   entityId: projects[1].id,    read: false },
    { userId: pm1.id,      title: "Change Order Approved",       message: "CR-001 approved by GlobalTrans — FedEx Portal Integration ($28K added to scope)", type: "change_request_approved", priority: "fyi",    entityType: "project",   entityId: projects[0].id,    read: true  },
    { userId: pm3.id,      title: "Change Order Approved",       message: "CR-005 approved — UPS Ground Integration added to BlueStar scope (+$9.2K)",        type: "change_request_approved", priority: "fyi",    entityType: "project",   entityId: projects[5].id,    read: true  },
    { userId: rm1.id,      title: "Timesheets Pending Approval", message: "11 timesheets submitted for week of March 24 — awaiting approval",                 type: "timesheet_submitted",     priority: "action", entityType: null,        entityId: null,              read: false },
    { userId: pm1.id,      title: "Milestone Overdue",           message: "Pacific 23D Test Plan Finalized is 3+ weeks overdue — blocks certification",        type: "milestone_overdue",       priority: "action", entityType: "milestone", entityId: milestones[9].id,  read: false },
    { userId: director.id, title: "Project Health Improved",     message: "BlueStar OTM Implementation health improved to 82 — on track for August go-live",  type: "project_health_improved", priority: "fyi",    entityType: "project",   entityId: projects[5].id,    read: true  },
    { userId: am1.id,      title: "Account Renewal Due",         message: "GlobalTrans contract renewal due June 30 — 90-day window to initiate conversation", type: "renewal_signal",          priority: "action", entityType: "account",   entityId: accounts[0].id,    read: false },
  ]);
  console.log("[auto-seed] Inserted notifications");

  // ── Phases ─────────────────────────────────────────────────────────────────
  await db.insert(phasesTable).values([
    // Project 0 — GlobalTrans Cloud Migration
    { projectId: projects[0].id, name: "Discovery & Blueprint", sequence: 1, startDate: "2024-09-01", endDate: "2024-11-30", status: "completed",   description: "Requirements gathering, current-state analysis, and architecture design." },
    { projectId: projects[0].id, name: "Build & Configure",     sequence: 2, startDate: "2024-12-01", endDate: "2025-02-28", status: "completed",   description: "OTM SaaS environment configuration, data migration, and integration build." },
    { projectId: projects[0].id, name: "Test & Validate",       sequence: 3, startDate: "2025-03-01", endDate: "2025-04-30", status: "in_progress", description: "SIT and UAT execution with defect resolution." },
    { projectId: projects[0].id, name: "Deploy & Go-Live",      sequence: 4, startDate: "2025-05-01", endDate: "2025-06-30", status: "pending",     description: "Production cutover, hypercare, and project close." },
    // Project 1 — Apex Rate Engine
    { projectId: projects[1].id, name: "Rate Discovery",        sequence: 1, startDate: "2024-11-01", endDate: "2025-01-31", status: "in_progress", description: "Carrier rate analysis and OTM rate type mapping." },
    { projectId: projects[1].id, name: "Configuration",         sequence: 2, startDate: "2025-02-01", endDate: "2025-05-31", status: "pending",     description: "Rate record entry and configuration in DEV." },
    { projectId: projects[1].id, name: "Testing & Go-Live",     sequence: 3, startDate: "2025-06-01", endDate: "2025-07-31", status: "pending",     description: "End-to-end testing and rate engine go-live." },
    // Project 3 — Pacific 23D
    { projectId: projects[3].id, name: "Test Planning",         sequence: 1, startDate: "2025-03-01", endDate: "2025-03-31", status: "overdue",     description: "Define certification scope and prepare test plan." },
    { projectId: projects[3].id, name: "Test Execution",        sequence: 2, startDate: "2025-04-01", endDate: "2025-05-30", status: "pending",     description: "Execute 23D regression suite and certify release." },
    // Project 5 — BlueStar
    { projectId: projects[5].id, name: "Blueprint & Design",    sequence: 1, startDate: "2024-12-01", endDate: "2025-01-31", status: "completed",   description: "Solution design, architecture, and integration mapping." },
    { projectId: projects[5].id, name: "Build & Configure",     sequence: 2, startDate: "2025-02-01", endDate: "2025-05-31", status: "in_progress", description: "OTM configuration, integration build, and data migration." },
    { projectId: projects[5].id, name: "Test & UAT",            sequence: 3, startDate: "2025-06-01", endDate: "2025-07-31", status: "pending",     description: "SIT, UAT, and defect resolution." },
    { projectId: projects[5].id, name: "Go-Live & Hypercare",   sequence: 4, startDate: "2025-08-01", endDate: "2025-09-30", status: "pending",     description: "Production cutover and post-go-live hypercare." },
    // Project 7 — Apex EMEA
    { projectId: projects[7].id, name: "Scoping & Design",      sequence: 1, startDate: "2025-04-01", endDate: "2025-06-30", status: "in_progress", description: "Requirements analysis and solution design for EMEA order management." },
    { projectId: projects[7].id, name: "Build & Configure",     sequence: 2, startDate: "2025-07-01", endDate: "2025-10-31", status: "pending",     description: "OTM configuration and integration build." },
    { projectId: projects[7].id, name: "Test & Go-Live",        sequence: 3, startDate: "2025-11-01", endDate: "2025-12-31", status: "pending",     description: "UAT and go-live." },
  ]);
  console.log("[auto-seed] Inserted phases");

  // ── Opportunities ───────────────────────────────────────────────────────────
  const pm = resources.find(r => r.title?.includes("Project Manager") || r.title?.includes("Director")) ?? resources[4];
  const sr = resources.find(r => r.title?.includes("Senior") || r.title?.includes("Principal")) ?? resources[5];
  const dir = resources.find(r => r.title?.includes("Director") || r.title?.includes("Partner")) ?? resources[1];
  await db.insert(opportunitiesTable).values([
    { name: "GlobalTrans OTM Cloud Migration Phase 2",        accountId: accounts[0].id, accountName: accounts[0].name, stage: "proposal",     type: "cloud_migration",      value: "480000.00", probability: 65, expectedCloseDate: "2026-05-30", expectedStartDate: "2026-07-01", expectedDurationWeeks: 20, ownerId: sr?.id,  ownerName: sr?.name,  deliveryComplexity: "high",      staffingRisk: "medium", summary: "Expand GlobalTrans OTM on-prem to full cloud (OCI). Phase 2 covers financials and rate management modules.", goNoGoStatus: "approved" },
    { name: "Apex Logistics AMS Renewal & Expansion",         accountId: accounts[1].id, accountName: accounts[1].name, stage: "negotiation",  type: "ams",                  value: "220000.00", probability: 80, expectedCloseDate: "2026-05-15", expectedStartDate: "2026-06-01", expectedDurationWeeks: 52, ownerId: pm?.id,  ownerName: pm?.name,  deliveryComplexity: "low",       staffingRisk: "none",   summary: "Renew AMS contract with scope expansion to include new carrier integration and rate optimization.",          goNoGoStatus: "approved" },
    { name: "NorthStar Freight — OTM Certification",          accountId: accounts[2].id, accountName: accounts[2].name, stage: "discovery",    type: "certification",        value: "95000.00",  probability: 40, expectedCloseDate: "2026-07-10", expectedStartDate: "2026-08-01", expectedDurationWeeks: 12, ownerId: dir?.id, ownerName: dir?.name, deliveryComplexity: "medium",     staffingRisk: "none",   summary: "Deliver end-user OTM certification training across 3 NorthStar regional offices.",                          goNoGoStatus: "pending"  },
    { name: "Pacific Distribution — Custom Rate Engine",      accountId: accounts[3].id, accountName: accounts[3].name, stage: "qualified",    type: "custom_development",   value: "310000.00", probability: 50, expectedCloseDate: "2026-08-15", expectedStartDate: "2026-09-01", expectedDurationWeeks: 24, ownerId: sr?.id,  ownerName: sr?.name,  deliveryComplexity: "very_high",  staffingRisk: "high",   summary: "Build a custom Groovy-based rate engine to replace legacy Pacific in-house calculation logic.",               goNoGoStatus: "pending"  },
    { name: "Meridian Carriers — OTM Upgrade v24.2",          accountId: accounts[4].id, accountName: accounts[4].name, stage: "lead",         type: "implementation",       value: "175000.00", probability: 20, expectedCloseDate: "2026-09-01", expectedStartDate: "2026-10-01", expectedDurationWeeks: 16, ownerId: sr?.id,  ownerName: sr?.name,  deliveryComplexity: "medium",     staffingRisk: "none",   summary: "Upgrade Meridian OTM instance from v23.1 to v24.2 including data migration and regression testing.",         goNoGoStatus: "pending"  },
    { name: "BlueStar Transport — Data Services",             accountId: accounts[5].id, accountName: accounts[5].name, stage: "proposal",     type: "data_services",        value: "130000.00", probability: 55, expectedCloseDate: "2026-06-20", expectedStartDate: "2026-07-15", expectedDurationWeeks: 10, ownerId: pm?.id,  ownerName: pm?.name,  deliveryComplexity: "low",       staffingRisk: "none",   summary: "Design and implement OTM reporting data model feeding BlueStar BI platform (Power BI).",                     goNoGoStatus: "approved" },
    { name: "Summit Freight — OTM Implementation",            accountId: accounts[6].id, accountName: accounts[6].name, stage: "won",          type: "implementation",       value: "560000.00", probability: 100, expectedCloseDate: "2026-04-01", expectedStartDate: "2026-05-01", expectedDurationWeeks: 32, ownerId: dir?.id, ownerName: dir?.name, deliveryComplexity: "high",      staffingRisk: "medium", summary: "Full greenfield OTM 24.2 implementation for Summit. Project kicked off May 2026.",                           goNoGoStatus: "approved" },
    { name: "Harbor Logistics — OTM Rate Maintenance",        accountId: accounts[7].id, accountName: accounts[7].name, stage: "lost",         type: "rate_maintenance",     value: "80000.00",  probability: 0,  expectedCloseDate: "2026-03-15", expectedDurationWeeks: 8,          ownerId: sr?.id,  ownerName: sr?.name,  deliveryComplexity: "low",       staffingRisk: "none",   summary: "Rate table maintenance and carrier onboarding. Lost to competitor with lower day-rate.",                     goNoGoStatus: "rejected" },
    { name: "GlobalTrans — OTM Support Retainer",             accountId: accounts[0].id, accountName: accounts[0].name, stage: "won",          type: "ams",                  value: "180000.00", probability: 100, expectedCloseDate: "2025-12-15", expectedStartDate: "2026-01-01", expectedDurationWeeks: 52, ownerId: sr?.id,  ownerName: sr?.name,  deliveryComplexity: "low",       staffingRisk: "none",   summary: "Annual AMS retainer providing 40 hrs/month OTM functional and technical support.",                          goNoGoStatus: "approved" },
    { name: "Apex Logistics — Carrier Network Expansion",     accountId: accounts[1].id, accountName: accounts[1].name, stage: "discovery",    type: "implementation",       value: "245000.00", probability: 35, expectedCloseDate: "2026-10-01", expectedStartDate: "2026-11-01", expectedDurationWeeks: 18, ownerId: dir?.id, ownerName: dir?.name, deliveryComplexity: "medium",     staffingRisk: "low",    summary: "Onboard 12 new carriers into Apex OTM including EDI 214/990 integration and rate agreements.",              goNoGoStatus: "pending"  },
  ]);
  console.log("[auto-seed] Inserted opportunities");

  console.log("[auto-seed] ✅ Seed complete.");
}

// ── Supplemental seed — fills tables left empty by original seed ──────────────
export async function seedSupplementalIfEmpty() {
  const checks = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(timeEntryCategoriesTable),
    db.select({ count: sql<number>`count(*)` }).from(rateCardsTable),
    db.select({ count: sql<number>`count(*)` }).from(prospectsTable),
  ]);
  const [catCount, rcCount, prospCount] = checks.map(r => Number(r[0].count));

  if (catCount === 0) {
    await db.insert(timeEntryCategoriesTable).values([
      { name: "OTM Configuration",   code: "OTM-CONFIG",   defaultBillable: true,  sortOrder: 1,  isActive: true },
      { name: "Integration Build",   code: "INT-BUILD",    defaultBillable: true,  sortOrder: 2,  isActive: true },
      { name: "Testing & QA",        code: "TEST-QA",      defaultBillable: true,  sortOrder: 3,  isActive: true },
      { name: "Project Management",  code: "PM",           defaultBillable: true,  sortOrder: 4,  isActive: true },
      { name: "Client Workshop",     code: "WORKSHOP",     defaultBillable: true,  sortOrder: 5,  isActive: true },
      { name: "UAT Support",         code: "UAT",          defaultBillable: true,  sortOrder: 6,  isActive: true },
      { name: "Documentation",       code: "DOCS",         defaultBillable: false, sortOrder: 7,  isActive: true },
      { name: "Internal Training",   code: "TRAIN-INT",    defaultBillable: false, sortOrder: 8,  isActive: true },
      { name: "Client Training",     code: "TRAIN-CLIENT", defaultBillable: true,  sortOrder: 9,  isActive: true },
      { name: "AMS / Support",       code: "AMS",          defaultBillable: true,  sortOrder: 10, isActive: true },
      { name: "Hypercare",           code: "HYPERCARE",    defaultBillable: true,  sortOrder: 11, isActive: true },
      { name: "Pre-Sales / Scoping", code: "PRE-SALES",    defaultBillable: false, sortOrder: 12, isActive: true },
      { name: "Travel",              code: "TRAVEL",       defaultBillable: false, sortOrder: 13, isActive: false },
      { name: "Admin",               code: "ADMIN",        defaultBillable: false, sortOrder: 14, isActive: false },
    ]);
    console.log("[auto-seed] Seeded time_entry_categories");
  }

  if (rcCount === 0) {
    await db.insert(rateCardsTable).values([
      { name: "Standard OTM Architect",        role: "OTM Architect",             practiceArea: "Implementation", billingRate: "285.00", sellRate: "240.00", costRate: "135.00", effectiveDate: "2025-01-01", expiryDate: "2025-12-31", isTemplate: true,  currency: "CAD", notes: "Blended NA + EMEA rate" },
      { name: "Senior OTM Functional",         role: "Senior OTM Consultant",     practiceArea: "Implementation", billingRate: "235.00", sellRate: "195.00", costRate: "110.00", effectiveDate: "2025-01-01", expiryDate: "2025-12-31", isTemplate: true,  currency: "CAD", notes: null },
      { name: "OTM Rate Engine Specialist",    role: "Rate Engine Specialist",    practiceArea: "Rate Services",  billingRate: "260.00", sellRate: "215.00", costRate: "125.00", effectiveDate: "2025-01-01", expiryDate: "2025-12-31", isTemplate: true,  currency: "CAD", notes: "Carrier rate management expertise" },
      { name: "Project Manager — Standard",    role: "Project Manager",           practiceArea: "Delivery",       billingRate: "210.00", sellRate: "175.00", costRate: "100.00", effectiveDate: "2025-01-01", expiryDate: "2025-12-31", isTemplate: true,  currency: "CAD", notes: null },
      { name: "AMS Support Rate",              role: "OTM Functional Consultant", practiceArea: "AMS",            billingRate: "195.00", sellRate: "160.00", costRate: "90.00",  effectiveDate: "2025-01-01", expiryDate: "2025-12-31", isTemplate: true,  currency: "CAD", notes: "Applied Managed Support accounts" },
      { name: "GlobalTrans — Premium Rate",    role: "OTM Architect",             practiceArea: "Implementation", billingRate: "310.00", sellRate: "265.00", costRate: "135.00", effectiveDate: "2025-01-01", expiryDate: "2025-12-31", isTemplate: false, currency: "CAD", accountId: 1, notes: "Negotiated premium rate for GlobalTrans enterprise agreement" },
      { name: "Apex Logistics — Blended Rate", role: "Senior OTM Consultant",    practiceArea: "Implementation", billingRate: "248.00", sellRate: "205.00", costRate: "110.00", effectiveDate: "2025-01-01", expiryDate: "2025-12-31", isTemplate: false, currency: "CAD", accountId: 2, notes: "Account-specific blended rate per MSA" },
      { name: "NorthStar — AMS Rate",          role: "OTM Functional Consultant", practiceArea: "AMS",           billingRate: "200.00", sellRate: "165.00", costRate: "90.00",  effectiveDate: "2025-01-01", expiryDate: "2025-12-31", isTemplate: false, currency: "CAD", accountId: 3, notes: "Dedicated AMS support retainer rate" },
    ]);
    console.log("[auto-seed] Seeded rate_cards");
  }

  if (prospCount === 0) {
    await db.insert(prospectsTable).values([
      { name: "Cascade Freight Solutions", type: "new_logo",  industry: "Third-Party Logistics",      segment: "mid_market", status: "active",  primaryContactName: "Brian Kato",    primaryContactEmail: "b.kato@cascadefreight.com",    sentiment: "positive",     ownerId: 13, touchPoints: [{ date: "2026-01-15", type: "intro_call", note: "Initial discovery call" }, { date: "2026-02-10", type: "demo", note: "Full OTM demo" }],                                       notes: "Strong interest in OTM Cloud. Q3 target start." },
      { name: "Irongate Transport Group",  type: "new_logo",  industry: "Freight Brokerage",          segment: "enterprise", status: "active",  primaryContactName: "Wendy Park",    primaryContactEmail: "wpark@irongatetransport.com",  sentiment: "neutral",      ownerId: 14, touchPoints: [{ date: "2026-02-01", type: "intro_call", note: "Cold outreach" }, { date: "2026-03-12", type: "demo", note: "Rate Management demo" }],                                          notes: "Evaluating three vendors. Decision Q4 2026." },
      { name: "Redline Logistics Inc.",    type: "expansion", industry: "E-Commerce Fulfillment",     segment: "mid_market", status: "active",  primaryContactName: "Tomás García",  primaryContactEmail: "tgarcia@redlinelogistics.com", sentiment: "very_positive", ownerId: 13, touchPoints: [{ date: "2026-01-20", type: "intro_call", note: "Referral from GlobalTrans" }, { date: "2026-02-14", type: "workshop", note: "2-day scoping workshop" }],                           notes: "Expanding to LATAM. Wants full implementation + AMS." },
      { name: "Delta Forwarding",          type: "new_logo",  industry: "Air & Ocean Freight",        segment: "enterprise", status: "nurture", primaryContactName: "Sandra Bates",  primaryContactEmail: "s.bates@deltaforwarding.com",  sentiment: "neutral",      ownerId: 14, touchPoints: [{ date: "2026-01-08", type: "event", note: "Met at Gartner SC Summit" }, { date: "2026-02-28", type: "intro_call", note: "Discovery call, budget TBC" }],                        notes: "RFP expected H2 2026. Keep warm." },
      { name: "Halcyon Supply Chain",      type: "new_logo",  industry: "Pharmaceutical Distribution", segment: "enterprise", status: "active", primaryContactName: "Nora Lindqvist", primaryContactEmail: "n.lindqvist@halcyonsc.com",   sentiment: "positive",     ownerId: 13, touchPoints: [{ date: "2025-12-01", type: "intro_call", note: "Inbound inquiry" }, { date: "2026-01-18", type: "demo", note: "Compliance module demo" }],                                       notes: "High probability. Regulatory compliance driver." },
      { name: "Volta Shipping & Co.",      type: "new_logo",  industry: "Container Shipping",         segment: "mid_market", status: "lost",   primaryContactName: "Alec Drummond", primaryContactEmail: "a.drummond@voltashipping.com", sentiment: "negative",     ownerId: 14, touchPoints: [{ date: "2025-11-15", type: "intro_call", note: "Initial call" }, { date: "2026-01-05", type: "follow_up", note: "Lost to Oracle Direct" }],                                         notes: "Lost to Oracle Direct on price." },
    ]);
    console.log("[auto-seed] Seeded prospects");
  }

  // Templates
  const [{ count: tplCount }] = await db.select({ count: sql<number>`count(*)` }).from(templatesTable);
  if (Number(tplCount) === 0) {
    const tpls = await db.insert(templatesTable).values([
      { name: "OTM Cloud Implementation — Standard", type: "implementation", description: "Full-lifecycle OTM Cloud implementation template.", phases: [{ name: "Discovery & Architecture", order: 1, durationWeeks: 4 }, { name: "Build & Configuration", order: 2, durationWeeks: 10 }, { name: "Testing", order: 3, durationWeeks: 4 }, { name: "Go-Live & Hypercare", order: 4, durationWeeks: 4 }], conditions: { cloudDeployment: true } },
      { name: "OTM AMS Retainer — Managed Support",  type: "ams",            description: "Template for Applied Managed Support engagements.",  phases: [{ name: "Onboarding", order: 1, durationWeeks: 2 }, { name: "Monthly AMS Cycle", order: 2, durationWeeks: 4, repeating: true }], conditions: {} },
      { name: "OTM Certification — Quarterly",        type: "certification",  description: "Quarterly OTM regression certification package.",    phases: [{ name: "Test Planning", order: 1, durationWeeks: 1 }, { name: "Test Execution", order: 2, durationWeeks: 3 }, { name: "Sign-Off", order: 3, durationWeeks: 1 }], conditions: {} },
    ]).returning();
    const [t1, t2, t3] = tpls;
    await db.insert(templateTasksTable).values([
      { templateId: t1.id, name: "Current-State Integration Inventory",    taskType: "work", sortOrder: 1,  estimatedHours: "32",  durationDays: 4,  resourceRole: "OTM Architect",           depType: "FS", predecessorIds: [] },
      { templateId: t1.id, name: "Architecture Design Document",           taskType: "work", sortOrder: 2,  estimatedHours: "40",  durationDays: 5,  resourceRole: "OTM Architect",           depType: "FS", predecessorIds: [1] },
      { templateId: t1.id, name: "OTM Baseline Configuration",             taskType: "work", sortOrder: 3,  estimatedHours: "80",  durationDays: 10, resourceRole: "Senior OTM Consultant",   depType: "FS", predecessorIds: [2] },
      { templateId: t1.id, name: "Integration Build — Carrier Interfaces", taskType: "work", sortOrder: 4,  estimatedHours: "160", durationDays: 20, resourceRole: "Integration Lead",         depType: "SS", predecessorIds: [2] },
      { templateId: t1.id, name: "SIT Execution & Defect Log",             taskType: "work", sortOrder: 5,  estimatedHours: "80",  durationDays: 10, resourceRole: "OTM Architect",           depType: "FS", predecessorIds: [3, 4] },
      { templateId: t1.id, name: "UAT Execution Support",                  taskType: "work", sortOrder: 6,  estimatedHours: "60",  durationDays: 8,  resourceRole: "Senior OTM Consultant",   depType: "FS", predecessorIds: [5] },
      { templateId: t1.id, name: "Cutover & Go-Live",                      taskType: "work", sortOrder: 7,  estimatedHours: "40",  durationDays: 5,  resourceRole: "OTM Architect",           depType: "FS", predecessorIds: [6] },
      { templateId: t1.id, name: "Hypercare Support (30 days)",            taskType: "work", sortOrder: 8,  estimatedHours: "120", durationDays: 20, resourceRole: "Senior OTM Consultant",   depType: "FS", predecessorIds: [7] },
      { templateId: t2.id, name: "AMS Onboarding & Runbook",               taskType: "work", sortOrder: 1,  estimatedHours: "24",  durationDays: 3,  resourceRole: "Senior OTM Consultant",   depType: "FS", predecessorIds: [] },
      { templateId: t2.id, name: "Monthly Support Allocation",             taskType: "work", sortOrder: 2,  estimatedHours: "160", durationDays: 20, resourceRole: "OTM Functional Consultant",depType: "FS", predecessorIds: [] },
      { templateId: t2.id, name: "Monthly Health Report",                  taskType: "work", sortOrder: 3,  estimatedHours: "8",   durationDays: 1,  resourceRole: "Project Manager",          depType: "FS", predecessorIds: [] },
      { templateId: t3.id, name: "Test Plan & Scenario Matrix",            taskType: "work", sortOrder: 1,  estimatedHours: "24",  durationDays: 3,  resourceRole: "OTM Architect",            depType: "FS", predecessorIds: [] },
      { templateId: t3.id, name: "SIT Regression Execution — Core OTM",   taskType: "work", sortOrder: 2,  estimatedHours: "80",  durationDays: 10, resourceRole: "Senior OTM Consultant",    depType: "FS", predecessorIds: [1] },
      { templateId: t3.id, name: "Defect Triage & Resolution",             taskType: "work", sortOrder: 3,  estimatedHours: "40",  durationDays: 5,  resourceRole: "OTM Architect",            depType: "FS", predecessorIds: [2] },
      { templateId: t3.id, name: "Certification Sign-Off Package",         taskType: "work", sortOrder: 4,  estimatedHours: "16",  durationDays: 2,  resourceRole: "Project Manager",          depType: "FS", predecessorIds: [3] },
    ]);
    console.log("[auto-seed] Seeded templates + template_tasks");
  }

  // Automations
  const [{ count: autoCount }] = await db.select({ count: sql<number>`count(*)` }).from(automationsTable);
  if (Number(autoCount) === 0) {
    await db.insert(automationsTable).values([
      { name: "Milestone Overdue Alert",   trigger: "milestone.due_date_passed",  description: "Sends a notification when a milestone passes its due date without completion.", conditions: { status: { not_in: ["complete", "cancelled"] } }, actions: [{ type: "create_notification", target: "project_manager", template: "milestone_overdue" }], enabled: true, runCount: 47, lastRunAt: "2026-04-16" },
      { name: "Timesheet Late Reminder",   trigger: "schedule.weekly_friday_4pm", description: "Reminds consultants who have not submitted timesheets by Friday 4 PM.",          conditions: { timesheet_submitted: false },                    actions: [{ type: "email", template: "timesheet_reminder" }],                                        enabled: true, runCount: 23, lastRunAt: "2026-04-11" },
      { name: "Low Health Score Alert",    trigger: "account.health_score_changed",description: "Creates a task when an account health score drops below 60.",                   conditions: { health_score: { lt: 60 } },                      actions: [{ type: "create_task", title: "Review account health decline", priority: "high" }],           enabled: true, runCount: 8,  lastRunAt: "2026-04-10" },
      { name: "Contract Expiry Warning",   trigger: "schedule.daily_9am",         description: "Notifies finance and AM when a contract is within 60 days of expiry.",           conditions: { within_days: 60 },                               actions: [{ type: "create_notification", target: "finance_lead", template: "contract_expiry_warning" }],enabled: true, runCount: 134,lastRunAt: "2026-04-17" },
    ]);
    console.log("[auto-seed] Seeded automations");
  }

  // Forms
  const [{ count: formCount }] = await db.select({ count: sql<number>`count(*)` }).from(formsTable);
  if (Number(formCount) === 0) {
    await db.insert(formsTable).values([
      { name: "Project Closure Sign-Off",      type: "closure",   description: "Client-facing project closure sign-off form.", fields: [{ id: "satisfaction", label: "Overall Satisfaction", type: "rating", scale: 5, required: true }, { id: "comments", label: "Additional Comments", type: "textarea", required: false }], triggers: [{ event: "milestone.status_changed", filter: { status: "complete", is_final: true } }], status: "active" },
      { name: "Timesheet Approval Request",    type: "timesheet", description: "Internal PM timesheet approval form.",          fields: [{ id: "week_ending", label: "Week Ending", type: "date", required: true }, { id: "hours_submitted", label: "Total Hours Submitted", type: "number", required: true }],               triggers: [{ event: "timesheet.submitted" }],                                                             status: "active" },
      { name: "Client Feedback — Post Milestone", type: "feedback", description: "Short client satisfaction pulse.",           fields: [{ id: "satisfaction", label: "Delivery Satisfaction", type: "rating", scale: 5, required: true }, { id: "open_feedback", label: "Anything to improve?", type: "textarea", required: false }], triggers: [{ event: "milestone.invoiced" }],                                                              status: "active" },
    ]);
    console.log("[auto-seed] Seeded forms");
  }

  // Renewal Signals
  const [{ count: rnCount }] = await db.select({ count: sql<number>`count(*)` }).from(renewalSignalsTable);
  if (Number(rnCount) === 0) {
    await db.insert(renewalSignalsTable).values([
      { accountId: 2, accountName: "Apex Logistics",         signalType: "contract_expiry", description: "AMS contract expires Aug 15. Renewal 60-day window open.",              dueDate: "2025-08-15", estimatedValue: "320000", status: "open",        priority: "high",     assignedTo: "Yuki Nakamura",  notes: "Client satisfaction 71%. Prepare case study." },
      { accountId: 1, accountName: "GlobalTrans Corp",       signalType: "expansion",       description: "Phase 2 nearing completion. AMS expansion signal confirmed.",            dueDate: "2026-06-30", estimatedValue: "480000", status: "open",        priority: "high",     assignedTo: "Yuki Nakamura",  notes: "Position AMS renewal alongside Phase 2 close-out." },
      { accountId: 5, accountName: "Meridian Carriers",      signalType: "contract_expiry", description: "Support retainer ends Q2 2026. Upgrade may convert to AMS.",            dueDate: "2026-05-31", estimatedValue: "144000", status: "in_progress", priority: "medium",   assignedTo: "Carlos Rivera",  notes: "AMS option included in upgrade SOW." },
      { accountId: 6, accountName: "BlueStar Transport",     signalType: "expansion",       description: "Client expressed interest in Carrier Performance Analytics module.",     dueDate: "2026-07-01", estimatedValue: "95000",  status: "open",        priority: "medium",   assignedTo: "Carlos Rivera",  notes: "Schedule discovery call in May." },
      { accountId: 8, accountName: "Harbor Logistics Group", signalType: "health_risk",     description: "CSAT dropped to 52 after rate table errors. Churn risk before renewal.", dueDate: "2026-08-01", estimatedValue: "160000", status: "open",        priority: "critical", assignedTo: "Yuki Nakamura",  notes: "Remediation plan in place. Send apology communication." },
    ]);
    console.log("[auto-seed] Seeded renewal_signals");
  }

  // Staffing Requests
  const [{ count: srCount }] = await db.select({ count: sql<number>`count(*)` }).from(staffingRequestsTable);
  if (Number(srCount) === 0) {
    await db.insert(staffingRequestsTable).values([
      { projectId: 1, projectName: "GlobalTrans OTM Cloud Migration",    requestedRole: "OTM Integration Architect",       requiredSkills: ["OTM","MuleSoft","EDI","Groovy"],                 startDate: "2026-05-01", endDate: "2026-08-31", hoursPerWeek: 40, allocationPct: 100, priority: "critical", status: "open",      notes: "Primary integration architect for Phase 2. MuleSoft certification required.", requestedByName: "Alex Okafor", practiceArea: "Implementation" },
      { projectId: 6, projectName: "BlueStar OTM Cloud Implementation",  requestedRole: "Senior OTM Functional Consultant", requiredSkills: ["OTM","Carrier Management","Rate Engine"],       startDate: "2026-05-15", endDate: "2026-10-31", hoursPerWeek: 40, allocationPct: 100, priority: "high",     status: "in_review", notes: "Functional lead for BlueStar. OTM 23D experience mandatory.",               requestedByName: "Tom Kirkland", practiceArea: "Implementation" },
      { projectId: 8, projectName: "Apex EMEA Order Management Module",  requestedRole: "OTM Rate Engine Specialist",       requiredSkills: ["OTM","Rate Records","Carrier Networks","EMEA"], startDate: "2026-06-01", endDate: "2026-09-30", hoursPerWeek: 32, allocationPct: 80,  priority: "high",     status: "open",      notes: "Must understand European carrier frameworks and multi-currency rates.",      requestedByName: "Priya Mehta",  practiceArea: "Rate Services" },
      { projectId: 9, projectName: "GlobalTrans Integration Upgrade",    requestedRole: "Project Manager",                  requiredSkills: ["OTM","PMO","Delivery","Jira"],                  startDate: "2026-05-01", endDate: "2026-11-30", hoursPerWeek: 40, allocationPct: 100, priority: "high",     status: "fulfilled", notes: "PM for integration upgrade workstream.",                                     requestedByName: "Alex Okafor", practiceArea: "Delivery" },
      { projectId: 3, projectName: "NorthStar AMS Retainer",             requestedRole: "OTM Functional Consultant",        requiredSkills: ["OTM","AMS","OTM 24A"],                          startDate: "2026-05-01", endDate: "2026-12-31", hoursPerWeek: 16, allocationPct: 40,  priority: "medium",   status: "open",      notes: "Part-time AMS backfill for resource going on leave in May.",               requestedByName: "Tom Kirkland", practiceArea: "AMS" },
      { projectId: 5, projectName: "GlobalTrans Data Acceleration",      requestedRole: "Data / ETL Specialist",            requiredSkills: ["OTM","SQL","ETL","Python","Data Migration"],   startDate: "2026-06-15", endDate: "2026-09-15", hoursPerWeek: 32, allocationPct: 80,  priority: "medium",   status: "open",      notes: "Large-scale historical shipment data migration.",                           requestedByName: "Alex Okafor", practiceArea: "Data Services" },
    ]);
    console.log("[auto-seed] Seeded staffing_requests");
  }

  // Task comments
  const [{ count: tcCount }] = await db.select({ count: sql<number>`count(*)` }).from(taskCommentsTable);
  if (Number(tcCount) === 0) {
    await db.insert(taskCommentsTable).values([
      { taskId: 1, authorId: 7, body: "Integration inventory complete across all 14 integration points. SAP, WMS, and 3 carrier EDI feeds documented. Sharing working doc in SharePoint now.", mentionedUserIds: [], isExternal: false },
      { taskId: 1, authorId: 4, body: "Thanks Derek — looks comprehensive. Flag the EDI 214 mapping — that one caused issues last engagement. Let's review Thursday.", mentionedUserIds: [7], isExternal: false },
      { taskId: 2, authorId: 7, body: "Architecture draft complete. Hub-and-spoke model with MuleSoft middleware. Two open questions on VPN tunnel vs API Gateway — left as comments for Alex to decide.", mentionedUserIds: [4], isExternal: false },
      { taskId: 3, authorId: 8, body: "SIT Wave 1 complete — 42 of 48 scenarios passed. 6 defects raised (all P2). Rate calculation on multi-stop shipments is the main issue. Fix ETA is EOD tomorrow.", mentionedUserIds: [], isExternal: false },
      { taskId: 3, authorId: 4, body: "Good progress. Loop in Aisha on the rate calculation defect — she's done this fix before on the Apex engagement.", mentionedUserIds: [8], isExternal: false },
      { taskId: 5, authorId: 8, body: "UAT scenarios uploaded to client portal. Flagging: Robert's team asked for 2 additional scenarios around cross-border shipments — added to backlog for PM approval.", mentionedUserIds: [4, 17], isExternal: false },
      { taskId: 6, authorId: 4, body: "Go-live runbook v1 sent to client. Cut-over window locked — Sunday 2 AM. Standby team confirmed.", mentionedUserIds: [7, 8], isExternal: false },
      { taskId: 7, authorId: 8, body: "EMEA carrier rate analysis complete. 23 carrier rate tables identified. 8 are non-standard format and will need manual conversion. Adding 12h to estimate.", mentionedUserIds: [5], isExternal: false },
      { taskId: 10, authorId: 9, body: "24A regression suite complete. All 94 scenarios passed on first run — cleanest certification I've seen. Cert letter drafted and ready for Tom's review.", mentionedUserIds: [6], isExternal: false },
      { taskId: 12, authorId: 6, body: "23D test plan v1 shared with Pacific team. Waiting on their UAT lead — Sarah mentioned she'll introduce us by end of week.", mentionedUserIds: [], isExternal: false },
    ]);
    console.log("[auto-seed] Seeded task_comments");
  }

  // Milestone comments
  const [{ count: mcCount }] = await db.select({ count: sql<number>`count(*)` }).from(milestoneCommentsTable);
  if (Number(mcCount) === 0) {
    await db.insert(milestoneCommentsTable).values([
      { milestoneId: 1, projectId: 1, authorName: "Alex Okafor",  authorRole: "project_manager",      body: "Integration assessment signed off by GlobalTrans IT. Robert confirmed all 14 integration points in scope. Moving to architecture phase next week.", isClientVisible: false },
      { milestoneId: 3, projectId: 1, authorName: "Derek Tran",   authorRole: "technical_consultant",  body: "SIT execution complete. 6 defects raised, all P2 or below. Rate calculation defect #SIT-034 is highest risk — fix deployed and retested this morning.", isClientVisible: false },
      { milestoneId: 3, projectId: 1, authorName: "Alex Okafor",  authorRole: "project_manager",       body: "SIT milestone conditionally approved pending final retest of #SIT-034. Aisha to confirm closure by EOD.", isClientVisible: false },
      { milestoneId: 5, projectId: 1, authorName: "Alex Okafor",  authorRole: "project_manager",       body: "Go-live achieved on schedule. Hypercare team standing by. All 14 integrations live in production. First production shipment transmitted at 03:14 AM.", isClientVisible: true },
      { milestoneId: 8, projectId: 3, authorName: "Tom Kirkland", authorRole: "project_manager",       body: "Q1 2025 certification complete. NorthStar formally received Oracle certification letter. Sending client summary report.", isClientVisible: true },
      { milestoneId: 11, projectId: 4, authorName: "Tom Kirkland",authorRole: "project_manager",       body: "23D certification complete — all 178 test cases passed, 12 defects resolved. Certification letter sent to Oracle Certification Authority.", isClientVisible: true },
    ]);
    console.log("[auto-seed] Seeded milestone_comments");
  }
}

// Keeps demo data fresh — extends allocation end dates that have already passed
// so the heatmap and utilisation views always show live-looking data.
export async function autoFixExpiredAllocations() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ id: allocationsTable.id })
    .from(allocationsTable)
    .where(lt(allocationsTable.endDate, today));

  if (rows.length === 0) return;

  // Extend every expired allocation by 18 months from today
  const extended = new Date();
  extended.setMonth(extended.getMonth() + 18);
  const newEnd = extended.toISOString().slice(0, 10);

  for (const row of rows) {
    await db
      .update(allocationsTable)
      .set({ endDate: newEnd })
      .where(eq(allocationsTable.id, row.id));
  }
  console.log(`[auto-seed] Extended ${rows.length} expired allocation(s) to ${newEnd}`);
}
