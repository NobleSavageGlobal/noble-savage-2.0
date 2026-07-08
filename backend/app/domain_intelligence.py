from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
import re
from typing import Any

DOMAIN_MODES = {
    "general": "General Chief-of-Staff",
    "credit": "Credit Counsel (FCRA/FDCPA/ECOA)",
    "tax": "Tax Strategist (IRC/Treasury/IRS)",
    "accounting": "Accounting (GAAP/ASC)",
    "budget": "Budget Coach",
    "life_plan": "Integrated Life Planner",
}

DOMAIN_AUTHORITIES: dict[str, list[str]] = {
    "credit": [
        "FCRA, 15 U.S.C. 1681 et seq.",
        "FDCPA, 15 U.S.C. 1692 et seq.",
        "ECOA, 15 U.S.C. 1691 et seq.",
        "TILA/Reg Z, 15 U.S.C. 1601 et seq.",
        "CROA, 15 U.S.C. 1679 et seq.",
    ],
    "tax": [
        "Internal Revenue Code (IRC), Title 26",
        "Treasury Regulations",
        "IRS forms and notice guidance",
        "IRC 6330 collection due process timelines",
    ],
    "accounting": [
        "FASB ASC 606 revenue recognition",
        "FASB ASC 842 leases",
        "FASB ASC 740 income taxes",
        "FASB ASC 326 CECL",
        "FASB ASC 805/810 business combinations/consolidation",
        "FASB ASC 820 fair value",
        "FASB ASC 350/360 impairment",
    ],
    "budget": [
        "50/30/20 budgeting method",
        "Zero-based budgeting",
        "Debt avalanche/snowball sequencing",
        "Cash-flow ratio analysis",
    ],
    "life_plan": [
        "Integrated planning synthesis across cash flow, tax, credit, risk, goals",
        "90-day execution planning with owner + due date",
    ],
}

ORCHESTRATOR_DOMAIN_UPGRADE_BLOCK = """
DOMAIN EXPERTISE (extend the existing lenses; cite authority or mark [UNVERIFIED]):

You reason as a credentialed team across the operator's real domains. On any
question touching law, tax, accounting, or credit you cite the exact authority
(e.g. 15 U.S.C. 1681i, IRC 6330, FASB ASC 606) or you mark the claim [UNVERIFIED]
and route to a licensed professional. You never invent a statute, section,
ASC topic, form number, dollar limit, or deadline. If a figure depends on the
tax year, name the year and say to confirm it.

- CREDIT COUNSEL: FCRA/FDCPA/ECOA/TILA/CROA. On credit report or collection
  notice: diagnose defect, cite section, draft instrument (dispute, 1692g
  validation, MOV request, pay-for-delete, cease-and-desist), state risk,
  give escalation path. Never advise misrepresentation.
- TAX STRATEGIST: IRC/Treasury/IRS. On notice: identify type, extract deadline
  and amount, return options as a decision tree (agree/pay, installment/OIC,
  dispute, 6330 CDP inside 30 days), each with consequence. Circular 230:
  no aggressive filing position without CPA/EA/attorney disclosure.
- ACCOUNTANT: U.S. GAAP by ASC topic. Give treatment, rationale, required
  disclosure, and audit risk in that order.
- BUDGET COACH: choose method to fit; categorize statement, compute key ratios,
  surface anomalies, recommend one intervention.
- LIFE PLANNER: when documents arrive together, produce one life snapshot and
  one plan; every recommendation has owner + date.

DOCUMENT INGESTION sequence for uploaded files:
identify -> extract (parties, masked accounts, dates, amounts, deadlines,
statutory citations) -> severity (CRITICAL/HIGH/MEDIUM/LOW) -> for critical/high
lead with deadline -> draft response ready for review.

OUTPUT discipline in regulated domains:
Diagnosis -> Authority -> Action -> Risk -> Next Steps.
Every response must leave a clearer picture, a specific next action, and source.
Not a substitute for CPA/EA/attorney; say so once when filing position or
litigation strategy is implicated.
""".strip()

OPERATOR_DOSSIER = """
Operator dossier (authoritative runtime context, July 2026):
- Bruce Baugh: Principal of BBA Services; Mico of the Yamasee Nation; Steward, House of Day.
- Active operating pattern to interrupt: replacing shipping discomfort with additional blueprinting.
- Operating style: lead with verdict, no unsolicited process critique, deliver hand-off-ready output.
- Critical path gate: EIN follow-up remains the live unblocker for creative IP and Keepers of Florida.
- House of Day Trust is already executed; do not treat as pending.
- Portfolio: APR Energy, BBA Services, House of Day Trust, EIN, copyrights,
  Keepers of Florida, Yamasee/BIA 25 CFR Part 83 petition, Anis, LinguaWorld,
  Heritage Engine/VERITAS.
- Delivery discipline: if uncertain, mark [UNVERIFIED] and route to licensed professional.
""".strip()


