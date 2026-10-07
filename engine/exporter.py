"""
Exporter — generates professional, executive-grade Word (.docx) case briefs and audit dossiers.
Fully formatted with styled tables, metadata banners, risk matrices, and timeline analysis.
"""

from __future__ import annotations
import io
import datetime
from typing import Optional

import store
import users
import agent


def set_cell_background(cell, fill_hex: str):
    """Set background color of a table cell in docx."""
    from docx.oxml import parse_xml
    from docx.oxml.ns import nsdecls
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)


def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set inner padding for table cell."""
    from docx.oxml import parse_xml
    from docx.oxml.ns import nsdecls
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)


def generate_matter_docx(matter_id: str, current_user: dict) -> bytes:
    import docx
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT

    doc = docx.Document()

    # ── Page Setup ─────────────────────────────────────────────────────────────
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # ── Palette Constants ──────────────────────────────────────────────────────
    NAVY = RGBColor(30, 58, 138)       # #1E3A8A - Primary Header
    SLATE = RGBColor(51, 65, 85)       # #334155 - Subtitle & Text
    DARK = RGBColor(15, 23, 42)        # #0F172A - Body bold
    MUTED = RGBColor(100, 116, 139)    # #64748B - Footnotes/Meta
    ACCENT = RGBColor(2, 132, 199)     # #0284C7 - Accents

    # ── Resolve Matter Metadata ────────────────────────────────────────────────
    user_matters = users.list_user_matters(current_user)
    m_info = next((m for m in user_matters if m["id"] == matter_id), None)
    matter_title = m_info["title"] if m_info else f"Matter #{matter_id}"
    matter_desc = m_info.get("description", "") if m_info else ""
    matter_tags = m_info.get("tags", []) if m_info else []
    created_at = m_info.get("created_at", "") if m_info else ""
    
    vertical_name = users.get_workspace_vertical().upper()
    now_str = datetime.datetime.now().strftime("%d %b %Y, %I:%M %p")

    # Ingested Files
    with store.get_db_context() as db:
        files = store.matter_files(db, matter_id)
        chat = store.get_chat_history(db, matter_id, current_user["id"])

    # ── Header Title Block ────────────────────────────────────────────────────
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(2)
    title_run = title_p.add_run("PROASSIST EXECUTIVE CASE BRIEF")
    title_run.font.name = "Calibri"
    title_run.font.size = Pt(22)
    title_run.font.bold = True
    title_run.font.color.rgb = NAVY

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(14)
    sub_run = sub_p.add_run(f"Confidential Legal & Advisory Dossier — {matter_title}")
    sub_run.font.name = "Calibri"
    sub_run.font.size = Pt(13)
    sub_run.font.color.rgb = ACCENT

    # ── Metadata Overview Table ───────────────────────────────────────────────
    meta_table = doc.add_table(rows=3, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False

    meta_rows = [
        [("Matter Title / ID", f"{matter_title} (#{matter_id})"), ("Generated On", now_str)],
        [("Practice Domain", f"{vertical_name} Intelligence"), ("Prepared By", f"{current_user.get('full_name', 'Authorized User')} ({current_user.get('role', 'Member')})")],
        [("Status / Badges", ", ".join(matter_tags) if matter_tags else "Active Dossier"), ("Source Evidence", f"{len(files)} Ingested Documents" if files else "No uploaded files")]
    ]

    for row_idx, row_data in enumerate(meta_rows):
        for col_idx, (label, val) in enumerate(row_data):
            cell = meta_table.cell(row_idx, col_idx)
            set_cell_background(cell, "F8FAFC")
            set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            lbl_run = p.add_run(f"{label}: ")
            lbl_run.font.name = "Calibri"
            lbl_run.font.size = Pt(9.5)
            lbl_run.font.bold = True
            lbl_run.font.color.rgb = SLATE
            val_run = p.add_run(val)
            val_run.font.name = "Calibri"
            val_run.font.size = Pt(9.5)
            val_run.font.color.rgb = DARK

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # ── Section 1: Executive Brief ────────────────────────────────────────────
    h1 = doc.add_heading("1. Executive Brief & Case Overview", level=1)
    h1.runs[0].font.color.rgb = NAVY

    brief = users.get_matter_executive_brief(matter_id) or agent.generate_executive_brief(matter_id)
    summary_text = brief.get("summary") or matter_desc or "No formal executive brief compiled yet. The dossier is active."

    callout = doc.add_table(rows=1, cols=1)
    callout.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_cell = callout.cell(0, 0)
    set_cell_background(c_cell, "EFF6FF")
    set_cell_margins(c_cell, top=140, bottom=140, left=180, right=180)
    cp = c_cell.paragraphs[0]
    c_run = cp.add_run(summary_text)
    c_run.font.name = "Georgia"
    c_run.font.size = Pt(10.5)
    c_run.font.italic = True
    c_run.font.color.rgb = DARK

    # Critical Dates & Deadlines Table
    crit_dates = brief.get("critical_dates", [])
    if crit_dates:
        h2 = doc.add_heading("Critical Limitation & Hearing Deadlines", level=2)
        h2.runs[0].font.color.rgb = SLATE
        d_table = doc.add_table(rows=len(crit_dates) + 1, cols=2)
        d_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        # Header
        set_cell_background(d_table.cell(0, 0), "1E3A8A")
        set_cell_background(d_table.cell(0, 1), "1E3A8A")
        d_table.cell(0, 0).paragraphs[0].add_run("Item / Milestone").font.color.rgb = RGBColor(255, 255, 255)
        d_table.cell(0, 1).paragraphs[0].add_run("Extracted Deadline / Statutory Rule").font.color.rgb = RGBColor(255, 255, 255)
        d_table.cell(0, 0).paragraphs[0].runs[0].bold = True
        d_table.cell(0, 1).paragraphs[0].runs[0].bold = True
        
        for idx, date_str in enumerate(crit_dates):
            r_idx = idx + 1
            bg = "F1F5F9" if r_idx % 2 == 1 else "FFFFFF"
            c0 = d_table.cell(r_idx, 0)
            c1 = d_table.cell(r_idx, 1)
            set_cell_background(c0, bg)
            set_cell_background(c1, bg)
            set_cell_margins(c0, 60, 60, 100, 100)
            set_cell_margins(c1, 60, 60, 100, 100)
            c0.paragraphs[0].add_run(f"Deadline #{idx + 1}").font.size = Pt(9.5)
            c1.paragraphs[0].add_run(str(date_str)).font.size = Pt(9.5)

    # Key Risks Table
    risks = brief.get("risks", [])
    if risks:
        h2_r = doc.add_heading("Key Identified Liabilities & Legal Risks", level=2)
        h2_r.runs[0].font.color.rgb = SLATE
        for r_item in risks:
            p_r = doc.add_paragraph(style='List Bullet')
            r_run = p_r.add_run(str(r_item))
            r_run.font.name = "Calibri"
            r_run.font.size = Pt(10)

    # ── Section 2: Chronological Timeline ─────────────────────────────────────
    h_time = doc.add_heading("2. Chronological Timeline of Events", level=1)
    h_time.runs[0].font.color.rgb = NAVY

    intel = users.get_matter_intelligence(matter_id) or agent.extract_intelligence(matter_id)
    timeline_items = intel.get("timeline", [])

    if timeline_items:
        t_table = doc.add_table(rows=len(timeline_items) + 1, cols=3)
        t_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        # Header Row
        set_cell_background(t_table.cell(0, 0), "1E3A8A")
        set_cell_background(t_table.cell(0, 1), "1E3A8A")
        set_cell_background(t_table.cell(0, 2), "1E3A8A")
        
        for c_idx, title in enumerate(["Date / Period", "Chronological Event Description", "Evidentiary Source"]):
            cell = t_table.cell(0, c_idx)
            p = cell.paragraphs[0]
            run = p.add_run(title)
            run.font.bold = True
            run.font.name = "Calibri"
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(255, 255, 255)
            set_cell_margins(cell, 80, 80, 100, 100)

        for i, item in enumerate(timeline_items):
            r_idx = i + 1
            bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
            c0 = t_table.cell(r_idx, 0)
            c1 = t_table.cell(r_idx, 1)
            c2 = t_table.cell(r_idx, 2)
            for c in (c0, c1, c2):
                set_cell_background(c, bg)
                set_cell_margins(c, 70, 70, 100, 100)
                
            c0.paragraphs[0].add_run(item.get("date", "N/A")).font.size = Pt(9.5)
            c1.paragraphs[0].add_run(item.get("event", "")).font.size = Pt(9.5)
            c2.paragraphs[0].add_run(item.get("source", "Verified Ingested Record")).font.size = Pt(9)
    else:
        doc.add_paragraph("No specific chronological milestones detected in current documents.")

    # ── Section 3: Key Parties & Entities ─────────────────────────────────────
    h_parties = doc.add_heading("3. Key Parties, Entities & Witnesses", level=1)
    h_parties.runs[0].font.color.rgb = NAVY

    people_items = intel.get("people", [])
    if people_items:
        p_table = doc.add_table(rows=len(people_items) + 1, cols=2)
        p_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        set_cell_background(p_table.cell(0, 0), "1E3A8A")
        set_cell_background(p_table.cell(0, 1), "1E3A8A")
        
        for c_idx, title in enumerate(["Person / Entity Name", "Role, Capacity & Standing"]):
            cell = p_table.cell(0, c_idx)
            p = cell.paragraphs[0]
            run = p.add_run(title)
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            set_cell_margins(cell, 80, 80, 100, 100)

        for i, person in enumerate(people_items):
            r_idx = i + 1
            bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
            c0 = p_table.cell(r_idx, 0)
            c1 = p_table.cell(r_idx, 1)
            set_cell_background(c0, bg)
            set_cell_background(c1, bg)
            set_cell_margins(c0, 60, 60, 100, 100)
            set_cell_margins(c1, 60, 60, 100, 100)
            
            c0.paragraphs[0].add_run(person.get("name", "N/A")).font.bold = True
            c0.paragraphs[0].runs[0].font.size = Pt(9.5)
            c1.paragraphs[0].add_run(person.get("role", "")).font.size = Pt(9.5)
    else:
        doc.add_paragraph("No distinct individuals or legal entities auto-extracted.")

    # ── Section 4: Contradictions & Missing Evidence ──────────────────────────
    h_contra = doc.add_heading("4. Evidentiary Discrepancies & Gaps", level=1)
    h_contra.runs[0].font.color.rgb = NAVY

    contradictions = intel.get("contradictions", [])
    if contradictions:
        doc.add_heading("Identified Contradictions & Conflicts", level=2).runs[0].font.color.rgb = SLATE
        for c_item in contradictions:
            p_c = doc.add_paragraph(style='List Bullet')
            p_c.add_run(str(c_item)).font.size = Pt(9.5)

    missing = intel.get("missing_evidence", [])
    if missing:
        doc.add_heading("Missing Documentary Evidence / Gaps", level=2).runs[0].font.color.rgb = SLATE
        for m_item in missing:
            p_m = doc.add_paragraph(style='List Bullet')
            p_m.add_run(str(m_item)).font.size = Pt(9.5)

    # ── Section 5: Consultation Q&A History ───────────────────────────────────
    h_chat = doc.add_heading("5. Consultation & Advisory Q&A Record", level=1)
    h_chat.runs[0].font.color.rgb = NAVY

    if chat:
        for idx, msg in enumerate(chat):
            is_user = msg["role"] == "user"
            p_msg = doc.add_paragraph()
            p_msg.paragraph_format.space_before = Pt(6)
            p_msg.paragraph_format.space_after = Pt(4)
            
            role_run = p_msg.add_run("Advocate / User: " if is_user else "ProAssist AI Response:\n")
            role_run.font.name = "Calibri"
            role_run.font.size = Pt(10)
            role_run.font.bold = True
            role_run.font.color.rgb = NAVY if is_user else ACCENT

            content_run = p_msg.add_run(msg["content"])
            content_run.font.name = "Calibri"
            content_run.font.size = Pt(10)
            content_run.font.color.rgb = DARK
    else:
        doc.add_paragraph("No recorded chat consultation sessions for this matter.")

    # ── Section 6: Air-Gapped Confidentiality Notice ──────────────────────────
    doc.add_paragraph().paragraph_format.space_after = Pt(20)
    disc_table = doc.add_table(rows=1, cols=1)
    disc_cell = disc_table.cell(0, 0)
    set_cell_background(disc_cell, "F1F5F9")
    set_cell_margins(disc_cell, top=100, bottom=100, left=150, right=150)
    
    dp = disc_cell.paragraphs[0]
    d_run = dp.add_run("CONFIDENTIAL & PRIVILEGED WORK PRODUCT\n")
    d_run.font.bold = True
    d_run.font.size = Pt(8.5)
    d_run.font.color.rgb = SLATE
    
    d_text = (
        "This case brief was compiled exclusively through 100% offline, on-premise local inference using ProAssist Enterprise AI. "
        "No case files, confidential identifiers, PAN, Aadhaar, or financial excerpts were transmitted to external servers or cloud providers. "
        "Strict attorney-client confidentiality and DPDP Act compliance are maintained."
    )
    d_run2 = dp.add_run(d_text)
    d_run2.font.size = Pt(8)
    d_run2.font.italic = True
    d_run2.font.color.rgb = MUTED

    # ── Save to Buffer ────────────────────────────────────────────────────────
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
