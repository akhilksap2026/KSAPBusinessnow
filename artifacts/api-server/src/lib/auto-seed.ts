import { db } from "@workspace/db";
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
  opportunitiesTable,
  contractsTable,
  rateCardsTable,
  formsTable,
  changeRequestsTable,
  notificationsTable,
  automationsTable,
  renewalSignalsTable,
  phasesTable,
  templatesTable,
  staffingRequestsTable,
} from "@workspace/db";
import { sql, eq } from "drizzle-orm";

export async function autoSeedIfEmpty() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(accountsTable);
  if (Number(count) > 0) {
    console.log("[auto-seed] Database already has data — skipping seed.");
    return;
  }
  await runSeed();
}

export async function runSeed() {
  console.log("[auto-seed] Seeding demo data...");

  // ── Users ─────────────────────────────────────────────────────────────────
  const users = await db.insert(usersTable).values([
    { name: "Rachel Nguyen",   email: "rachel.nguyen@businessnow.com",  role: "admin",              title: "System Administrator",       active: true },
    { name: "James Whitfield", email: "james.whitfield@businessnow.com",role: "executive",           title: "CEO",                        active: true },
    { name: "Jana Kovac",      email: "jana.kovac@businessnow.com",     role: "delivery_director",   title: "VP of Delivery",             active: true },
    { name: "Alex Okafor",     email: "alex.okafor@businessnow.com",    role: "project_manager",     title: "Senior Project Manager",     active: true },
    { name: "Priya Mehta",     email: "priya.mehta@businessnow.com",    role: "project_manager",     title: "Project Manager",            active: true },
    { name: "Tom Kirkland",    email: "tom.kirkland@businessnow.com",   role: "project_manager",     title: "Project Manager",            active: true },
    { name: "Derek Tran",      email: "derek.tran@businessnow.com",     role: "technical_consultant",title: "Senior Technical Consultant", active: true },
    { name: "Aisha Johnson",   email: "aisha.johnson@businessnow.com",  role: "technical_consultant",title: "OTM Integration Specialist", active: true },
    { name: "Kevin Hart",      email: "kevin.hart@businessnow.com",     role: "technical_consultant",title: "OTM Functional Consultant",  active: true },
    { name: "Maria Santos",    email: "maria.santos@businessnow.com",   role: "resource_manager",    title: "Resource Manager",           active: true },
    { name: "Ben Patterson",   email: "ben.patterson@businessnow.com",  role: "resource_manager",    title: "Associate Resource Manager", active: true },
    { name: "Sandra Liu",      email: "sandra.liu@businessnow.com",     role: "finance_lead",        title: "Finance Lead",               active: true },
    { name: "Brendan Walsh",   email: "brendan.walsh@businessnow.com",  role: "finance_lead",        title: "Senior Finance Analyst",     active: true },
    { name: "Diana Flores",    email: "diana.flores@businessnow.com",   role: "sales",               title: "Account Executive",          active: true },
    { name: "Chris Morgan",    email: "chris.morgan@businessnow.com",   role: "sales",               title: "Account Executive",          active: true },
    { name: "Yuki Tanaka",     email: "yuki.tanaka@businessnow.com",    role: "account_manager",     title: "Account Manager",            active: true },
    { name: "Carlos Rivera",   email: "carlos.rivera@businessnow.com",  role: "account_manager",     title: "Account Manager",            active: true },
    { name: "Robert Chen",     email: "robert.chen@client.globaltrans.com", role: "client_stakeholder", title: "IT Director",            active: true },
    { name: "Angela Torres",   email: "angela.torres@client.apexlogistics.com", role: "client_stakeholder", title: "VP Operations",     active: true },
  ]).returning();
  console.log(`[auto-seed] Inserted ${users.length} users`);

  // Aliases for readability
  const admin     = users[0];
  const exec      = users[1];
  const director  = users[2];
  const pm1       = users[3]; // Alex Okafor
  const pm2       = users[4]; // Priya Mehta
  const pm3       = users[5]; // Tom Kirkland
  const consultant1 = users[6]; // Derek Tran
  const consultant2 = users[7]; // Aisha Johnson
  const consultant3 = users[8]; // Kevin Hart
  const rm1       = users[9];  // Maria Santos
  const rm2       = users[10]; // Ben Patterson
  const fin1      = users[11]; // Sandra Liu
  const fin2      = users[12]; // Brendan Walsh
  const sales1    = users[13]; // Diana Flores
  const sales2    = users[14]; // Chris Morgan
  const am1       = users[15]; // Yuki Tanaka
  const am2       = users[16]; // Carlos Rivera
  const clientStk1 = users[17]; // Robert Chen
  const clientStk2 = users[18]; // Angela Torres

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
    { name: "GlobalTrans OTM Cloud Migration",       accountId: accounts[0].id, accountName: accounts[0].name, type: "cloud_migration",    status: "active",   healthScore: 78, pmId: pm1.id, pmName: pm1.name, startDate: "2024-09-01", endDate: "2026-10-31", goLiveDate: "2025-05-15", budgetHours: "2400", consumedHours: "1620", budgetValue: "480000", billedValue: "280000", completionPct: 67, visibility: "shared_with_client", description: "Full OTM cloud migration from on-premise 23C to Oracle SaaS including data migration, integration re-platforming, and UAT." },
    // 1
    { name: "Apex OTM Rate Engine Implementation",   accountId: accounts[1].id, accountName: accounts[1].name, type: "implementation",     status: "at_risk",  healthScore: 55, pmId: pm2.id, pmName: pm2.name, startDate: "2024-11-01", endDate: "2025-07-31", goLiveDate: "2025-07-01", budgetHours: "1800", consumedHours: "980",  budgetValue: "320000", billedValue: "145000", completionPct: 45, visibility: "shared_with_client", description: "OTM rate engine configuration and rate maintenance system implementation for EMEA freight operations." },
    // 2
    { name: "NorthStar AMS Retainer",                accountId: accounts[2].id, accountName: accounts[2].name, type: "ams",                status: "active",   healthScore: 94, pmId: pm3.id, pmName: pm3.name, startDate: "2024-01-01", endDate: "2026-12-31", goLiveDate: null,         budgetHours: "960",  consumedHours: "520",  budgetValue: "210000", billedValue: "112500", completionPct: 54, visibility: "shared_with_client", description: "Ongoing AMS including monthly OTM certification support, break-fix, and enhancement delivery." },
    // 3
    { name: "Pacific OTM 23D Certification",         accountId: accounts[3].id, accountName: accounts[3].name, type: "certification",      status: "active",   healthScore: 70, pmId: pm1.id, pmName: pm1.name, startDate: "2025-03-01", endDate: "2026-10-31", goLiveDate: "2025-05-30", budgetHours: "320",  consumedHours: "140",  budgetValue: "56000",  billedValue: "28000",  completionPct: 44, visibility: "internal_only", description: "Quarterly OTM certification testing for 23D release including regression suite and issue resolution." },
    // 4
    { name: "GlobalTrans Data Acceleration",         accountId: accounts[0].id, accountName: accounts[0].name, type: "data_acceleration",  status: "on_hold",  healthScore: 62, pmId: pm2.id, pmName: pm2.name, startDate: "2025-02-01", endDate: "2025-04-30", goLiveDate: null,         budgetHours: "480",  consumedHours: "120",  budgetValue: "95000",  billedValue: "22000",  completionPct: 25, visibility: "internal_only", description: "Bulk rate and shipment data loading using OTM data accelerator tools and ETL automation." },
    // 5
    { name: "BlueStar OTM Cloud Implementation",     accountId: accounts[5].id, accountName: accounts[5].name, type: "cloud_migration",    status: "active",   healthScore: 82, pmId: pm3.id, pmName: pm3.name, startDate: "2024-12-01", endDate: "2025-11-30", goLiveDate: "2025-08-30", budgetHours: "1920", consumedHours: "780",  budgetValue: "395000", billedValue: "148000", completionPct: 41, visibility: "shared_with_client", description: "End-to-end OTM SaaS implementation for LTL carrier management and shipment optimization." },
    // 6
    { name: "Summit Freight AMS Support",            accountId: accounts[6].id, accountName: accounts[6].name, type: "ams",                status: "active",   healthScore: 65, pmId: pm2.id, pmName: pm2.name, startDate: "2024-06-01", endDate: "2025-05-31", goLiveDate: null,         budgetHours: "480",  consumedHours: "390",  budgetValue: "155000", billedValue: "130000", completionPct: 81, visibility: "shared_with_client", description: "Annual AMS retainer for OTM incident management, certifications, and minor enhancements." },
    // 7
    { name: "Apex EMEA Order Management Module",     accountId: accounts[1].id, accountName: accounts[1].name, type: "implementation",     status: "active",   healthScore: 71, pmId: pm1.id, pmName: pm1.name, startDate: "2025-04-01", endDate: "2025-12-31", goLiveDate: "2025-11-01", budgetHours: "960",  consumedHours: "120",  budgetValue: "215000", billedValue: "35000",  completionPct: 13, visibility: "shared_with_client", description: "Phase 2 expansion adding Order Management and Shipment Execution modules for EMEA operations." },
    // 8
    { name: "GlobalTrans Integration Upgrade",       accountId: accounts[0].id, accountName: accounts[0].name, type: "implementation",     status: "planning", healthScore: 88, pmId: pm3.id, pmName: pm3.name, startDate: "2025-06-01", endDate: "2025-12-31", goLiveDate: "2025-11-30", budgetHours: "640",  consumedHours: "0",    budgetValue: "175000", billedValue: "0",      completionPct: 0,  visibility: "internal_only", description: "Modernize GlobalTrans OTM integrations to REST APIs after cloud migration go-live, replacing legacy EDI connectors." },
  ]).returning();
  console.log(`[auto-seed] Inserted ${projects.length} projects`);

  // ── Milestones ────────────────────────────────────────────────────────────
  const milestones = await db.insert(milestonesTable).values([
    // Project 0 — GlobalTrans Cloud Migration
    { projectId: projects[0].id, projectName: projects[0].name, name: "Integration Assessment Complete",  dueDate: "2025-01-31", completedDate: "2025-01-28", status: "completed",   isBillable: true, billableAmount: "45000", invoiced: true,  visibility: "shared_with_client", description: "Document all existing OTM integrations and design cloud-compatible architecture" },
    { projectId: projects[0].id, projectName: projects[0].name, name: "DEV Environment Configuration",   dueDate: "2025-02-28", completedDate: "2025-03-05", status: "completed",   isBillable: true, billableAmount: "65000", invoiced: true,  visibility: "shared_with_client", description: "Configure OTM SaaS DEV environment with initial data loads" },
    { projectId: projects[0].id, projectName: projects[0].name, name: "System Integration Testing",      dueDate: "2025-04-15", completedDate: null,          status: "in_progress", isBillable: true, billableAmount: "80000", invoiced: false, visibility: "shared_with_client", description: "End-to-end SIT including all integration touchpoints" },
    { projectId: projects[0].id, projectName: projects[0].name, name: "User Acceptance Testing",         dueDate: "2025-05-01", completedDate: null,          status: "pending",     isBillable: true, billableAmount: "55000", invoiced: false, visibility: "shared_with_client", description: "Client UAT with sign-off documentation" },
    { projectId: projects[0].id, projectName: projects[0].name, name: "Go-Live & Hypercare",             dueDate: "2025-05-15", completedDate: null,          status: "pending",     isBillable: true, billableAmount: "90000", invoiced: false, visibility: "shared_with_client", description: "Production cutover and 2-week hypercare support" },
    // Project 1 — Apex Rate Engine
    { projectId: projects[1].id, projectName: projects[1].name, name: "Rate Engine Design",              dueDate: "2025-01-15", completedDate: null,          status: "overdue",     isBillable: true, billableAmount: "35000", invoiced: false, visibility: "shared_with_client", description: "Configuration design for all carrier rate types and surcharges" },
    { projectId: projects[1].id, projectName: projects[1].name, name: "Rate Build Complete",             dueDate: "2025-03-31", completedDate: null,          status: "at_risk",     isBillable: true, billableAmount: "60000", invoiced: false, visibility: "shared_with_client", description: "All rate records entered and validated in DEV" },
    // Project 2 — NorthStar AMS
    { projectId: projects[2].id, projectName: projects[2].name, name: "Q1 2025 Certification",           dueDate: "2025-03-31", completedDate: "2025-03-28", status: "completed",   isBillable: true, billableAmount: "18000", invoiced: true,  visibility: "shared_with_client", description: "OTM 24A quarterly certification test execution" },
    { projectId: projects[2].id, projectName: projects[2].name, name: "Q2 2025 Certification",           dueDate: "2025-06-30", completedDate: null,          status: "pending",     isBillable: true, billableAmount: "18000", invoiced: false, visibility: "shared_with_client", description: "OTM 24B quarterly certification test execution" },
    // Project 3 — Pacific 23D
    { projectId: projects[3].id, projectName: projects[3].name, name: "23D Test Plan Finalized",         dueDate: "2025-03-15", completedDate: null,          status: "overdue",     isBillable: false, billableAmount: null,   invoiced: false, visibility: "internal_only", description: "Complete test plan for 23D with regression scope" },
    { projectId: projects[3].id, projectName: projects[3].name, name: "23D Certification Complete",      dueDate: "2025-05-30", completedDate: null,          status: "pending",     isBillable: true, billableAmount: "28000", invoiced: false, visibility: "shared_with_client", description: "All regression tests passed, release approved" },
    // Project 5 — BlueStar
    { projectId: projects[5].id, projectName: projects[5].name, name: "Blueprint & Architecture Sign-Off", dueDate: "2025-01-31", completedDate: "2025-01-29", status: "completed", isBillable: true, billableAmount: "55000", invoiced: true,  visibility: "shared_with_client", description: "Approved architecture design for OTM SaaS implementation" },
    { projectId: projects[5].id, projectName: projects[5].name, name: "OTM Configuration Complete",      dueDate: "2025-04-15", completedDate: null,          status: "in_progress", isBillable: true, billableAmount: "95000", invoiced: false, visibility: "shared_with_client", description: "Core OTM module configuration in DEV and QA environments" },
    { projectId: projects[5].id, projectName: projects[5].name, name: "UAT Sign-Off",                    dueDate: "2025-07-31", completedDate: null,          status: "pending",     isBillable: true, billableAmount: "70000", invoiced: false, visibility: "shared_with_client", description: "Full user acceptance testing with client sign-off" },
    { projectId: projects[5].id, projectName: projects[5].name, name: "Go-Live",                         dueDate: "2025-08-30", completedDate: null,          status: "pending",     isBillable: true, billableAmount: "85000", invoiced: false, visibility: "shared_with_client", description: "Production cutover and hypercare period" },
    // Project 7 — Apex EMEA
    { projectId: projects[7].id, projectName: projects[7].name, name: "EMEA Scoping & Design",           dueDate: "2025-05-15", completedDate: null,          status: "in_progress", isBillable: true, billableAmount: "35000", invoiced: false, visibility: "shared_with_client", description: "Requirements analysis and solution design for EMEA order management" },
  ]).returning();
  console.log(`[auto-seed] Inserted ${milestones.length} milestones`);

  // ── Resources ─────────────────────────────────────────────────────────────
  const resources = await db.insert(resourcesTable).values([
    // 0
    { userId: consultant1.id, name: "Derek Tran",      title: "Principal Solution Architect",  practiceArea: "implementation",  skills: ["OTM Configuration","OTM Integration","Process Design","Rate Engine"],   utilizationTarget: 80, currentUtilization: 95,  status: "over_allocated", hourlyRate: "225", location: "Chicago, IL",      isContractor: false, employmentType: "employee",   timezone: "America/Chicago",      costRate: "110", certifications: ["Oracle OTM Cloud Certified Implementation Specialist","Oracle Cloud Infrastructure Foundations"], specialties: ["OTM Carrier Management","OTM Rate Management","S&OP"],         bio: "Principal Solution Architect with 12 years in OTM. Led 15+ global implementations for Fortune 500 shippers." },
    // 1
    { userId: consultant2.id, name: "Aisha Johnson",   title: "Senior Integration Specialist", practiceArea: "integration",     skills: ["EDI Integration","OTM APIs","Java","SOAP/REST","Oracle AIA"],           utilizationTarget: 80, currentUtilization: 85,  status: "allocated",      hourlyRate: "195", location: "Dallas, TX",       isContractor: false, employmentType: "employee",   timezone: "America/New_York",     costRate: "95",  certifications: ["Oracle OTM Cloud Integration Specialist","MuleSoft Certified Developer"],                       specialties: ["OTM-ERP Integration","Oracle Integration Cloud","REST API Development"], bio: "Integration lead specializing in OTM↔ERP/WMS/TMS connectivity using OIC and REST APIs." },
    // 2
    { userId: consultant3.id, name: "Kevin Hart",      title: "QA Lead",                       practiceArea: "qa_certification",skills: ["OTM Testing","Test Automation","Selenium","Certification Testing","JIRA"], utilizationTarget: 80, currentUtilization: 75,  status: "allocated",      hourlyRate: "165", location: "Houston, TX",      isContractor: false, employmentType: "employee",   timezone: "America/Los_Angeles",  costRate: "82",  certifications: ["Oracle OTM QA Certification","ISTQB Foundation Level"],                                        specialties: ["OTM UAT","Regression Testing","Test Automation"],              bio: "QA lead with deep expertise in OTM regression suites and UAT management for large migrations." },
    // 3
    { name: "Maria Santos",    title: "OTM Functional Consultant",    practiceArea: "implementation",  skills: ["OTM Configuration","Rate Maintenance","Business Analysis"],               utilizationTarget: 80, currentUtilization: 110, status: "over_allocated", hourlyRate: "175", location: "San Francisco, CA",isContractor: false, employmentType: "employee",   timezone: "America/Chicago",      costRate: "98",  certifications: ["Oracle OTM Cloud Certified Implementation Specialist"],                                         specialties: ["OTM Functional Design","Rate Configuration","Business Process Reengineering"], bio: "Functional consultant with 8 years in OTM configuration and rate engine design across 20+ projects." },
    // 4
    { name: "Kevin O'Brien",   title: "Data Migration Specialist",    practiceArea: "data_migration",  skills: ["OTM Data Migration","ETL","SQL","Data Accelerator","Python"],             utilizationTarget: 80, currentUtilization: 60,  status: "allocated",      hourlyRate: "180", location: "Atlanta, GA",      isContractor: false, employmentType: "employee",   timezone: "America/New_York",     costRate: "90",  certifications: ["Oracle OTM Data Management Certified"],                                                         specialties: ["Legacy Data Extraction","OTM Data Accelerator","ETL Pipelines"], bio: "Data migration expert focused on OTM shipment history and rate data bulk loading." },
    // 5
    { name: "Yuki Tanaka",     title: "Cloud Migration Architect",    practiceArea: "cloud_migration", skills: ["OTM SaaS","Cloud Architecture","OCI","Integration Re-platforming"],       utilizationTarget: 80, currentUtilization: 80,  status: "allocated",      hourlyRate: "215", location: "Remote",           isContractor: false, employmentType: "employee",   timezone: "America/Los_Angeles",  costRate: "105", certifications: ["Oracle Cloud Infrastructure Architect Associate","Oracle OTM Cloud Certified Implementation Specialist"], specialties: ["OCI Architecture","OTM SaaS Migration","Integration Re-platforming"], bio: "Cloud architect with expertise in moving complex on-prem OTM instances to Oracle Cloud Infrastructure." },
    // 6
    { name: "Carlos Rivera",   title: "AMS Support Engineer",         practiceArea: "ams",             skills: ["OTM Support","Incident Management","OTM Configuration","Bug Analysis"],   utilizationTarget: 80, currentUtilization: 72,  status: "allocated",      hourlyRate: "145", location: "Denver, CO",       isContractor: false, employmentType: "employee",   timezone: "America/Denver",       costRate: "70",  certifications: ["Oracle OTM Support Specialist"],                                                                specialties: ["Incident Triage","OTM Patch Analysis","SLA Management"],       bio: "AMS support engineer delivering Tier 2/3 support for OTM clients across North America." },
    // 7
    { name: "Priya Mehta",     title: "Senior OTM Developer",         practiceArea: "development",     skills: ["OTM Customization","Java","Groovy Scripts","OTM Webservices","XSL"],      utilizationTarget: 80, currentUtilization: 0,   status: "soft_booked",    hourlyRate: "200", location: "New York, NY",     isContractor: false, employmentType: "employee",   timezone: "America/New_York",     costRate: "98",  certifications: ["Oracle OTM Technical Specialist"],                                                              specialties: ["OTM Custom Business Objects","Groovy Scripting","Webservice Integration"], bio: "Senior developer building custom OTM extensions and complex webservice integrations." },
    // 8
    { name: "Brendan Walsh",   title: "Rate Maintenance Analyst",     practiceArea: "rate_maintenance",skills: ["OTM Rate Engine","Carrier Rate Analysis","EDI 204/214/990","Excel"],      utilizationTarget: 80, currentUtilization: 80,  status: "allocated",      hourlyRate: "135", location: "Memphis, TN",      isContractor: true,  employmentType: "contractor",  timezone: "America/Chicago",      costRate: "65",  certifications: ["EDI X12 Specialist"],                                                                          specialties: ["Carrier Rate Negotiation","OTM Rate Engine","Spot Quote Management"], bio: "Rate maintenance specialist managing carrier rates and EDI workflows in OTM." },
    // 9
    { name: "Diana Flores",    title: "Pre-Sales Solution Consultant",practiceArea: "pre_sales",       skills: ["OTM Demo","Proposal Writing","RFP Response","Scoping"],                   utilizationTarget: 50, currentUtilization: 40,  status: "available",      hourlyRate: "185", location: "Chicago, IL",      isContractor: false, employmentType: "employee",   timezone: "America/Chicago",      costRate: "88",  certifications: ["Oracle OTM Cloud Certified Implementation Specialist"],                                         specialties: ["Solution Demonstrations","RFP Response","ROI Analysis"],       bio: "Pre-sales consultant supporting BD with OTM demos, proposals, and scoping workshops." },
    // 10
    { name: "Lena Park",       title: "Business Analyst",             practiceArea: "implementation",  skills: ["Requirements Gathering","OTM Configuration","Process Mapping","UAT"],    utilizationTarget: 80, currentUtilization: 90,  status: "over_allocated", hourlyRate: "160", location: "Austin, TX",       isContractor: false, employmentType: "employee",   timezone: "America/Chicago",      costRate: "78",  certifications: ["Oracle OTM Cloud Certified Implementation Specialist","CBAP"],                                  specialties: ["Business Process Analysis","OTM Functional Design","Change Management"], bio: "BA focused on translating business requirements into OTM configuration specifications." },
    // 11
    { name: "Marcus Webb",     title: "Project Manager",              practiceArea: "delivery",        skills: ["Project Management","Risk Management","OTM Delivery","Stakeholder Mgmt"], utilizationTarget: 80, currentUtilization: 70,  status: "allocated",      hourlyRate: "195", location: "Chicago, IL",      isContractor: false, employmentType: "employee",   timezone: "America/Chicago",      costRate: "95",  certifications: ["PMP","Oracle OTM Cloud Certified Implementation Specialist"],                                   specialties: ["OTM Program Management","Executive Reporting","RAID Management"], bio: "Delivery-focused PM with 9 years managing OTM implementations across Fortune 500 shippers." },
  ]).returning();
  console.log(`[auto-seed] Inserted ${resources.length} resources`);

  // ── Allocations ───────────────────────────────────────────────────────────
  // End dates are set to 2026/2027 so the heatmap always shows live data.
  await db.insert(allocationsTable).values([
    // Project 0 — GlobalTrans Cloud Migration (ends 2026-10-31)
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[0].id,  resourceName: resources[0].name,  role: "Solution Architect",       allocationPct: 60,  startDate: "2024-09-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "24" },
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[1].id,  resourceName: resources[1].name,  role: "Integration Lead",          allocationPct: 80,  startDate: "2024-09-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "32" },
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[4].id,  resourceName: resources[4].name,  role: "Data Migration Lead",       allocationPct: 60,  startDate: "2024-11-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "24" },
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[5].id,  resourceName: resources[5].name,  role: "Cloud Architect",           allocationPct: 50,  startDate: "2025-03-01", endDate: "2026-10-31", status: "tentative", allocationType: "soft", hoursPerWeek: "20" },
    // Project 1 — Apex Rate Engine (extended to 2026-09-30)
    { projectId: projects[1].id, projectName: projects[1].name, resourceId: resources[0].id,  resourceName: resources[0].name,  role: "Solution Architect",        allocationPct: 35,  startDate: "2024-11-01", endDate: "2026-09-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "14" },
    { projectId: projects[1].id, projectName: projects[1].name, resourceId: resources[3].id,  resourceName: resources[3].name,  role: "Functional Lead",           allocationPct: 100, startDate: "2024-11-01", endDate: "2026-09-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "40" },
    { projectId: projects[1].id, projectName: projects[1].name, resourceId: resources[8].id,  resourceName: resources[8].name,  role: "Rate Analyst",              allocationPct: 80,  startDate: "2025-01-01", endDate: "2026-09-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "32" },
    { projectId: projects[1].id, projectName: projects[1].name, resourceId: resources[2].id,  resourceName: resources[2].name,  role: "QA Analyst",                allocationPct: 25,  startDate: "2025-04-01", endDate: "2026-09-30", status: "tentative", allocationType: "soft", hoursPerWeek: "10" },
    // Project 2 — NorthStar AMS (ends 2026-12-31)
    { projectId: projects[2].id, projectName: projects[2].name, resourceId: resources[6].id,  resourceName: resources[6].name,  role: "AMS Engineer",              allocationPct: 70,  startDate: "2024-01-01", endDate: "2026-12-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "28" },
    { projectId: projects[2].id, projectName: projects[2].name, resourceId: resources[7].id,  resourceName: resources[7].name,  role: "OTM Developer",             allocationPct: 30,  startDate: "2025-04-01", endDate: "2026-12-31", status: "tentative", allocationType: "soft", hoursPerWeek: "12" },
    // Project 3 — Pacific 23D (ends 2026-10-31)
    { projectId: projects[3].id, projectName: projects[3].name, resourceId: resources[2].id,  resourceName: resources[2].name,  role: "QA Lead",                   allocationPct: 75,  startDate: "2025-03-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "30" },
    { projectId: projects[3].id, projectName: projects[3].name, resourceId: resources[9].id,  resourceName: resources[9].name,  role: "Pre-Sales Support",         allocationPct: 20,  startDate: "2025-03-01", endDate: "2026-10-31", status: "tentative", allocationType: "soft", hoursPerWeek: "8"  },
    // Project 4 — GlobalTrans Data Acceleration (on_hold — keep historical end date)
    { projectId: projects[4].id, projectName: projects[4].name, resourceId: resources[4].id,  resourceName: resources[4].name,  role: "Data Migration Specialist", allocationPct: 40,  startDate: "2025-02-01", endDate: "2025-04-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "16" },
    // Project 5 — BlueStar Cloud (extended to 2026-06-30)
    { projectId: projects[5].id, projectName: projects[5].name, resourceId: resources[5].id,  resourceName: resources[5].name,  role: "Cloud Architect",           allocationPct: 80,  startDate: "2024-12-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "32" },
    { projectId: projects[5].id, projectName: projects[5].name, resourceId: resources[10].id, resourceName: resources[10].name, role: "Business Analyst",          allocationPct: 90,  startDate: "2024-12-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "36" },
    { projectId: projects[5].id, projectName: projects[5].name, resourceId: resources[1].id,  resourceName: resources[1].name,  role: "Integration Developer",     allocationPct: 50,  startDate: "2025-02-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "20" },
    { projectId: projects[5].id, projectName: projects[5].name, resourceId: resources[2].id,  resourceName: resources[2].name,  role: "QA Lead",                   allocationPct: 40,  startDate: "2025-05-01", endDate: "2026-06-30", status: "tentative", allocationType: "soft", hoursPerWeek: "16" },
    // Project 6 — Summit AMS (extended to 2026-05-31)
    { projectId: projects[6].id, projectName: projects[6].name, resourceId: resources[6].id,  resourceName: resources[6].name,  role: "AMS Engineer",              allocationPct: 30,  startDate: "2024-06-01", endDate: "2026-05-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "12" },
    // Project 7 — Apex EMEA (extended to 2026-06-30)
    { projectId: projects[7].id, projectName: projects[7].name, resourceId: resources[0].id,  resourceName: resources[0].name,  role: "Solution Architect",        allocationPct: 30,  startDate: "2025-04-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "12" },
    { projectId: projects[7].id, projectName: projects[7].name, resourceId: resources[10].id, resourceName: resources[10].name, role: "Business Analyst",          allocationPct: 60,  startDate: "2025-04-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "24" },
    // Marcus Webb — delivery PM across active projects
    { projectId: projects[0].id, projectName: projects[0].name, resourceId: resources[11].id, resourceName: resources[11].name, role: "Delivery Manager",          allocationPct: 40,  startDate: "2025-01-01", endDate: "2026-10-31", status: "confirmed", allocationType: "hard", hoursPerWeek: "16" },
    { projectId: projects[7].id, projectName: projects[7].name, resourceId: resources[11].id, resourceName: resources[11].name, role: "Project Manager",           allocationPct: 30,  startDate: "2025-04-01", endDate: "2026-06-30", status: "confirmed", allocationType: "hard", hoursPerWeek: "12" },
  ]);
  console.log("[auto-seed] Inserted allocations");

  // ── Timesheets ────────────────────────────────────────────────────────────
  const weeks = ["2025-03-03","2025-03-10","2025-03-17","2025-03-24","2025-03-31","2025-04-07"];
  const timesheetData: any[] = [];
  const tsPairs: Array<{ proj: number; res: number; billable: boolean }> = [
    { proj: 0, res: 0, billable: true },
    { proj: 0, res: 1, billable: true },
    { proj: 0, res: 4, billable: true },
    { proj: 0, res: 5, billable: true },
    { proj: 1, res: 3, billable: true },
    { proj: 1, res: 8, billable: true },
    { proj: 2, res: 6, billable: true },
    { proj: 3, res: 2, billable: true },
    { proj: 5, res: 5, billable: true },
    { proj: 5, res: 10, billable: true },
    { proj: 6, res: 6, billable: true },
  ];
  for (const week of weeks) {
    for (const pair of tsPairs) {
      const hours = 28 + Math.floor(Math.random() * 14);
      const billable = pair.billable ? hours - Math.floor(Math.random() * 4) : 0;
      const isOld = week < "2025-03-24";
      const isCurrent = week === "2025-03-24" || week === "2025-03-31";
      timesheetData.push({
        projectId: projects[pair.proj].id,
        projectName: projects[pair.proj].name,
        resourceId: resources[pair.res].id,
        resourceName: resources[pair.res].name,
        weekStart: week,
        hoursLogged: String(hours),
        billableHours: String(billable),
        status: isOld ? "approved" : isCurrent ? "submitted" : "draft",
        notes: isOld ? "Week completed and approved" : null,
      });
    }
  }
  await db.insert(timesheetsTable).values(timesheetData);
  console.log(`[auto-seed] Inserted ${timesheetData.length} timesheets`);

  // ── Invoices ──────────────────────────────────────────────────────────────
  await db.insert(invoicesTable).values([
    { invoiceNumber: "INV-0001", projectId: projects[0].id, projectName: projects[0].name, accountId: accounts[0].id, accountName: accounts[0].name, milestoneId: milestones[0].id, amount: "45000",  status: "paid",    issueDate: "2025-02-01", dueDate: "2025-03-01", paidDate: "2025-02-25", notes: "Integration Assessment milestone" },
    { invoiceNumber: "INV-0002", projectId: projects[0].id, projectName: projects[0].name, accountId: accounts[0].id, accountName: accounts[0].name, milestoneId: milestones[1].id, amount: "65000",  status: "paid",    issueDate: "2025-03-10", dueDate: "2025-04-10", paidDate: "2025-04-02", notes: "DEV Environment Configuration milestone" },
    { invoiceNumber: "INV-0003", projectId: projects[0].id, projectName: projects[0].name, accountId: accounts[0].id, accountName: accounts[0].name, milestoneId: null,             amount: "170000", status: "sent",    issueDate: "2025-03-31", dueDate: "2025-04-30", paidDate: null,         notes: "March T&M invoice" },
    { invoiceNumber: "INV-0004", projectId: projects[2].id, projectName: projects[2].name, accountId: accounts[2].id, accountName: accounts[2].name, milestoneId: milestones[7].id, amount: "18000",  status: "paid",    issueDate: "2025-04-01", dueDate: "2025-05-01", paidDate: "2025-04-15", notes: "Q1 Certification" },
    { invoiceNumber: "INV-0005", projectId: projects[1].id, projectName: projects[1].name, accountId: accounts[1].id, accountName: accounts[1].name, milestoneId: null,             amount: "85000",  status: "overdue", issueDate: "2025-02-28", dueDate: "2025-03-28", paidDate: null,         notes: "Feb T&M invoice — payment outstanding" },
    { invoiceNumber: "INV-0006", projectId: projects[3].id, projectName: projects[3].name, accountId: accounts[3].id, accountName: accounts[3].name, milestoneId: null,             amount: "28000",  status: "draft",   issueDate: "2025-04-01", dueDate: "2025-05-01", paidDate: null,         notes: "23D Certification work in progress" },
    { invoiceNumber: "INV-0007", projectId: projects[5].id, projectName: projects[5].name, accountId: accounts[5].id, accountName: accounts[5].name, milestoneId: milestones[11].id,amount: "55000",  status: "paid",    issueDate: "2025-02-05", dueDate: "2025-03-05", paidDate: "2025-02-28", notes: "BlueStar Blueprint milestone" },
    { invoiceNumber: "INV-0008", projectId: projects[5].id, projectName: projects[5].name, accountId: accounts[5].id, accountName: accounts[5].name, milestoneId: null,             amount: "93000",  status: "sent",    issueDate: "2025-04-01", dueDate: "2025-05-01", paidDate: null,         notes: "BlueStar Q1 T&M" },
    { invoiceNumber: "INV-0009", projectId: projects[6].id, projectName: projects[6].name, accountId: accounts[6].id, accountName: accounts[6].name, milestoneId: null,             amount: "38500",  status: "overdue", issueDate: "2025-03-01", dueDate: "2025-03-31", paidDate: null,         notes: "Summit AMS — February retainer" },
    { invoiceNumber: "INV-0010", projectId: projects[2].id, projectName: projects[2].name, accountId: accounts[2].id, accountName: accounts[2].name, milestoneId: null,             amount: "17500",  status: "paid",    issueDate: "2025-03-01", dueDate: "2025-04-01", paidDate: "2025-03-20", notes: "NorthStar AMS — March retainer" },
    { invoiceNumber: "INV-0011", projectId: projects[7].id, projectName: projects[7].name, accountId: accounts[1].id, accountName: accounts[1].name, milestoneId: milestones[15].id,amount: "35000",  status: "sent",    issueDate: "2025-05-10", dueDate: "2025-06-10", paidDate: null,         notes: "Apex EMEA scoping & design milestone" },
    { invoiceNumber: "INV-0012", projectId: projects[4].id, projectName: projects[4].name, accountId: accounts[0].id, accountName: accounts[0].name, milestoneId: null,             amount: "22000",  status: "paid",    issueDate: "2025-02-15", dueDate: "2025-03-15", paidDate: "2025-03-10", notes: "Data acceleration Phase 1 T&M" },
  ]);
  console.log("[auto-seed] Inserted invoices");

  // ── Tasks ─────────────────────────────────────────────────────────────────
  await db.insert(tasksTable).values([
    { projectId: projects[0].id, milestoneId: milestones[0].id, name: "Current-State Integration Inventory",     description: "Document all active OTM integrations: EDI, APIs, custom jobs",                              assignedToId: resources[1].id,  assignedToName: resources[1].name,  status: "completed",  priority: "high",     dueDate: "2025-01-20", estimatedHours: "40", loggedHours: "38", visibility: "internal_only" },
    { projectId: projects[0].id, milestoneId: milestones[0].id, name: "Cloud Architecture Design Document",      description: "Produce target-state architecture diagram and decision log",                                  assignedToId: resources[0].id,  assignedToName: resources[0].name,  status: "completed",  priority: "high",     dueDate: "2025-01-28", estimatedHours: "32", loggedHours: "35", visibility: "shared_with_client" },
    { projectId: projects[0].id, milestoneId: milestones[2].id, name: "SIT Test Execution — Wave 1",             description: "Execute Wave 1 SIT test cases covering order management and rate engine",                       assignedToId: resources[2].id,  assignedToName: resources[2].name,  status: "in_progress",priority: "high",     dueDate: "2025-04-08", estimatedHours: "60", loggedHours: "22", visibility: "shared_with_client" },
    { projectId: projects[0].id, milestoneId: milestones[2].id, name: "Integration Defect Remediation",          description: "Fix SIT defects raised in Wave 1 — carrier portal and EDI 214 failures",                     assignedToId: resources[1].id,  assignedToName: resources[1].name,  status: "in_progress",priority: "critical", dueDate: "2025-04-10", estimatedHours: "48", loggedHours: "18", visibility: "internal_only", blockerNote: "Waiting on client to provide updated EDI spec from Carrier B" },
    { projectId: projects[0].id, milestoneId: milestones[3].id, name: "UAT Scenario Authoring",                  description: "Write 80 UAT test scenarios with client SMEs",                                               assignedToId: resources[0].id,  assignedToName: resources[0].name,  status: "pending",    priority: "medium",   dueDate: "2025-04-20", estimatedHours: "40", loggedHours: "0",  visibility: "shared_with_client" },
    { projectId: projects[0].id, milestoneId: milestones[4].id, name: "Go-Live Runbook",                         description: "Document full cutover sequence: pre-go-live, cutover, hypercare steps",                      assignedToId: resources[0].id,  assignedToName: resources[0].name,  status: "pending",    priority: "medium",   dueDate: "2025-05-05", estimatedHours: "24", loggedHours: "0",  visibility: "shared_with_client" },
    { projectId: projects[1].id, milestoneId: milestones[5].id, name: "Carrier Rate Analysis — EMEA",            description: "Analyze 18-carrier rate matrix and map to OTM rate types",                                    assignedToId: resources[3].id,  assignedToName: resources[3].name,  status: "in_progress",priority: "high",     dueDate: "2025-01-10", estimatedHours: "80", loggedHours: "65", visibility: "shared_with_client" },
    { projectId: projects[1].id, milestoneId: milestones[6].id, name: "Rate Record Entry — All Carriers",        description: "Enter all approved rates into OTM DEV environment",                                           assignedToId: resources[8].id,  assignedToName: resources[8].name,  status: "in_progress",priority: "high",     dueDate: "2025-03-20", estimatedHours: "120",loggedHours: "45", visibility: "shared_with_client" },
    { projectId: projects[1].id, name: "Client Status Report — Week 12",                                         description: "Weekly project status report: RAG, schedule, financials",                                    assignedToId: pm2.id,           assignedToName: pm2.name,           status: "in_progress",priority: "low",      dueDate: "2025-03-28", estimatedHours: "4",  loggedHours: "2",  visibility: "shared_with_client" },
    { projectId: projects[2].id, milestoneId: milestones[7].id, name: "24A Regression Suite — Core OTM",        description: "Execute core OTM regression tests for 24A release",                                           assignedToId: resources[6].id,  assignedToName: resources[6].name,  status: "completed",  priority: "medium",   dueDate: "2025-03-25", estimatedHours: "32", loggedHours: "30", visibility: "shared_with_client" },
    { projectId: projects[2].id, name: "AMS Monthly Report — March 2025",                                        description: "Compile AMS incident log, SLA metrics, and trend analysis for March",                        assignedToId: resources[6].id,  assignedToName: resources[6].name,  status: "in_progress",priority: "low",      dueDate: "2025-04-05", estimatedHours: "6",  loggedHours: "3",  visibility: "shared_with_client" },
    { projectId: projects[3].id, milestoneId: milestones[9].id, name: "23D Test Plan — Scope Definition",       description: "Define regression scope for 23D: modules, data sets, environments",                           assignedToId: resources[2].id,  assignedToName: resources[2].name,  status: "overdue",    priority: "high",     dueDate: "2025-03-10", estimatedHours: "16", loggedHours: "8",  visibility: "internal_only" },
    { projectId: projects[3].id, milestoneId: milestones[10].id,name: "23D Regression Execution",               description: "Execute full regression suite for 23D certification",                                         assignedToId: resources[2].id,  assignedToName: resources[2].name,  status: "pending",    priority: "medium",   dueDate: "2025-05-20", estimatedHours: "48", loggedHours: "0",  visibility: "shared_with_client" },
    { projectId: projects[5].id, milestoneId: milestones[11].id,name: "BlueStar Functional Blueprint",           description: "Document business requirements and OTM solution design for all modules",                      assignedToId: resources[10].id, assignedToName: resources[10].name, status: "completed",  priority: "high",     dueDate: "2025-01-20", estimatedHours: "64", loggedHours: "62", visibility: "shared_with_client" },
    { projectId: projects[5].id, milestoneId: milestones[12].id,name: "OTM Core Module Configuration — DEV",    description: "Configure Carrier Management, Rate Management, and Shipment Execution in DEV",                  assignedToId: resources[5].id,  assignedToName: resources[5].name,  status: "in_progress",priority: "high",     dueDate: "2025-04-30", estimatedHours: "80", loggedHours: "45", visibility: "shared_with_client" },
    { projectId: projects[5].id, milestoneId: milestones[12].id,name: "BlueStar Integration Build — TMS/WMS",   description: "Build REST integrations between OTM and client WMS (Manhattan) and ERP (SAP)",                  assignedToId: resources[1].id,  assignedToName: resources[1].name,  status: "in_progress",priority: "high",     dueDate: "2025-05-15", estimatedHours: "96", loggedHours: "32", visibility: "internal_only" },
    { projectId: projects[6].id, name: "Summit AMS April Incident Report",                                       description: "Monthly incident summary and SLA compliance report for Summit Freight",                       assignedToId: resources[6].id,  assignedToName: resources[6].name,  status: "in_progress",priority: "low",      dueDate: "2025-05-05", estimatedHours: "6",  loggedHours: "2",  visibility: "shared_with_client" },
    { projectId: projects[7].id, milestoneId: milestones[15].id,name: "Apex EMEA Requirements Workshop",        description: "3-day workshop with EMEA ops team to capture order management requirements",                   assignedToId: resources[10].id, assignedToName: resources[10].name, status: "completed",  priority: "high",     dueDate: "2025-04-15", estimatedHours: "24", loggedHours: "26", visibility: "shared_with_client" },
    { projectId: projects[7].id, milestoneId: milestones[15].id,name: "Apex EMEA Solution Design Document",     description: "Write solution design document for Order Management and Shipment Execution EMEA scope",         assignedToId: resources[0].id,  assignedToName: resources[0].name,  status: "in_progress",priority: "high",     dueDate: "2025-05-10", estimatedHours: "32", loggedHours: "10", visibility: "shared_with_client" },
  ]);
  console.log("[auto-seed] Inserted tasks");

  // ── Contracts ─────────────────────────────────────────────────────────────
  await db.insert(contractsTable).values([
    { name: "GlobalTrans OTM Cloud Migration — SOW",     contractNumber: "CTR-0001", projectId: projects[0].id, accountId: accounts[0].id, accountName: accounts[0].name, projectName: projects[0].name, billingModel: "time_and_materials", status: "active",   totalValue: "480000.00", remainingValue: "200000.00", invoicedValue: "280000.00", startDate: "2024-09-01", endDate: "2026-10-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "monthly",    slaConfig: { response_time: "4 hours", uptime: "99.5%", report_cadence: "weekly" },  billingMilestones: [{ name: "Integration Assessment", amount: 45000, triggerEvent: "milestone_complete", status: "completed" }, { name: "DEV Configuration", amount: 65000, triggerEvent: "milestone_complete", status: "completed" }, { name: "SIT", amount: 80000, triggerEvent: "milestone_complete", status: "pending" }, { name: "Go-Live", amount: 90000, triggerEvent: "go_live", status: "pending" }], assumptions: "All integrations within scope per SOW Appendix A. Change orders required for additional carrier integrations." },
    { name: "Apex Rate Engine — Fixed Fee SOW",          contractNumber: "CTR-0002", projectId: projects[1].id, accountId: accounts[1].id, accountName: accounts[1].name, projectName: projects[1].name, billingModel: "fixed_fee",         status: "active",   totalValue: "320000.00", remainingValue: "175000.00", invoicedValue: "145000.00", startDate: "2024-11-01", endDate: "2025-07-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "milestone",  assumptions: "Rate record count not to exceed 3,000 per SOW scope. Additional records subject to change order." },
    { name: "NorthStar AMS Retainer Agreement",          contractNumber: "CTR-0003", projectId: projects[2].id, accountId: accounts[2].id, accountName: accounts[2].name, projectName: projects[2].name, billingModel: "retainer",          status: "active",   totalValue: "210000.00", remainingValue: "97500.00",  invoicedValue: "112500.00", startDate: "2024-01-01", endDate: "2026-12-31", paymentTerms: "Net 15", currencyCode: "USD", billingCycle: "monthly",    slaConfig: { response_time: "2 hours", uptime: "99.9%", monthly_hours: 80 } },
    { name: "Pacific 23D Certification SOW",             contractNumber: "CTR-0004", projectId: projects[3].id, accountId: accounts[3].id, accountName: accounts[3].name, projectName: projects[3].name, billingModel: "time_and_materials", status: "active",   totalValue: "56000.00",  remainingValue: "28000.00",  invoicedValue: "28000.00",  startDate: "2025-03-01", endDate: "2026-10-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "milestone" },
    { name: "GlobalTrans Data Acceleration SOW",         contractNumber: "CTR-0005", projectId: projects[4].id, accountId: accounts[0].id, accountName: accounts[0].name, projectName: projects[4].name, billingModel: "time_and_materials", status: "on_hold",  totalValue: "95000.00",  remainingValue: "73000.00",  invoicedValue: "22000.00",  startDate: "2025-02-01", endDate: "2025-04-30", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "monthly",    notes: "On hold pending client IT resource availability." },
    { name: "BlueStar OTM Cloud Implementation — SOW",   contractNumber: "CTR-0006", projectId: projects[5].id, accountId: accounts[5].id, accountName: accounts[5].name, projectName: projects[5].name, billingModel: "time_and_materials", status: "active",   totalValue: "395000.00", remainingValue: "247000.00", invoicedValue: "148000.00", startDate: "2024-12-01", endDate: "2025-11-30", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "monthly",    slaConfig: { response_time: "4 hours", report_cadence: "bi-weekly" }, assumptions: "Scope limited to LTL carrier management and rate engine. International trade is out of scope." },
    { name: "Summit Freight AMS Agreement",              contractNumber: "CTR-0007", projectId: projects[6].id, accountId: accounts[6].id, accountName: accounts[6].name, projectName: projects[6].name, billingModel: "retainer",          status: "active",   totalValue: "155000.00", remainingValue: "25000.00",  invoicedValue: "130000.00", startDate: "2024-06-01", endDate: "2025-05-31", paymentTerms: "Net 15", currencyCode: "USD", billingCycle: "monthly",    slaConfig: { response_time: "4 hours", uptime: "99.5%", monthly_hours: 40 } },
    { name: "Apex EMEA Order Management SOW",            contractNumber: "CTR-0008", projectId: projects[7].id, accountId: accounts[1].id, accountName: accounts[1].name, projectName: projects[7].name, billingModel: "time_and_materials", status: "active",   totalValue: "215000.00", remainingValue: "180000.00", invoicedValue: "35000.00",  startDate: "2025-04-01", endDate: "2025-12-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "milestone" },
    { name: "GlobalTrans Integration Upgrade — SOW",     contractNumber: "CTR-0009", projectId: projects[8].id, accountId: accounts[0].id, accountName: accounts[0].name, projectName: projects[8].name, billingModel: "fixed_fee",         status: "draft",    totalValue: "175000.00", remainingValue: "175000.00", invoicedValue: "0.00",      startDate: "2025-06-01", endDate: "2025-12-31", paymentTerms: "Net 30", currencyCode: "USD", billingCycle: "milestone",  notes: "Pending legal review and signature." },
  ]);
  console.log("[auto-seed] Inserted contracts");

  // ── Rate Cards ─────────────────────────────────────────────────────────────
  await db.insert(rateCardsTable).values([
    { name: "Standard Rate Card 2025", role: "Senior OTM Consultant",    practiceArea: "OTM Core",        billingRate: "235.00", costRate: "110.00", effectiveDate: "2025-01-01", notes: "Senior-level OTM configuration and design" },
    { name: "Standard Rate Card 2025", role: "OTM Consultant",           practiceArea: "OTM Core",        billingRate: "185.00", costRate: "90.00",  effectiveDate: "2025-01-01", notes: "Mid-level OTM implementation" },
    { name: "Standard Rate Card 2025", role: "Junior OTM Analyst",       practiceArea: "OTM Core",        billingRate: "145.00", costRate: "70.00",  effectiveDate: "2025-01-01" },
    { name: "Standard Rate Card 2025", role: "Project Manager",          practiceArea: "Delivery",        billingRate: "195.00", costRate: "95.00",  effectiveDate: "2025-01-01" },
    { name: "Standard Rate Card 2025", role: "Solution Architect",       practiceArea: "Architecture",    billingRate: "265.00", costRate: "130.00", effectiveDate: "2025-01-01", notes: "Enterprise architecture and pre-sales" },
    { name: "Standard Rate Card 2025", role: "Integration Specialist",   practiceArea: "Integration",     billingRate: "215.00", costRate: "105.00", effectiveDate: "2025-01-01" },
    { name: "Standard Rate Card 2025", role: "QA Lead",                  practiceArea: "Testing",         billingRate: "175.00", costRate: "82.00",  effectiveDate: "2025-01-01" },
    { name: "Standard Rate Card 2025", role: "AMS Consultant",           practiceArea: "AMS",             billingRate: "165.00", costRate: "78.00",  effectiveDate: "2025-01-01", notes: "Post-go-live AMS support" },
    { name: "Standard Rate Card 2025", role: "Data Migration Specialist",practiceArea: "Data Migration",  billingRate: "190.00", costRate: "90.00",  effectiveDate: "2025-01-01" },
    { name: "Standard Rate Card 2025", role: "Cloud Architect",          practiceArea: "Cloud Migration", billingRate: "245.00", costRate: "120.00", effectiveDate: "2025-01-01", notes: "OTM SaaS cloud migration and OCI architecture" },
    { name: "Partner Blended Rate",    role: "Partner Resource",         practiceArea: "All",             billingRate: "125.00", costRate: "100.00", effectiveDate: "2025-01-01", notes: "Blended partner rate for subcontractors" },
  ]);
  console.log("[auto-seed] Inserted rate cards");

  // ── Opportunities ─────────────────────────────────────────────────────────
  await db.insert(opportunitiesTable).values([
    // Active Pipeline — Discovery
    {
      name: "NorthStar OTM Rate Module Upgrade", accountId: accounts[2].id, accountName: accounts[2].name,
      stage: "discovery", type: "implementation", value: "145000", probability: 35,
      expectedStartDate: "2025-09-01", expectedCloseDate: "2025-07-15", expectedDurationWeeks: 12,
      ownerId: sales2.id, ownerName: sales2.name, deliveryComplexity: "medium", staffingRisk: "low",
      summary: "Rate module enhancement to support expanded carrier network and dynamic fuel surcharge automation.",
      scopeSummary: "Add 400+ new carrier rates, automate fuel surcharge rules, integrate rate quoting API.",
      otmModules: ["Rate Management","Carrier Management"],
      requiredRoles: ["OTM Rate Specialist","Integration Developer"],
      stakeholders: [{ name: "Jean Rousseau", role: "Director of Logistics IT", email: "j.rousseau@northstarfreight.com" }],
      goNoGoStatus: "pending", marginFeasibility: true, capacityFeasibility: null, deliveryReadiness: null,
      notes: "Discovery call completed. Strong interest — depends on NorthStar budget approval in Q3.",
    },
    {
      name: "Harbor Logistics Reactivation", accountId: accounts[7].id, accountName: accounts[7].name,
      stage: "discovery", type: "ams", value: "120000", probability: 20,
      expectedStartDate: "2025-10-01", expectedCloseDate: "2025-08-31", expectedDurationWeeks: 52,
      ownerId: sales1.id, ownerName: sales1.name, deliveryComplexity: "low", staffingRisk: "low",
      summary: "Re-engage Harbor Logistics with a managed services retainer following their OTM go-live 18 months ago.",
      otmModules: ["AMS Support","Incident Management"],
      requiredRoles: ["AMS Consultant"],
      stakeholders: [{ name: "Lars Jensen", role: "IT Manager", email: "l.jensen@harborlogistics.eu" }],
      goNoGoStatus: "pending", marginFeasibility: true, capacityFeasibility: true, deliveryReadiness: null,
      notes: "Harbor went self-managed after go-live but is experiencing recurring incidents. Re-engagement opportunity.",
    },
    {
      name: "Meridian Managed Services Post Go-Live", accountId: accounts[4].id, accountName: accounts[4].name,
      stage: "discovery", type: "ams", value: "180000", probability: 30,
      expectedStartDate: "2026-01-01", expectedCloseDate: "2025-11-30", expectedDurationWeeks: 52,
      ownerId: sales1.id, ownerName: sales1.name, deliveryComplexity: "medium", staffingRisk: "low",
      summary: "Annual AMS retainer to follow Meridian's OTM Cloud implementation — if implementation closes.",
      otmModules: ["AMS Support","Release Management","Custom Development"],
      requiredRoles: ["AMS Lead","OTM Developer"],
      goNoGoStatus: "pending", marginFeasibility: true, capacityFeasibility: null, deliveryReadiness: null,
      notes: "Dependent on Meridian cloud implementation closing. Auto-qualify once Meridian deal is won.",
    },
    // Active Pipeline — Qualified
    {
      name: "Pacific Distribution Phase 2 — Order Management", accountId: accounts[3].id, accountName: accounts[3].name,
      stage: "qualified", type: "implementation", value: "220000", probability: 55,
      expectedStartDate: "2025-10-01", expectedCloseDate: "2025-08-15", expectedDurationWeeks: 20,
      ownerId: sales2.id, ownerName: sales2.name, deliveryComplexity: "high", staffingRisk: "medium",
      summary: "Phase 2 OTM implementation covering Shipment Management and Order Management modules for APAC operations.",
      scopeSummary: "Implement Shipment Execution, Order Management, and Visibility modules. Integrate with SAP S/4HANA.",
      otmModules: ["Shipment Management","Order Management","Visibility"],
      requiredRoles: ["Solution Architect","Integration Specialist","Functional Consultant","QA Lead"],
      stakeholders: [{ name: "Wei Zhang", role: "VP IT", email: "w.zhang@pacificdist.com" }, { name: "Sarah Kim", role: "Logistics Director", email: "s.kim@pacificdist.com" }],
      risks: [{ description: "SAP integration complexity may extend timeline", severity: "medium" }],
      goNoGoStatus: "pending", marginFeasibility: true, capacityFeasibility: null, deliveryReadiness: null,
      notes: "Scoping workshop completed. Client evaluating 2 competing vendors. Decision expected August.",
    },
    {
      name: "Summit Freight AMS Expansion — Custom Development", accountId: accounts[6].id, accountName: accounts[6].name,
      stage: "qualified", type: "implementation", value: "95000", probability: 50,
      expectedStartDate: "2025-08-01", expectedCloseDate: "2025-07-01", expectedDurationWeeks: 16,
      ownerId: sales1.id, ownerName: sales1.name, deliveryComplexity: "medium", staffingRisk: "medium",
      summary: "Expand current AMS retainer to include custom OTM reporting and rate optimization automation.",
      scopeSummary: "Build 5 custom Power BI reports, automate rate update workflows, enhance carrier scorecard module.",
      otmModules: ["Custom Development","Rate Management","Analytics"],
      requiredRoles: ["OTM Developer","Rate Analyst"],
      goNoGoStatus: "approved", marginFeasibility: true, capacityFeasibility: true, deliveryReadiness: null,
      notes: "Current AMS contract expires July 31. Expansion scope agreed in principle, SOW in drafting.",
    },
    {
      name: "National Foods Corp — New Logo OTM Implementation", accountId: accounts[4].id, accountName: accounts[4].name,
      stage: "qualified", type: "implementation", value: "380000", probability: 40,
      expectedStartDate: "2025-10-15", expectedCloseDate: "2025-09-01", expectedDurationWeeks: 28,
      ownerId: sales2.id, ownerName: sales2.name, deliveryComplexity: "high", staffingRisk: "high",
      summary: "New-logo pursuit: $12B CPG company standardizing on OTM across 4 North American DCs.",
      scopeSummary: "Full OTM SaaS implementation including Rate Management, Shipment Execution, Order Management, and carrier integration (40+ carriers).",
      otmModules: ["Rate Management","Shipment Management","Order Management","Carrier Management"],
      requiredRoles: ["Solution Architect","Cloud Architect","Integration Specialist","Functional Consultant x2","QA Lead","Project Manager"],
      staffingDemandSummary: "Requires 2 senior OTM consultants, 1 cloud architect, 1 integration specialist, 1 PM. Bench capacity needed by Q3.",
      stakeholders: [{ name: "Tom Hargreaves", role: "CIO", email: "t.hargreaves@nationalfoods.com" }, { name: "Pam Wu", role: "VP Supply Chain", email: "p.wu@nationalfoods.com" }],
      risks: [{ description: "Competing against Oracle Consulting Services directly", severity: "high" }, { description: "Resource availability risk for Q3 start", severity: "medium" }],
      goNoGoStatus: "approved", marginFeasibility: true, capacityFeasibility: null, deliveryReadiness: true,
      notes: "RFP due September 1. High-priority pursue — largest new-logo opportunity this year.",
    },
    // Active Pipeline — Proposal
    {
      name: "Meridian Carriers OTM Cloud Implementation", accountId: accounts[4].id, accountName: accounts[4].name,
      stage: "proposal", type: "cloud_migration", value: "540000", probability: 70,
      expectedStartDate: "2025-07-01", expectedCloseDate: "2025-05-31", expectedDurationWeeks: 32,
      ownerId: sales1.id, ownerName: sales1.name, deliveryComplexity: "high", staffingRisk: "high",
      staffingDemandSummary: "Need 2 cloud architects, 1 OTM rate engine specialist, 1 integration developer, 1 PM.",
      summary: "Full OTM Cloud migration from on-prem 23C to Oracle Cloud Infrastructure for 38-carrier network.",
      scopeSummary: "Migrate OTM 23C to Oracle Cloud. Replatform custom integrations to OCI APIs. Migrate 5 years of shipment history.",
      otmModules: ["Rate Management","Carrier Management","Order Management","OCI Integration"],
      requiredRoles: ["Cloud Architect","OTM Rate Specialist","Integration Developer","Project Manager","QA Analyst"],
      stakeholders: [{ name: "David Holt", role: "IT Director", email: "d.holt@meridian.com" }, { name: "Lisa Park", role: "VP Carrier Operations", email: "l.park@meridian.com" }],
      risks: [{ description: "Legacy EDI integrations may require custom re-engineering", severity: "high" }, { description: "Data migration complexity — 5 years of historical shipments", severity: "medium" }],
      goNoGoStatus: "approved", marginFeasibility: true, capacityFeasibility: true, deliveryReadiness: true,
      notes: "SOW submitted. Decision expected by May 31. Best deal in Q2 pipeline.",
    },
    {
      name: "BlueStar Integration Upgrade — REST API Modernization", accountId: accounts[5].id, accountName: accounts[5].name,
      stage: "proposal", type: "implementation", value: "180000", probability: 65,
      expectedStartDate: "2025-09-01", expectedCloseDate: "2025-07-31", expectedDurationWeeks: 14,
      ownerId: sales2.id, ownerName: sales2.name, deliveryComplexity: "medium", staffingRisk: "low",
      summary: "Upgrade BlueStar's OTM integrations from EDI X12 to modern REST APIs post cloud migration.",
      scopeSummary: "Decommission legacy EDI 204/990/214 and replace with REST API carrier connectivity for 12 carriers.",
      otmModules: ["Integration","Carrier Management"],
      requiredRoles: ["Integration Specialist","OTM Developer"],
      goNoGoStatus: "approved", marginFeasibility: true, capacityFeasibility: true, deliveryReadiness: true,
      notes: "Natural upsell from BlueStar cloud implementation. Client budget pre-approved.",
    },
    // Active Pipeline — Negotiation
    {
      name: "Apex Logistics AMS Renewal + EMEA Expansion", accountId: accounts[1].id, accountName: accounts[1].name,
      stage: "negotiation", type: "ams", value: "280000", probability: 85,
      expectedStartDate: "2025-09-01", expectedCloseDate: "2025-06-30", expectedDurationWeeks: 52,
      ownerId: sales1.id, ownerName: sales1.name, deliveryComplexity: "medium", staffingRisk: "low",
      summary: "Annual AMS contract renewal with 40% scope expansion to cover EMEA operations and new Order Management module.",
      otmModules: ["AMS Support","Custom Development","Release Management","Order Management"],
      requiredRoles: ["AMS Lead","Senior Technical Consultant","OTM Developer"],
      goNoGoStatus: "approved", marginFeasibility: true, capacityFeasibility: true, deliveryReadiness: true,
      notes: "Contract terms agreed. Legal review in progress. Expected to close by June 30.",
    },
    {
      name: "Apex Additional Rate Engine Modules", accountId: accounts[1].id, accountName: accounts[1].name,
      stage: "negotiation", type: "implementation", value: "175000", probability: 80,
      expectedStartDate: "2025-08-01", expectedCloseDate: "2025-07-15", expectedDurationWeeks: 16,
      ownerId: sales1.id, ownerName: sales1.name, deliveryComplexity: "medium", staffingRisk: "medium",
      summary: "Expand Apex rate engine to include spot quoting, dynamic surcharges, and carrier scorecard automation.",
      otmModules: ["Rate Management","Analytics","Carrier Management"],
      requiredRoles: ["OTM Rate Specialist","Functional Consultant","QA Analyst"],
      goNoGoStatus: "approved", marginFeasibility: true, capacityFeasibility: true, deliveryReadiness: true,
      notes: "Closely linked to current rate engine project. Apex team pushing to close before existing project ends.",
    },
    // Won
    {
      name: "GlobalTrans OTM Cloud Migration (Won — Closed)",  accountId: accounts[0].id, accountName: accounts[0].name,
      stage: "won", type: "cloud_migration", value: "480000", probability: 100,
      expectedStartDate: "2024-09-01", expectedCloseDate: "2024-08-15", expectedDurationWeeks: 56,
      ownerId: sales1.id, ownerName: sales1.name, deliveryComplexity: "high", staffingRisk: "high",
      summary: "Won — Project active. Full OTM Cloud migration for GlobalTrans Corp.",
      goNoGoStatus: "approved", marginFeasibility: true, capacityFeasibility: true, deliveryReadiness: true,
      notes: "Project started September 2024. On track for May 2025 go-live.",
    },
    {
      name: "NorthStar AMS Retainer (Won — Closed)", accountId: accounts[2].id, accountName: accounts[2].name,
      stage: "won", type: "ams", value: "210000", probability: 100,
      expectedStartDate: "2024-01-01", expectedCloseDate: "2023-12-15", expectedDurationWeeks: 104,
      ownerId: sales2.id, ownerName: sales2.name, deliveryComplexity: "low", staffingRisk: "low",
      summary: "Won — Project active. Two-year AMS retainer for NorthStar Freight.",
      goNoGoStatus: "approved", marginFeasibility: true, capacityFeasibility: true, deliveryReadiness: true,
      notes: "Renewing in Q4 2025. Upsell opportunity in pipeline.",
    },
    {
      name: "BlueStar Transport OTM Implementation (Won — Closed)", accountId: accounts[5].id, accountName: accounts[5].name,
      stage: "won", type: "cloud_migration", value: "395000", probability: 100,
      expectedStartDate: "2024-12-01", expectedCloseDate: "2024-11-15", expectedDurationWeeks: 52,
      ownerId: sales2.id, ownerName: sales2.name, deliveryComplexity: "high", staffingRisk: "medium",
      summary: "Won — Project active. Full OTM SaaS implementation for BlueStar Transport.",
      goNoGoStatus: "approved", marginFeasibility: true, capacityFeasibility: true, deliveryReadiness: true,
      notes: "Project started December 2024. Go-live targeting August 2025.",
    },
    // Lost
    {
      name: "ClearPath Logistics — OTM Cloud Implementation (Lost)", accountId: accounts[4].id, accountName: accounts[4].name,
      stage: "lost", type: "cloud_migration", value: "290000", probability: 0,
      expectedStartDate: null, expectedCloseDate: "2025-02-28", expectedDurationWeeks: 24,
      ownerId: sales2.id, ownerName: sales2.name, deliveryComplexity: "medium", staffingRisk: "medium",
      summary: "Lost to Oracle Consulting Services — competitive pricing advantage and existing Oracle relationship.",
      otmModules: ["Rate Management","Carrier Management","Shipment Management"],
      notes: "Lost on price. Oracle CS came in 18% lower. Lesson: need faster RFP response for competitive deals.",
    },
  ]);
  console.log("[auto-seed] Inserted opportunities");

  // ── Change Requests ────────────────────────────────────────────────────────
  await db.insert(changeRequestsTable).values([
    { projectId: projects[0].id, projectName: projects[0].name, changeOrderNumber: "CR-001", title: "Additional Carrier Portal Integration — FedEx", description: "Client requests custom FedEx portal integration not covered in original SOW.", category: "extra_integration", requestedByName: "GlobalTrans IT Director", status: "approved", priority: "high", impactHours: "120", impactCost: "28000.00", impactWeeks: 3, internalApproverName: director.name, internalApprovedAt: "2025-02-15", clientApproverName: clientStk1.name, clientApprovedAt: "2025-02-20", submittedDate: "2025-02-10", approvedDate: "2025-02-20", deliveredBeforeApproval: false },
    { projectId: projects[0].id, projectName: projects[0].name, changeOrderNumber: "CR-003", title: "Scope Reduction — Remove Data Archival Module", description: "Client de-scoped the data archival module due to budget constraints.", category: "scope_reduction", requestedByName: "GlobalTrans CIO", status: "approved", priority: "low", impactHours: "-160", impactCost: "-32000.00", impactWeeks: -2, internalApproverName: fin1.name, internalApprovedAt: "2025-01-20", clientApproverName: clientStk1.name, clientApprovedAt: "2025-01-25", submittedDate: "2025-01-15", approvedDate: "2025-01-25", deliveredBeforeApproval: false },
    { projectId: projects[1].id, projectName: projects[1].name, changeOrderNumber: "CR-002", title: "Custom Executive Dashboard Reports", description: "Client requests 3 custom Power BI reports using OTM data.", category: "new_requirement", requestedByName: "Apex VP Operations", status: "pending_client", priority: "medium", impactHours: "80", impactCost: "18500.00", impactWeeks: 2, internalApproverName: director.name, internalApprovedAt: "2025-03-10", submittedDate: "2025-03-05", deliveredBeforeApproval: false },
    { projectId: projects[1].id, projectName: projects[1].name, changeOrderNumber: "CR-004", title: "Additional EMEA Carrier Rate Records (+800 records)", description: "Original SOW capped at 3,000 rate records. Client now requires 3,800 for expanded EMEA network.", category: "scope_expansion", requestedByName: clientStk2.name, status: "pending_internal", priority: "high", impactHours: "96", impactCost: "21500.00", impactWeeks: 2, submittedDate: "2025-04-01", deliveredBeforeApproval: false },
    { projectId: projects[5].id, projectName: projects[5].name, changeOrderNumber: "CR-005", title: "Add UPS Ground Carrier Integration", description: "Client requests UPS Ground REST API integration as part of carrier connectivity scope.", category: "extra_integration", requestedByName: "BlueStar VP Technology", status: "approved", priority: "medium", impactHours: "40", impactCost: "9200.00", impactWeeks: 1, internalApproverName: director.name, internalApprovedAt: "2025-03-20", clientApproverName: "BlueStar VP Technology", clientApprovedAt: "2025-03-25", submittedDate: "2025-03-15", approvedDate: "2025-03-25", deliveredBeforeApproval: false },
    { projectId: projects[5].id, projectName: projects[5].name, changeOrderNumber: "CR-006", title: "Expedited UAT Timeline — 3-Week Compression", description: "Client requests UAT compressed from 5 weeks to 3 weeks to meet Q3 board presentation deadline.", category: "timeline_change", requestedByName: "BlueStar CIO", status: "pending_client", priority: "high", impactHours: "40", impactCost: "8500.00", impactWeeks: -2, internalApproverName: pm3.name, internalApprovedAt: "2025-04-05", submittedDate: "2025-04-02", deliveredBeforeApproval: false },
    { projectId: projects[2].id, projectName: projects[2].name, changeOrderNumber: "CR-007", title: "Add Custom OTM Rate Optimization Script", description: "NorthStar requests a Groovy-based rate optimization script delivered as part of AMS scope.", category: "new_requirement", requestedByName: "NorthStar IT Lead", status: "rejected", priority: "low", impactHours: "60", impactCost: "12000.00", impactWeeks: 0, internalApproverName: director.name, internalApprovedAt: "2025-03-01", submittedDate: "2025-02-20", deliveredBeforeApproval: false, notes: "Rejected — out of AMS retainer scope. Referred to NorthStar Rate Upgrade opportunity." },
  ]);
  console.log("[auto-seed] Inserted change requests");

  // ── Notifications ─────────────────────────────────────────────────────────
  await db.insert(notificationsTable).values([
    { userId: pm2.id,      title: "Milestone Overdue",          message: "Rate Engine Design milestone is overdue on Apex OTM Rate Engine project",         type: "milestone_overdue",        priority: "action", entityType: "milestone", entityId: milestones[5].id,  read: false },
    { userId: fin1.id,     title: "Invoice Overdue",            message: "INV-0005 ($85,000) from Apex Logistics is overdue by 28 days",                    type: "invoice_overdue",          priority: "action", entityType: "invoice",   entityId: null,              read: false },
    { userId: fin1.id,     title: "Invoice Overdue",            message: "INV-0009 ($38,500) from Summit Freight Partners is overdue by 14 days",           type: "invoice_overdue",          priority: "action", entityType: "invoice",   entityId: null,              read: false },
    { userId: director.id, title: "Project At Risk",            message: "Apex OTM Rate Engine Implementation health dropped to 55 — action required",      type: "project_at_risk",          priority: "action", entityType: "project",   entityId: projects[1].id,    read: false },
    { userId: pm1.id,      title: "Change Order Approved",      message: "CR-001 approved by GlobalTrans — FedEx Portal Integration ($28K added to scope)", type: "change_request_approved",  priority: "fyi",    entityType: "project",   entityId: projects[0].id,    read: true  },
    { userId: pm3.id,      title: "Change Order Approved",      message: "CR-005 approved — UPS Ground Integration added to BlueStar scope (+$9.2K)",       type: "change_request_approved",  priority: "fyi",    entityType: "project",   entityId: projects[5].id,    read: true  },
    { userId: rm1.id,      title: "Timesheets Pending Approval",message: "11 timesheets submitted for week of March 24 — awaiting approval",                type: "timesheet_submitted",      priority: "action", entityType: null,        entityId: null,              read: false },
    { userId: rm1.id,      title: "Open Staffing Request",      message: "Senior QA Analyst needed for Apex Rate Engine starting April 1 — unfilled",       type: "staffing_request",         priority: "action", entityType: null,        entityId: null,              read: false },
    { userId: pm1.id,      title: "Milestone Overdue",          message: "Pacific 23D Test Plan Finalized is 3+ weeks overdue — blocks certification",       type: "milestone_overdue",        priority: "action", entityType: "milestone", entityId: milestones[9].id,  read: false },
    { userId: director.id, title: "Project Health Improved",    message: "BlueStar OTM Implementation health improved to 82 — on track for August go-live", type: "project_health_improved",  priority: "fyi",    entityType: "project",   entityId: projects[5].id,    read: true  },
    { userId: sales1.id,   title: "Opportunity Stage Change",   message: "Meridian Carriers moved to Proposal stage — $540K deal, decision expected May 31", type: "opportunity_stage_change", priority: "fyi",    entityType: "account",   entityId: accounts[4].id,    read: false },
    { userId: am1.id,      title: "Renewal Signal",             message: "GlobalTrans contract renewal due June 30 — 90-day window to initiate conversation",type: "renewal_signal",           priority: "action", entityType: "account",   entityId: accounts[0].id,    read: false },
  ]);
  console.log("[auto-seed] Inserted notifications");

  // ── Forms ─────────────────────────────────────────────────────────────────
  await db.insert(formsTable).values([
    { name: "Project Kickoff Checklist",      type: "kickoff",       description: "Checklist to confirm all kickoff pre-requisites are met before project start.", fields: [{ id: "f1", label: "SOW signed", type: "checkbox" }, { id: "f2", label: "Access credentials provided", type: "checkbox" }, { id: "f3", label: "Kickoff meeting scheduled", type: "checkbox" }, { id: "f4", label: "RAID log initialized", type: "checkbox" }, { id: "f5", label: "Team introductions completed", type: "checkbox" }], status: "active" },
    { name: "Go-Live Readiness Assessment",   type: "go_live",       description: "Assessment form to confirm go-live criteria before production cutover.", fields: [{ id: "f1", label: "All UAT sign-offs complete", type: "checkbox" }, { id: "f2", label: "Hypercare team confirmed", type: "checkbox" }, { id: "f3", label: "Rollback plan approved", type: "checkbox" }, { id: "f4", label: "Go-live date confirmed with client", type: "checkbox" }, { id: "f5", label: "Training completed", type: "checkbox" }, { id: "f6", label: "Data migration validated", type: "checkbox" }], status: "active" },
    { name: "Project Closure Sign-Off",       type: "closure",       description: "Final sign-off form for project closure and knowledge transfer completion.", fields: [{ id: "f1", label: "All deliverables accepted by client", type: "checkbox" }, { id: "f2", label: "Final invoice issued", type: "checkbox" }, { id: "f3", label: "Knowledge transfer completed", type: "checkbox" }, { id: "f4", label: "Lessons learned documented", type: "checkbox" }, { id: "f5", label: "AMS handover completed", type: "checkbox" }], status: "active" },
    { name: "Weekly Status Report Template",  type: "status_report", description: "Standard weekly project status report submitted by PM.", fields: [{ id: "f1", label: "Overall RAG status", type: "select", options: ["Green", "Amber", "Red"] }, { id: "f2", label: "Key accomplishments this week", type: "textarea" }, { id: "f3", label: "Key risks or issues", type: "textarea" }, { id: "f4", label: "Planned activities next week", type: "textarea" }, { id: "f5", label: "Budget consumption to date (%)", type: "number" }], status: "active" },
    { name: "Opportunity Scoping Template",   type: "scoping",       description: "Pre-sales scoping template to capture opportunity requirements for proposal.", fields: [{ id: "f1", label: "OTM modules in scope", type: "textarea" }, { id: "f2", label: "Number of carriers", type: "number" }, { id: "f3", label: "Cloud or on-prem?", type: "select", options: ["Cloud (OCI)","On-Premise","Hybrid"] }, { id: "f4", label: "Estimated go-live date", type: "date" }, { id: "f5", label: "Key risks identified", type: "textarea" }], status: "active" },
  ]);
  console.log("[auto-seed] Inserted forms");

  // ── Automations ────────────────────────────────────────────────────────────
  await db.insert(automationsTable).values([
    { name: "Auto-Create Project from Won Opportunity",    trigger: "opportunity_won",              description: "When an opportunity is marked as Won, automatically creates a draft project and notifies the delivery team.", conditions: { stageName: "Closed Won" }, actions: [{ type: "create_project", params: { status: "planning" } }, { type: "notify_team", params: { team: "delivery" } }], enabled: true,  runCount: 14, lastRunAt: "2026-03-28" },
    { name: "Soft Allocation on Opportunity Threshold",    trigger: "opportunity_threshold_reached",description: "When an opportunity reaches 60%+ probability, create soft resource allocations to plan ahead.", conditions: { minProbability: "60" }, actions: [{ type: "create_soft_allocations", params: { durationWeeks: "8" } }], enabled: true,  runCount: 11, lastRunAt: "2026-04-01" },
    { name: "Client Approval Reminder",                    trigger: "client_approval_pending",      description: "When a change request has been awaiting client approval for more than 5 days, send a reminder.", conditions: { daysOverdue: "5" }, actions: [{ type: "send_reminder_email", params: { template: "client_approval_pending" } }], enabled: true,  runCount: 22, lastRunAt: "2026-04-02" },
    { name: "PM Alert on Task Overdue",                    trigger: "task_overdue",                 description: "When any task goes overdue by more than 2 days, alert the project manager and assignee.", conditions: { daysOverdue: "2" }, actions: [{ type: "notify_user", params: { role: "pm" } }], enabled: true,  runCount: 53, lastRunAt: "2026-04-04" },
    { name: "Budget Sync on Change Order Approval",        trigger: "approved_change",              description: "When a change order is approved, update project budget, timeline, and notify finance.", conditions: {}, actions: [{ type: "update_project_budget", params: {} }, { type: "notify_finance", params: {} }], enabled: true,  runCount: 28, lastRunAt: "2026-04-03" },
    { name: "Invoice Overdue Escalation",                  trigger: "invoice_overdue",              description: "When an invoice is 15+ days overdue, escalate to finance lead and account manager.", conditions: { daysOverdue: "15" }, actions: [{ type: "notify_user", params: { role: "finance_lead" } }, { type: "notify_user", params: { role: "account_manager" } }], enabled: true,  runCount: 9,  lastRunAt: "2026-03-31" },
    { name: "Monthly AMS Timesheet Reminder",              trigger: "end_of_month",                 description: "On the last day of each month, remind all AMS consultants to submit timesheets.", conditions: { projectType: "ams" }, actions: [{ type: "send_reminder_email", params: { template: "timesheet_reminder" } }], enabled: true,  runCount: 15, lastRunAt: "2026-03-31" },
    { name: "Renewal Signal Auto-Create",                  trigger: "contract_renewal_approaching", description: "90 days before contract end date, automatically create a renewal signal and assign to account manager.", conditions: { daysBeforeRenewal: "90" }, actions: [{ type: "create_renewal_signal", params: { priority: "high" } }], enabled: true,  runCount: 6,  lastRunAt: "2026-03-15" },
    { name: "Resource Over-Allocation Alert",              trigger: "allocation_threshold",         description: "When any resource exceeds 100% allocation, alert resource manager within 24 hours.", conditions: { threshold: "100" }, actions: [{ type: "notify_user", params: { role: "resource_manager" } }], enabled: false, runCount: 4,  lastRunAt: "2026-02-28" },
  ]);
  console.log("[auto-seed] Inserted automations");

  // ── Renewal Signals ────────────────────────────────────────────────────────
  await db.insert(renewalSignalsTable).values([
    { accountId: accounts[0].id, accountName: accounts[0].name, signalType: "renewal_approaching", description: "GlobalTrans contract renewal due June 30, 2025. Cloud migration completing — position for expanded AMS retainer.",    dueDate: "2025-04-30", estimatedValue: "520000", status: "open",        priority: "high",     assignedTo: am1.name },
    { accountId: accounts[1].id, accountName: accounts[1].name, signalType: "health_decline",       description: "Apex account health dropped to 58. At-risk project and overdue invoice ($85K) may jeopardize renewal.",             dueDate: "2025-05-15", estimatedValue: "320000", status: "open",        priority: "critical", assignedTo: director.name },
    { accountId: accounts[2].id, accountName: accounts[2].name, signalType: "upsell_opportunity",   description: "NorthStar expressed interest in expanding AMS to include custom rate optimization development.",                      dueDate: "2025-06-01", estimatedValue: "85000",  status: "in_progress", priority: "medium",   assignedTo: am1.name },
    { accountId: accounts[3].id, accountName: accounts[3].name, signalType: "renewal_approaching",  description: "Pacific Distribution contract renewal due September 30, 2025. Phase 2 opportunity in pipeline.",                     dueDate: "2025-07-01", estimatedValue: "175000", status: "open",        priority: "medium",   assignedTo: am2.name },
    { accountId: accounts[5].id, accountName: accounts[5].name, signalType: "upsell_opportunity",   description: "BlueStar integration upgrade SOW in proposal stage ($180K). Close timing to coincide with cloud go-live.",          dueDate: "2025-07-31", estimatedValue: "180000", status: "in_progress", priority: "high",     assignedTo: am2.name },
    { accountId: accounts[6].id, accountName: accounts[6].name, signalType: "renewal_approaching",  description: "Summit AMS contract expires July 31, 2025. Health score at 61 — risk of non-renewal without issue resolution.",     dueDate: "2025-06-01", estimatedValue: "155000", status: "open",        priority: "high",     assignedTo: sales1.name },
    { accountId: accounts[7].id, accountName: accounts[7].name, signalType: "win_back",             description: "Harbor Logistics went self-managed 18 months ago but is experiencing recurring OTM incidents. Re-engagement opportunity.", dueDate: "2025-08-01", estimatedValue: "120000", status: "open",    priority: "low",      assignedTo: sales2.name },
  ]);
  console.log("[auto-seed] Inserted renewal signals");

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

  // ── Staffing Requests ──────────────────────────────────────────────────────
  await db.insert(staffingRequestsTable).values([
    { projectId: projects[0].id, projectName: projects[0].name, requestedRole: "Cloud Architect",       requiredSkills: ["OTM SaaS","OCI","Integration Re-platforming"], startDate: "2025-03-01", endDate: "2025-06-30", hoursPerWeek: "20", allocationPct: 50, priority: "high",   status: "partially_filled", requestedByName: pm1.name, fulfilledByResourceId: resources[5].id, fulfilledByResourceName: resources[5].name },
    { projectId: projects[1].id, projectName: projects[1].name, requestedRole: "Senior QA Analyst",    requiredSkills: ["OTM Testing","Rate Engine Validation"],          startDate: "2025-04-01", endDate: "2025-07-31", hoursPerWeek: "10", allocationPct: 25, priority: "medium", status: "open",             requestedByName: pm2.name },
    { projectId: projects[4].id, projectName: projects[4].name, requestedRole: "ETL Developer",        requiredSkills: ["Python","OTM Data Accelerator","SQL"],           startDate: "2025-02-01", endDate: "2025-04-30", hoursPerWeek: "16", allocationPct: 40, priority: "medium", status: "filled",           requestedByName: pm2.name, fulfilledByResourceId: resources[4].id, fulfilledByResourceName: resources[4].name },
    { projectId: projects[5].id, projectName: projects[5].name, requestedRole: "OTM Functional Consultant", requiredSkills: ["OTM Configuration","Functional Design"],   startDate: "2025-05-01", endDate: "2025-08-30", hoursPerWeek: "32", allocationPct: 80, priority: "high",   status: "open",             requestedByName: pm3.name },
    { projectId: projects[7].id, projectName: projects[7].name, requestedRole: "Integration Specialist",requiredSkills: ["OIC","REST APIs","OTM Integration"],            startDate: "2025-07-01", endDate: "2025-12-31", hoursPerWeek: "20", allocationPct: 50, priority: "medium", status: "open",             requestedByName: pm1.name },
    { projectId: projects[8].id, projectName: projects[8].name, requestedRole: "Project Manager",      requiredSkills: ["OTM Delivery","PMP"],                           startDate: "2025-06-01", endDate: "2025-12-31", hoursPerWeek: "32", allocationPct: 80, priority: "high",   status: "open",             requestedByName: director.name },
  ]);
  console.log("[auto-seed] Inserted staffing requests");

  // ── Templates ──────────────────────────────────────────────────────────────
  await db.insert(templatesTable).values([
    { name: "OTM Cloud Migration",  type: "project", description: "Standard project template for full OTM SaaS cloud migration engagements.", phases: [{ name: "Discovery & Blueprint", durationWeeks: 8, tasks: ["Current-State Assessment","Architecture Design","Data Migration Plan","Integration Inventory"] }, { name: "Build & Configure", durationWeeks: 12, tasks: ["Environment Setup","OTM Configuration","Integration Build","Data Migration","Rate Entry"] }, { name: "Test & Validate", durationWeeks: 6, tasks: ["SIT Execution","UAT Preparation","UAT Execution","Defect Resolution"] }, { name: "Deploy & Go-Live", durationWeeks: 4, tasks: ["Go-Live Runbook","Cutover","Hypercare","Project Close"] }], conditions: [] },
    { name: "AMS Retainer",         type: "project", description: "Ongoing AMS engagement template with monthly deliverable cycle.", phases: [{ name: "Onboarding", durationWeeks: 4, tasks: ["SLA Finalization","Ticketing System Setup","Knowledge Transfer","Run Book Creation"] }, { name: "Steady State", durationWeeks: 52, tasks: ["Monthly Certification","Incident Management","Enhancement Delivery","Monthly Reporting"] }], conditions: [] },
    { name: "OTM Certification",    type: "project", description: "Quarterly OTM release certification template.", phases: [{ name: "Test Planning", durationWeeks: 2, tasks: ["Scope Definition","Test Plan Authoring","Environment Prep"] }, { name: "Test Execution", durationWeeks: 4, tasks: ["Regression Suite Execution","Defect Logging","Client Communication","Sign-Off"] }], conditions: [] },
    { name: "Rate Engine Implementation", type: "project", description: "Specialized template for OTM rate engine and carrier management implementations.", phases: [{ name: "Rate Discovery", durationWeeks: 6, tasks: ["Carrier Rate Analysis","Rate Type Mapping","Surcharge Design"] }, { name: "Configuration", durationWeeks: 8, tasks: ["Rate Record Entry","Validation Testing","Client Review"] }, { name: "Go-Live", durationWeeks: 2, tasks: ["Production Rate Load","Parallel Testing","Sign-Off"] }], conditions: [] },
  ]);
  console.log("[auto-seed] Inserted templates");

  console.log("[auto-seed] ✅ Full demo database seeded successfully.");
}

/**
 * Runs at every server startup.
 * Detects when the demo DB has mostly-expired allocation dates (e.g. after the
 * app has been live for a year without re-seeding) and extends them to a
 * rolling 18-month window so the utilization heatmap always shows live data.
 * Also syncs the `currentUtilization` stored on each resource to match actual
 * active hard allocations.
 */
export async function autoFixExpiredAllocations() {
  const today = new Date().toISOString().split("T")[0]!;

  const allAllocs = await db.select().from(allocationsTable);
  if (allAllocs.length === 0) return;

  const hardAllocs = allAllocs.filter(a => a.allocationType !== "soft");
  const expiredHard = hardAllocs.filter(a => a.endDate && a.endDate < today);

  const expiredFraction = expiredHard.length / Math.max(hardAllocs.length, 1);
  if (expiredFraction < 0.5) {
    console.log("[auto-fix] Allocations look current — skipping extension.");
    return;
  }

  // Extend everything by 18 months from today
  const extended = new Date();
  extended.setMonth(extended.getMonth() + 18);
  const newEnd = extended.toISOString().split("T")[0]!;

  console.log(`[auto-fix] ${expiredHard.length}/${hardAllocs.length} hard allocations expired — extending to ${newEnd}`);

  for (const a of allAllocs) {
    if (a.endDate && a.endDate < today) {
      await db.update(allocationsTable)
        .set({ endDate: newEnd })
        .where(eq(allocationsTable.id, a.id));
    }
  }

  // Recalculate currentUtilization for every resource from active hard allocs
  const updatedAllocs = await db.select().from(allocationsTable);
  const resources = await db.select().from(resourcesTable);

  for (const r of resources) {
    const active = updatedAllocs.filter(a =>
      a.resourceId === r.id &&
      a.allocationType !== "soft" &&
      (!a.endDate   || a.endDate   >= today) &&
      (!a.startDate || a.startDate <= today)
    );
    const total = active.reduce((s, a) => s + (a.allocationPct ?? 0), 0);
    if (total !== r.currentUtilization) {
      const status =
        total === 0 ? "bench" :
        total < 60  ? "available" :
        total <= 100 ? "allocated" :
        "over_allocated";
      await db.update(resourcesTable)
        .set({ currentUtilization: total, status })
        .where(eq(resourcesTable.id, r.id));
    }
  }

  console.log("[auto-fix] ✅ Allocation dates extended and utilization synced.");
}