@dataclass
class DocumentIntelligence:
    doc_type: str
    domain: str
    severity: str
    diagnosis: str
    authorities: list[str]
    action: str
    risk: str
    deadline: str | None
    extracted: dict[str, Any]
    draft_response: str


def sanitize_mode(mode: str | None) -> str:
    if not mode:
        return "general"
    normalized = mode.strip().lower().replace("-", "_")
    return normalized if normalized in DOMAIN_MODES else "general"


def infer_domain_from_question(question: str, requested_mode: str | None = None) -> str:
    mode = sanitize_mode(requested_mode)
    if mode != "general":
        return mode

    lower = question.lower()
    if any(token in lower for token in ["credit report", "collection", "fdcpa", "fcra", "ecoa", "dispute letter"]):
        return "credit"
    if any(token in lower for token in ["irs", "cp2000", "irc", "tax", "1040", "notice"]):
        return "tax"
    if any(token in lower for token in ["asc ", "gaap", "kpmg", "fn7", "deferred tax", "consolidation"]):
        return "accounting"
    if any(token in lower for token in ["budget", "cash flow", "dti", "housing ratio", "expenses"]):
        return "budget"
    if any(token in lower for token in ["life snapshot", "integrated plan", "90-day plan", "cross-domain"]):
        return "life_plan"
    return "general"


def domain_context_block(active_domain: str) -> str:
    if active_domain == "general":
        return "Active domain mode: General Chief-of-Staff."

    authorities = DOMAIN_AUTHORITIES.get(active_domain, [])
    authority_list = "\n".join(f"- {item}" for item in authorities)
    return (
        f"Active domain mode: {DOMAIN_MODES.get(active_domain, active_domain)}\n"
        "Mandatory authority set (cite exact section/topic where applicable):\n"
        f"{authority_list}"
    )


def classify_document(title: str, content: str) -> tuple[str, str]:
    text = f"{title}\n{content[:5000]}".lower()

    if any(token in text for token in ["cp2000", "cp14", "lt11", "cp504", "irs notice", "department of the treasury"]):
        return "irs_notice", "tax"
    if any(token in text for token in ["equifax", "experian", "transunion", "credit report", "score"]):
        return "credit_report", "credit"
    if any(token in text for token in ["debt collector", "validation notice", "1692g", "collection notice", "attempt to collect"]):
        return "collection_notice", "credit"
    if any(token in text for token in ["bank statement", "beginning balance", "ending balance", "debit", "credit"]):
        return "bank_statement", "budget"
    if any(token in text for token in ["asc ", "financial statements", "kpmg", "audit", "footnote"]):
        return "accounting_doc", "accounting"
    return "general_document", "life_plan"


def _extract_amounts(content: str) -> list[str]:
    return re.findall(r"\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?", content)


def _extract_dates(content: str) -> list[str]:
    patterns = [
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}/\d{1,2}/\d{2,4}\b",
        r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},\s*\d{4}\b",
    ]
    found: list[str] = []
    lower = content.lower()
    for pattern in patterns:
        found.extend(re.findall(pattern, lower, flags=re.IGNORECASE))
    return found[:12]


def _extract_statutes(content: str) -> list[str]:
    pattern = r"\b(?:\d{1,2}\s+u\.s\.c\.?\s*\d+[a-z0-9-]*|irc\s*\d+[a-z0-9-]*|asc\s*\d+)\b"
    return list(dict.fromkeys(re.findall(pattern, content.lower(), flags=re.IGNORECASE)))[:12]


def _find_deadline_hint(content: str) -> str | None:
    lower = content.lower()
    day_match = re.search(r"within\s+(\d{1,3})\s+days", lower)
    if day_match:
        return f"within {day_match.group(1)} days"
    if "30-day" in lower or "30 days" in lower:
        return "within 30 days"
    if "deadline" in lower:
        return "deadline referenced in document"
    return None


def _severity(deadline_hint: str | None, doc_type: str) -> str:
    if deadline_hint and "within 30 days" in deadline_hint:
        return "HIGH"
    if deadline_hint and "within" in deadline_hint:
        return "HIGH"
    if doc_type in {"irs_notice", "collection_notice"}:
        return "HIGH"
    if doc_type in {"credit_report", "bank_statement", "accounting_doc"}:
        return "MEDIUM"
    return "LOW"


def _diagnosis(doc_type: str) -> str:
    mapping = {
        "irs_notice": "Potential IRS response window with financial consequence.",
        "credit_report": "Credit profile review needed; triage disputable vs accurate negatives.",
        "collection_notice": "Debt collection rights window may be active under FDCPA.",
        "bank_statement": "Cash-flow variance and leakage analysis candidate.",
        "accounting_doc": "Accounting treatment/disclosure evaluation required.",
        "general_document": "General document requiring integrated planning synthesis.",
    }
    return mapping.get(doc_type, "General document requiring review.")


def _action(domain: str, doc_type: str, deadline_hint: str | None) -> str:
    if doc_type == "irs_notice":
        return "Identify notice type, verify deadline, and choose one path: agree/pay, installment/OIC, dispute with documentation, or CDP hearing if eligible."
    if doc_type == "credit_report":
        return "Rank derogatory items by score impact, draft disputes for inaccurate/unverifiable entries, and sequence utilization reduction over 30/60/90 days."
    if doc_type == "collection_notice":
        return "If inside validation window, send FDCPA validation demand first; do not negotiate payment until debt is verified."
    if doc_type == "bank_statement":
        return "Categorize fixed vs variable spend, calculate savings rate + DTI, and select one immediate intervention to improve net cash."
    if domain == "accounting":
        return "Map issue to ASC topic, state treatment and disclosure requirements, and record audit-risk notes."
    return "Produce one integrated snapshot with owner, due date, and risk for each recommendation."


def _risk(doc_type: str, deadline_hint: str | None) -> str:
    if doc_type in {"irs_notice", "collection_notice"}:
        return "Missed response windows can reduce options and increase balances, penalties, or legal pressure."
    if doc_type == "credit_report":
        return "Disputing accurate negatives can fail and waste the primary improvement window."
    if deadline_hint:
        return "Document indicates a response window; missing it can reduce reversibility."
    return "Low immediate legal risk, but delayed action can preserve avoidable inefficiency."


def _draft_response(doc_type: str, extracted: dict[str, Any], deadline_hint: str | None) -> str:
    if doc_type == "collection_notice":
        return (
            "Subject: Debt Validation Request\n\n"
            "I am requesting validation of the alleged debt under 15 U.S.C. 1692g. "
            "Please provide the amount, original creditor, account-level records, and chain of title. "
            "Pending validation, cease collection activity and credit reporting updates on this account."
        )
    if doc_type == "credit_report":
        return (
            "Subject: Credit Report Dispute\n\n"
            "I dispute the accuracy/completeness of the listed tradeline(s). "
            "Please reinvestigate under 15 U.S.C. 1681i and delete any item that cannot be verified. "
            "Provide method-of-verification details for each challenged item."
        )
    if doc_type == "irs_notice":
        return (
            "Subject: IRS Notice Response\n\n"
            "I am responding to this notice and request confirmation of the assessed amount, tax year, and response deadline. "
            "I intend to submit supporting documentation and request available resolution options for this account."
        )

    lead = f"Deadline signal: {deadline_hint}.\n\n" if deadline_hint else ""
    return (
        f"{lead}"
        "Draft response summary:\n"
        "- Confirm receipt of the notice/document.\n"
        "- Request any missing records needed to verify the claim.\n"
        "- State intended resolution path and target response date."
    )


def analyze_document(title: str, content: str) -> DocumentIntelligence:
    doc_type, domain = classify_document(title, content)
    deadline_hint = _find_deadline_hint(content)
    severity = _severity(deadline_hint, doc_type)
    authorities = DOMAIN_AUTHORITIES.get(domain, [])[:4]

    extracted = {
        "amounts": _extract_amounts(content)[:8],
        "dates": _extract_dates(content),
        "deadline_hint": deadline_hint,
        "statutes": _extract_statutes(content),
    }

    return DocumentIntelligence(
        doc_type=doc_type,
        domain=domain,
        severity=severity,
        diagnosis=_diagnosis(doc_type),
        authorities=authorities,
        action=_action(domain, doc_type, deadline_hint),
        risk=_risk(doc_type, deadline_hint),
        deadline=deadline_hint,
        extracted=extracted,
        draft_response=_draft_response(doc_type, extracted, deadline_hint),
    )


def intelligence_brief_markdown(report: DocumentIntelligence) -> str:
    authority_lines = "\n".join(f"- {authority}" for authority in report.authorities) if report.authorities else "- [UNVERIFIED]"
    amount_line = ", ".join(report.extracted.get("amounts", [])[:5]) or "none detected"
    date_line = ", ".join(report.extracted.get("dates", [])[:5]) or "none detected"
    statute_line = ", ".join(report.extracted.get("statutes", [])[:6]) or "none detected"
    deadline = report.deadline or "none detected"

    return (
        "## Document Intelligence Brief\n"
        f"- Type: {report.doc_type}\n"
        f"- Domain route: {report.domain}\n"
        f"- Severity: {report.severity}\n"
        f"- Deadline signal: {deadline}\n\n"
        f"### Diagnosis\n{report.diagnosis}\n\n"
        f"### Authority\n{authority_lines}\n\n"
        f"### Extracted Signals\n"
        f"- Amounts: {amount_line}\n"
        f"- Dates: {date_line}\n"
        f"- Statutes/Topics: {statute_line}\n\n"
        f"### Action\n{report.action}\n\n"
        f"### Risk\n{report.risk}\n\n"
        "### Draft Response\n"
        f"{report.draft_response}\n\n"
        "### Next Step\n"
        "Owner: Operator\n"
        f"When: {datetime.now(timezone.utc).date().isoformat()}\n"
        "Deliverable: Review draft response, attach evidence, and submit before any active deadline.\n"
    )
