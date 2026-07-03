import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import text

from .store import engine


def _to_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace(" ", "T"))
    return datetime.utcnow()


def _json_loads(value: Any, fallback: Any) -> Any:
    if value is None:
        return fallback
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return fallback


CORE_SCHOLARS = [
    {"id": "ptahhotep", "name": "Ptahhotep", "tradition": "Egyptian", "fields": ["ethics", "statecraft"], "dates": "c. 2400 BCE", "era": "Ancient", "biography": "Vizier and author of leadership maxims focused on restraint, listening, and order.", "methodology": "Conduct before command", "influence_rank": 1},
    {"id": "imhotep", "name": "Imhotep", "tradition": "Egyptian", "fields": ["architecture", "medicine", "systems"], "dates": "c. 27th century BCE", "era": "Ancient", "biography": "Polymath architect and physician associated with integrated design and durable systems.", "methodology": "Build for continuity", "influence_rank": 1},
    {"id": "harkhebi", "name": "Harkhebi", "tradition": "Egyptian", "fields": ["astronomy", "timing"], "dates": "Ancient", "era": "Ancient", "biography": "Astronomer-priest associated with practical celestial timing discipline.", "methodology": "Observe cycles empirically", "influence_rank": 2},
    {"id": "peseshet", "name": "Peseshet", "tradition": "Egyptian", "fields": ["medical training", "care standards"], "dates": "Ancient", "era": "Ancient", "biography": "Historically referenced as an overseer of physicians and standards in care.", "methodology": "Standardize for safety", "influence_rank": 2},
    {"id": "alkhwarizmi", "name": "Al-Khwarizmi", "tradition": "Islamic", "fields": ["mathematics", "algorithms", "process"], "dates": "c. 780-850", "era": "Classical", "biography": "Foundational mathematician linked to algebra and algorithmic thinking.", "methodology": "Decompose complexity", "influence_rank": 1},
    {"id": "ibn_al_haytham", "name": "Ibn al-Haytham", "tradition": "Islamic", "fields": ["optics", "method", "evidence"], "dates": "c. 965-1040", "era": "Classical", "biography": "Experimental thinker emphasizing observation and testing before conclusion.", "methodology": "Observe before theory", "influence_rank": 1},
    {"id": "ibn_sina", "name": "Ibn Sina", "tradition": "Islamic", "fields": ["medicine", "regimen"], "dates": "c. 980-1037", "era": "Classical", "biography": "Physician-philosopher known for regimen-first frameworks in medicine.", "methodology": "Regimen over reaction", "influence_rank": 1},
    {"id": "al_razi", "name": "Al-Razi", "tradition": "Islamic", "fields": ["clinical diagnosis", "medicine"], "dates": "c. 865-925", "era": "Classical", "biography": "Clinical observer prioritizing patient reality over inherited assumptions.", "methodology": "Diagnose from evidence", "influence_rank": 1},
    {"id": "ibn_al_nafis", "name": "Ibn al-Nafis", "tradition": "Islamic", "fields": ["medicine", "critical revision"], "dates": "c. 1213-1288", "era": "Classical", "biography": "Physician known for revising accepted models via fresh anatomical reasoning.", "methodology": "Challenge inherited models", "influence_rank": 2},
    {"id": "ibn_rushd", "name": "Ibn Rushd", "tradition": "Islamic", "fields": ["law", "philosophy", "jurisprudence"], "dates": "c. 1126-1198", "era": "Classical", "biography": "Jurist-philosopher balancing reason, law, and practical judgment.", "methodology": "Reconcile law and reason", "influence_rank": 1},
    {"id": "ibn_khaldun", "name": "Ibn Khaldun", "tradition": "Islamic", "fields": ["history", "strategy", "civilization cycles"], "dates": "c. 1332-1406", "era": "Post-Classical", "biography": "Historian-strategist known for cycle analysis and social cohesion theory.", "methodology": "Read phase before action", "influence_rank": 1},
    {"id": "maimonides", "name": "Maimonides", "tradition": "Sephardic", "fields": ["medicine", "ethics", "halakha"], "dates": "c. 1138-1204", "era": "Classical", "biography": "Physician-jurist emphasizing moderation and body-mind alignment.", "methodology": "Middle path regimen", "influence_rank": 1},
    {"id": "judah_halevi", "name": "Judah Halevi", "tradition": "Sephardic", "fields": ["poetry", "philosophy", "devotion"], "dates": "c. 1075-1141", "era": "Classical", "biography": "Poet-philosopher emphasizing lived experience and covenantal identity.", "methodology": "Meaning through lived fidelity", "influence_rank": 2},
    {"id": "ibn_gabirol", "name": "Ibn Gabirol", "tradition": "Sephardic", "fields": ["poetry", "metaphysics"], "dates": "c. 1021-1058", "era": "Classical", "biography": "Poet and metaphysical thinker focused on will, form, and interior ascent.", "methodology": "Align will and form", "influence_rank": 2},
    {"id": "ibn_daud", "name": "Ibn Daud", "tradition": "Sephardic", "fields": ["history", "continuity", "philosophy"], "dates": "c. 1110-1180", "era": "Classical", "biography": "Historian-philosopher emphasizing continuity and defensible lineage records.", "methodology": "Preserve continuity with evidence", "influence_rank": 2},
    {"id": "yehuda_ibn_tibbon", "name": "Yehuda ibn Tibbon", "tradition": "Sephardic", "fields": ["translation", "knowledge transfer"], "dates": "c. 1120-1190", "era": "Classical", "biography": "Translator who preserved and transmitted cross-lingual scholarship.", "methodology": "Bridge worlds without distortion", "influence_rank": 2},
    {"id": "manetho", "name": "Manetho", "tradition": "Egyptian", "fields": ["chronology", "recordkeeping"], "dates": "c. 3rd century BCE", "era": "Ancient", "biography": "Chronographer associated with structured dynastic historical framing.", "methodology": "Order records before interpretation", "influence_rank": 2},
    {"id": "al_zahrawi", "name": "Al-Zahrawi", "tradition": "Islamic", "fields": ["surgery", "precision execution"], "dates": "c. 936-1013", "era": "Classical", "biography": "Surgeon known for instrument precision and procedural exactness.", "methodology": "Precision over haste", "influence_rank": 2},
    {"id": "abiaka", "name": "Abiaka", "tradition": "Indigenous Florida", "fields": ["diplomacy", "resilience", "land practice"], "dates": "19th century", "era": "Modern", "biography": "Seminole leader associated with resilience, diplomacy, and continuity under pressure.", "methodology": "Steady resistance with discipline", "influence_rank": 1},
    {"id": "asi_yahola", "name": "Asi Yahola", "tradition": "Indigenous Southeast", "fields": ["continuity practice", "land medicine"], "dates": "19th century", "era": "Modern", "biography": "Traditional leader associated with continuity practices and sacred-fire discipline.", "methodology": "Keep continuity alive in motion", "influence_rank": 1},
]

CORE_WORKS = [
    {"id": "w_canon_medicine", "scholar_id": "ibn_sina", "title_original": "al-Qanun fi al-Tibb", "title_english": "Canon of Medicine", "original_language": "Arabic"},
    {"id": "w_muqaddimah", "scholar_id": "ibn_khaldun", "title_original": "al-Muqaddimah", "title_english": "The Muqaddimah", "original_language": "Arabic"},
    {"id": "w_guide", "scholar_id": "maimonides", "title_original": "Dalalat al-Ha'irin", "title_english": "Guide for the Perplexed", "original_language": "Judeo-Arabic"},
    {"id": "w_optics", "scholar_id": "ibn_al_haytham", "title_original": "Kitab al-Manazir", "title_english": "Book of Optics", "original_language": "Arabic"},
    {"id": "w_alg", "scholar_id": "alkhwarizmi", "title_original": "al-Jabr", "title_english": "Compendious Book on Calculation", "original_language": "Arabic"},
]

CORE_PLANTS = [
    {"id": "nigella_sativa", "scientific_name": "Nigella sativa", "family": "Ranunculaceae", "common_names": ["black seed", "black cumin"], "native_range": "West Asia", "description": "Traditional culinary and medicinal seed."},
    {"id": "zingiber_officinale", "scientific_name": "Zingiber officinale", "family": "Zingiberaceae", "common_names": ["ginger"], "native_range": "South Asia", "description": "Root used in digestive and anti-inflammatory traditions."},
    {"id": "curcuma_longa", "scientific_name": "Curcuma longa", "family": "Zingiberaceae", "common_names": ["turmeric"], "native_range": "South Asia", "description": "Rhizome used across food and medicinal traditions."},
    {"id": "syzygium_aromaticum", "scientific_name": "Syzygium aromaticum", "family": "Myrtaceae", "common_names": ["clove"], "native_range": "Indonesia", "description": "Aromatic spice with historical medicinal use."},
    {"id": "citrus_limon", "scientific_name": "Citrus limon", "family": "Rutaceae", "common_names": ["lemon"], "native_range": "South Asia", "description": "Citrus used for culinary and daily wellness routines."},
    {"id": "ilex_vomitoria", "scientific_name": "Ilex vomitoria", "family": "Aquifoliaceae", "common_names": ["yaupon holly"], "native_range": "Southeastern United States", "description": "Native Florida and Southeast plant used in traditional preparations."},
]

CORE_TEXTS = [
    {"id": "quran", "corpus": "Quran", "book": "Quran", "language": "Arabic", "period": "7th century"},
    {"id": "torah", "corpus": "Tanakh", "book": "Torah", "language": "Hebrew", "period": "Ancient"},
    {"id": "pirkei_moshe", "corpus": "Medical Treatises", "book": "Pirkei Moshe", "language": "Judeo-Arabic", "period": "12th century"},
]

CORE_LINEAGE = [
    {"id": "ln_1", "scholar_id": "ibn_sina", "teacher_id": "al_razi", "relationship": "methodological lineage", "citation": "Biographical synthesis"},
    {"id": "ln_2", "scholar_id": "ibn_rushd", "teacher_id": "ibn_sina", "relationship": "commentarial influence", "citation": "Intellectual history synthesis"},
    {"id": "ln_3", "scholar_id": "maimonides", "teacher_id": "ibn_rushd", "relationship": "philosophical influence", "citation": "Comparative study tradition"},
    {"id": "ln_4", "scholar_id": "ibn_khaldun", "teacher_id": "ibn_rushd", "relationship": "method inheritance", "citation": "Historical method lineage"},
]

CORE_PLANT_SAFETY = [
    {"id": "ps_1", "plant_id": "nigella_sativa", "toxicity": "low", "contraindications": "Pregnancy requires clinician guidance.", "drug_interactions": "Potential additive effect with antihypertensives.", "dose_range": "Culinary doses preferred unless supervised."},
    {"id": "ps_2", "plant_id": "zingiber_officinale", "toxicity": "low", "contraindications": "Use caution with gallbladder disorders.", "drug_interactions": "Potential interaction with anticoagulants at high doses.", "dose_range": "Culinary and tea doses generally tolerated."},
    {"id": "ps_3", "plant_id": "curcuma_longa", "toxicity": "low", "contraindications": "Use caution with biliary obstruction.", "drug_interactions": "May interact with anticoagulants and antiplatelets.", "dose_range": "Food doses preferred unless supervised."},
]

CORE_PLANT_EVIDENCE = [
    {"id": "pe_1", "plant_id": "nigella_sativa", "compound": "thymoquinone", "evidence_tier": "moderate", "citation": "Systematic review summaries", "pubmed_id": "", "doi": ""},
    {"id": "pe_2", "plant_id": "zingiber_officinale", "compound": "gingerols", "evidence_tier": "moderate", "citation": "Clinical review summaries", "pubmed_id": "", "doi": ""},
    {"id": "pe_3", "plant_id": "curcuma_longa", "compound": "curcumin", "evidence_tier": "moderate", "citation": "Evidence synthesis overviews", "pubmed_id": "", "doi": ""},
]

CORE_PLANT_SCHOLAR_RECS = [
    {"id": "pr_1", "plant_id": "nigella_sativa", "scholar_id": "ibn_sina", "work_id": "w_canon_medicine", "citation": "Canon-derived regimen tradition", "traditional_use": "daily support and resilience"},
    {"id": "pr_2", "plant_id": "zingiber_officinale", "scholar_id": "maimonides", "work_id": "w_guide", "citation": "Regimen and digestion traditions", "traditional_use": "digestive balance"},
    {"id": "pr_3", "plant_id": "curcuma_longa", "scholar_id": "al_razi", "work_id": "w_canon_medicine", "citation": "Classical medicine commentary stream", "traditional_use": "inflammation-support protocols"},
]

CORE_TEXT_REFERENCES = [
    {"id": "tr_1", "text_id": "quran", "reference": "16:69", "plant_id": None, "practice_id": "reflective-nutrition", "translation": "In it is healing for people.", "commentary": "Used as a contemplative anchor for diet and care ethics.", "citation": "Quranic reference tradition"},
    {"id": "tr_2", "text_id": "torah", "reference": "Deut 8:8", "plant_id": None, "practice_id": "land-stewardship", "translation": "A land of wheat, barley, vines, and figs.", "commentary": "Frames abundance with responsibility and stewardship.", "citation": "Biblical agrarian framing"},
]


def init_compendium_db() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                create table if not exists scholars (
                    id text primary key,
                    name text not null,
                    arabic_name text,
                    hebrew_name text,
                    dates text,
                    era text,
                    tradition text,
                    fields text,
                    biography text,
                    methodology text,
                    worldview text,
                    influence_rank integer,
                    citations text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists works (
                    id text primary key,
                    scholar_id text,
                    title_original text,
                    title_english text,
                    original_language text,
                    composition_date text,
                    earliest_manuscript text,
                    shelfmark text,
                    library text,
                    critical_edition text,
                    english_translation text,
                    influence_path text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists scholar_lineage (
                    id text primary key,
                    scholar_id text,
                    teacher_id text,
                    relationship text,
                    citation text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists plants (
                    id text primary key,
                    scientific_name text,
                    authority text,
                    family text,
                    common_names text,
                    arabic_name text,
                    hebrew_name text,
                    egyptian_name text,
                    greek_name text,
                    native_range text,
                    description text,
                    citations text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists plant_scholar_recommendation (
                    id text primary key,
                    plant_id text,
                    scholar_id text,
                    work_id text,
                    citation text,
                    traditional_use text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists plant_modern_evidence (
                    id text primary key,
                    plant_id text,
                    compound text,
                    evidence_tier text,
                    citation text,
                    pubmed_id text,
                    doi text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists plant_safety (
                    id text primary key,
                    plant_id text,
                    toxicity text,
                    contraindications text,
                    drug_interactions text,
                    dose_range text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists florida_suitability (
                    id text primary key,
                    plant_id text,
                    native_fl boolean,
                    naturalized_fl boolean,
                    usda_zones text,
                    heat_tol integer,
                    humidity_tol integer,
                    drought_tol integer,
                    salt_tol integer,
                    pollinator_value integer,
                    harvest_months text,
                    companion_plants text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists garden_designs (
                    id text primary key,
                    user_id text,
                    name text,
                    location text,
                    tradition_influences text,
                    square_feet integer,
                    usda_zone text,
                    sun_exposure text,
                    goals text,
                    created_at timestamp default CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists garden_plants (
                    id text primary key,
                    garden_id text,
                    plant_id text,
                    quantity integer,
                    position text,
                    notes text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists sacred_texts (
                    id text primary key,
                    corpus text,
                    book text,
                    language text,
                    period text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists text_references (
                    id text primary key,
                    text_id text,
                    reference text,
                    plant_id text,
                    practice_id text,
                    translation text,
                    commentary text,
                    citation text
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists study_progress (
                    id text primary key,
                    user_id text,
                    scholar_id text,
                    text_id text,
                    level text,
                    completed_at timestamp
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists council_convenings (
                    id text primary key,
                    user_id text,
                    moment text,
                    scholar_id text,
                    created_at timestamp default CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists briefings (
                    id text primary key,
                    user_id text,
                    briefing_type text,
                    content text,
                    compendium_digest text,
                    created_at timestamp default CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                create table if not exists meals_today (
                    id text primary key,
                    user_id text,
                    meal_name text,
                    notes text,
                    historical_uses text,
                    safety_flags text,
                    created_at timestamp default CURRENT_TIMESTAMP
                )
                """
            )
        )


def seed_compendium_defaults() -> None:
    with engine.begin() as conn:
        has_scholars = conn.execute(text("select count(*) as c from scholars")).one()._mapping["c"]
        if int(has_scholars) == 0:
            for s in CORE_SCHOLARS:
                conn.execute(
                    text(
                        """
                        insert into scholars (
                            id, name, dates, era, tradition, fields, biography,
                            methodology, worldview, influence_rank, citations
                        ) values (
                            :id, :name, :dates, :era, :tradition, :fields, :biography,
                            :methodology, :worldview, :influence_rank, :citations
                        )
                        """
                    ),
                    {
                        **s,
                        "fields": json.dumps(s.get("fields") or []),
                        "worldview": "",
                        "citations": json.dumps([]),
                    },
                )

        has_works = conn.execute(text("select count(*) as c from works")).one()._mapping["c"]
        if int(has_works) == 0:
            for w in CORE_WORKS:
                conn.execute(
                    text(
                        """
                        insert into works (
                            id, scholar_id, title_original, title_english, original_language,
                            composition_date, earliest_manuscript, shelfmark, library,
                            critical_edition, english_translation, influence_path
                        ) values (
                            :id, :scholar_id, :title_original, :title_english, :original_language,
                            :composition_date, :earliest_manuscript, :shelfmark, :library,
                            :critical_edition, :english_translation, :influence_path
                        )
                        """
                    ),
                    {
                        **w,
                        "composition_date": "",
                        "earliest_manuscript": "",
                        "shelfmark": "",
                        "library": "",
                        "critical_edition": "",
                        "english_translation": "",
                        "influence_path": "",
                    },
                )

        has_plants = conn.execute(text("select count(*) as c from plants")).one()._mapping["c"]
        if int(has_plants) == 0:
            for p in CORE_PLANTS:
                conn.execute(
                    text(
                        """
                        insert into plants (
                            id, scientific_name, authority, family, common_names,
                            native_range, description, citations
                        ) values (
                            :id, :scientific_name, :authority, :family, :common_names,
                            :native_range, :description, :citations
                        )
                        """
                    ),
                    {
                        **p,
                        "authority": "",
                        "common_names": json.dumps(p.get("common_names") or []),
                        "citations": json.dumps([]),
                    },
                )

        has_texts = conn.execute(text("select count(*) as c from sacred_texts")).one()._mapping["c"]
        if int(has_texts) == 0:
            for t in CORE_TEXTS:
                conn.execute(
                    text(
                        """
                        insert into sacred_texts (id, corpus, book, language, period)
                        values (:id, :corpus, :book, :language, :period)
                        """
                    ),
                    t,
                )

        has_lineage = conn.execute(text("select count(*) as c from scholar_lineage")).one()._mapping["c"]
        if int(has_lineage) == 0:
            for item in CORE_LINEAGE:
                conn.execute(
                    text(
                        """
                        insert into scholar_lineage (id, scholar_id, teacher_id, relationship, citation)
                        values (:id, :scholar_id, :teacher_id, :relationship, :citation)
                        """
                    ),
                    item,
                )

        has_safety = conn.execute(text("select count(*) as c from plant_safety")).one()._mapping["c"]
        if int(has_safety) == 0:
            for item in CORE_PLANT_SAFETY:
                conn.execute(
                    text(
                        """
                        insert into plant_safety (id, plant_id, toxicity, contraindications, drug_interactions, dose_range)
                        values (:id, :plant_id, :toxicity, :contraindications, :drug_interactions, :dose_range)
                        """
                    ),
                    item,
                )

        has_evidence = conn.execute(text("select count(*) as c from plant_modern_evidence")).one()._mapping["c"]
        if int(has_evidence) == 0:
            for item in CORE_PLANT_EVIDENCE:
                conn.execute(
                    text(
                        """
                        insert into plant_modern_evidence (id, plant_id, compound, evidence_tier, citation, pubmed_id, doi)
                        values (:id, :plant_id, :compound, :evidence_tier, :citation, :pubmed_id, :doi)
                        """
                    ),
                    item,
                )

        has_recs = conn.execute(text("select count(*) as c from plant_scholar_recommendation")).one()._mapping["c"]
        if int(has_recs) == 0:
            for item in CORE_PLANT_SCHOLAR_RECS:
                conn.execute(
                    text(
                        """
                        insert into plant_scholar_recommendation (id, plant_id, scholar_id, work_id, citation, traditional_use)
                        values (:id, :plant_id, :scholar_id, :work_id, :citation, :traditional_use)
                        """
                    ),
                    item,
                )

        has_refs = conn.execute(text("select count(*) as c from text_references")).one()._mapping["c"]
        if int(has_refs) == 0:
            for item in CORE_TEXT_REFERENCES:
                conn.execute(
                    text(
                        """
                        insert into text_references (id, text_id, reference, plant_id, practice_id, translation, commentary, citation)
                        values (:id, :text_id, :reference, :plant_id, :practice_id, :translation, :commentary, :citation)
                        """
                    ),
                    item,
                )


def list_scholars(field: str | None = None, tradition: str | None = None, era: str | None = None) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(text("select * from scholars order by influence_rank asc, name asc")).all()
    out: list[dict[str, Any]] = []
    for r in rows:
        m = dict(r._mapping)
        m["fields"] = _json_loads(m.get("fields"), [])
        if field and field.lower() not in " ".join(m["fields"]).lower():
            continue
        if tradition and tradition.lower() not in (m.get("tradition") or "").lower():
            continue
        if era and era.lower() not in (m.get("era") or "").lower():
            continue
        out.append(m)
    return out


def get_scholar(scholar_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(text("select * from scholars where id = :id"), {"id": scholar_id}).first()
    if not row:
        return None
    m = dict(row._mapping)
    m["fields"] = _json_loads(m.get("fields"), [])
    m["citations"] = _json_loads(m.get("citations"), [])
    return m


def get_scholar_works(scholar_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(text("select * from works where scholar_id = :id order by title_english asc"), {"id": scholar_id}).all()
    return [dict(r._mapping) for r in rows]


def get_scholar_students(scholar_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select s.id, s.name, l.relationship, l.citation
                from scholar_lineage l
                join scholars s on s.id = l.scholar_id
                where l.teacher_id = :id
                order by s.name asc
                """
            ),
            {"id": scholar_id},
        ).all()
    return [dict(r._mapping) for r in rows]


def get_scholar_teachers(scholar_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select s.id, s.name, l.relationship, l.citation
                from scholar_lineage l
                join scholars s on s.id = l.teacher_id
                where l.scholar_id = :id
                order by s.name asc
                """
            ),
            {"id": scholar_id},
        ).all()
    return [dict(r._mapping) for r in rows]


def convene_council(user_id: str, moment: str) -> dict[str, Any]:
    moment_l = (moment or "morning_briefing").lower()
    if "health" in moment_l or "meal" in moment_l:
        picks = ["maimonides", "ibn_sina"]
    elif "research" in moment_l or "query" in moment_l:
        picks = ["ibn_al_haytham", "manetho"]
    elif "legal" in moment_l or "trust" in moment_l:
        picks = ["ibn_rushd", "ptahhotep"]
    elif "build" in moment_l:
        picks = ["alkhwarizmi", "imhotep"]
    else:
        picks = ["ibn_khaldun", "maimonides"]

    convened: list[dict[str, Any]] = []
    with engine.begin() as conn:
        for sid in picks[:2]:
            scholar = get_scholar(sid)
            if not scholar:
                continue
            works = get_scholar_works(sid)
            teachers = get_scholar_teachers(sid)
            convened.append(
                {
                    "id": scholar["id"],
                    "name": scholar["name"],
                    "field": ", ".join(scholar.get("fields") or []),
                    "voice_prompt": f"{scholar['name']} lens for {moment}: {scholar.get('methodology') or 'Use practical judgment.'}",
                    "context_packet": {
                        "biography": scholar.get("biography"),
                        "key_works": [w.get("title_english") for w in works],
                        "relevant_passages": [],
                        "lineage": [t.get("name") for t in teachers],
                    },
                    "citation_footer": f"Primary lens: {scholar.get('name')} | tradition: {scholar.get('tradition')}",
                }
            )
            conn.execute(
                text(
                    """
                    insert into council_convenings (id, user_id, moment, scholar_id, created_at)
                    values (:id, :user_id, :moment, :scholar_id, :created_at)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "moment": moment,
                    "scholar_id": sid,
                    "created_at": datetime.utcnow(),
                },
            )

    return {
        "moment": moment,
        "convened": convened,
        "compendium_links": [f"/comp/scholar/{c['id']}" for c in convened],
    }


def list_plants(search: str | None = None) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(text("select * from plants order by scientific_name asc")).all()
    out: list[dict[str, Any]] = []
    for r in rows:
        m = dict(r._mapping)
        m["common_names"] = _json_loads(m.get("common_names"), [])
        if search:
            q = search.lower()
            hay = " ".join([m.get("scientific_name") or "", " ".join(m.get("common_names") or []), m.get("description") or ""]).lower()
            if q not in hay:
                continue
        out.append(m)
    return out


def get_plant(plant_id: str) -> dict[str, Any] | None:
    with engine.connect() as conn:
        row = conn.execute(text("select * from plants where id = :id"), {"id": plant_id}).first()
    if not row:
        return None
    m = dict(row._mapping)
    m["common_names"] = _json_loads(m.get("common_names"), [])
    return m


def get_plant_safety(plant_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(text("select * from plant_safety where plant_id = :id"), {"id": plant_id}).all()
    return [dict(r._mapping) for r in rows]


def get_plant_evidence(plant_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(text("select * from plant_modern_evidence where plant_id = :id"), {"id": plant_id}).all()
    return [dict(r._mapping) for r in rows]


def get_plant_scholars(plant_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select r.plant_id, s.id as scholar_id, s.name as scholar_name, w.title_english as work, r.citation, r.traditional_use
                from plant_scholar_recommendation r
                left join scholars s on s.id = r.scholar_id
                left join works w on w.id = r.work_id
                where r.plant_id = :id
                """
            ),
            {"id": plant_id},
        ).all()
    return [dict(r._mapping) for r in rows]


def design_garden(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    goals = payload.get("goals") or []
    location = payload.get("location") or "Florida"
    name = payload.get("name") or f"{location} design"
    garden_id = str(uuid.uuid4())

    candidate_plants = list_plants()
    selected = candidate_plants[: min(8, len(candidate_plants))]

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into garden_designs (
                    id, user_id, name, location, tradition_influences,
                    square_feet, usda_zone, sun_exposure, goals, created_at
                ) values (
                    :id, :user_id, :name, :location, :tradition_influences,
                    :square_feet, :usda_zone, :sun_exposure, :goals, :created_at
                )
                """
            ),
            {
                "id": garden_id,
                "user_id": user_id,
                "name": name,
                "location": location,
                "tradition_influences": json.dumps(payload.get("tradition_weights") or {}),
                "square_feet": payload.get("square_feet"),
                "usda_zone": payload.get("usda_zone"),
                "sun_exposure": payload.get("sun_exposure"),
                "goals": json.dumps(goals),
                "created_at": datetime.utcnow(),
            },
        )

        for idx, p in enumerate(selected, start=1):
            conn.execute(
                text(
                    """
                    insert into garden_plants (id, garden_id, plant_id, quantity, position, notes)
                    values (:id, :garden_id, :plant_id, :quantity, :position, :notes)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "garden_id": garden_id,
                    "plant_id": p["id"],
                    "quantity": 1,
                    "position": f"zone-{idx}",
                    "notes": "auto-selected",
                },
            )

    return get_garden(garden_id)


def get_garden(garden_id: str) -> dict[str, Any]:
    with engine.connect() as conn:
        head = conn.execute(text("select * from garden_designs where id = :id"), {"id": garden_id}).first()
        plants = conn.execute(
            text(
                """
                select gp.id, gp.plant_id, p.scientific_name, p.common_names, gp.quantity, gp.position, gp.notes
                from garden_plants gp
                join plants p on p.id = gp.plant_id
                where gp.garden_id = :id
                order by gp.position asc
                """
            ),
            {"id": garden_id},
        ).all()
    if not head:
        return {"id": garden_id, "plants": []}
    h = dict(head._mapping)
    h["tradition_influences"] = _json_loads(h.get("tradition_influences"), {})
    h["goals"] = _json_loads(h.get("goals"), [])
    h["plants"] = [
        {
            **dict(p._mapping),
            "common_names": _json_loads(dict(p._mapping).get("common_names"), []),
        }
        for p in plants
    ]
    return h


def get_florida_garden(user_id: str) -> dict[str, Any]:
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                select id from garden_designs
                where user_id = :user_id and lower(location) like 'florida%'
                order by created_at desc
                limit 1
                """
            ),
            {"user_id": user_id},
        ).first()
    if row:
        return get_garden(row._mapping["id"])
    return design_garden(
        user_id,
        {
            "name": "Florida baseline garden",
            "location": "Florida",
            "tradition_weights": {"egyptian": 0.25, "moorish": 0.25, "sephardic": 0.25, "indigenous": 0.25},
            "goals": ["medicinal", "kitchen", "pollinator"],
        },
    )


def get_garden_calendar(user_id: str) -> dict[str, Any]:
    garden = get_florida_garden(user_id)
    months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ]
    lines = []
    for i, m in enumerate(months, start=1):
        picks = [p.get("scientific_name") for p in garden.get("plants", [])[:3]]
        lines.append({"month": m, "focus": "maintenance and harvest rotation", "plants": picks, "index": i})
    return {"garden_id": garden.get("id"), "location": garden.get("location", "Florida"), "calendar": lines}


def patch_garden_plant(user_id: str, garden_plant_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                select gp.id, gp.garden_id from garden_plants gp
                join garden_designs gd on gd.id = gp.garden_id
                where gp.id = :id and gd.user_id = :user_id
                """
            ),
            {"id": garden_plant_id, "user_id": user_id},
        ).first()
        if not row:
            return None

        action = (payload.get("action") or "update").lower()
        if action == "remove":
            conn.execute(text("delete from garden_plants where id = :id"), {"id": garden_plant_id})
        else:
            conn.execute(
                text(
                    """
                    update garden_plants
                    set quantity = :quantity, notes = :notes, position = :position
                    where id = :id
                    """
                ),
                {
                    "id": garden_plant_id,
                    "quantity": payload.get("quantity", 1),
                    "notes": payload.get("notes"),
                    "position": payload.get("position"),
                },
            )

        return get_garden(row._mapping["garden_id"])


def list_texts() -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(text("select * from sacred_texts order by corpus, book")).all()
    return [dict(r._mapping) for r in rows]


def get_text_references(text_id: str) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select tr.*, p.scientific_name as plant_name
                from text_references tr
                left join plants p on p.id = tr.plant_id
                where tr.text_id = :id
                order by tr.reference asc
                """
            ),
            {"id": text_id},
        ).all()
    return [dict(r._mapping) for r in rows]


def get_text_cite(text_id: str, verse: str) -> dict[str, Any]:
    refs = get_text_references(text_id)
    found = [r for r in refs if (r.get("reference") or "").lower() == verse.lower()]
    if found:
        return found[0]
    return {
        "text_id": text_id,
        "reference": verse,
        "translation": "Reference not found in seeded corpus yet.",
        "commentary": "Add this verse/reference to text_references for richer commentary.",
        "citation": "",
    }


def get_study_path(user_id: str) -> dict[str, Any]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select * from study_progress
                where user_id = :user_id
                order by completed_at desc
                """
            ),
            {"user_id": user_id},
        ).all()
    completed = [dict(r._mapping) for r in rows]
    rec = recommend_study("intermediate")
    return {"completed": completed, "next_recommended": rec[:3]}


def advance_study(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    rec_id = str(uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into study_progress (id, user_id, scholar_id, text_id, level, completed_at)
                values (:id, :user_id, :scholar_id, :text_id, :level, :completed_at)
                """
            ),
            {
                "id": rec_id,
                "user_id": user_id,
                "scholar_id": payload.get("scholar_id"),
                "text_id": payload.get("text_id"),
                "level": payload.get("level") or "intermediate",
                "completed_at": datetime.utcnow(),
            },
        )
    return {"message": "study advanced", "next": recommend_study(payload.get("level") or "intermediate")[:2]}


def recommend_study(level: str) -> list[dict[str, Any]]:
    scholars = list_scholars()
    if level == "beginner":
        picks = [s for s in scholars if s["id"] in {"ptahhotep", "maimonides", "ibn_al_haytham"}]
    elif level == "advanced":
        picks = [s for s in scholars if s["id"] in {"ibn_khaldun", "ibn_rushd", "ibn_sina"}]
    else:
        picks = [s for s in scholars if s["id"] in {"alkhwarizmi", "manetho", "ibn_gabirol"}]
    return picks if picks else scholars[:3]


def create_briefing_digest(user_id: str, moment: str, focus: str | None = None) -> dict[str, Any]:
    council = convene_council(user_id, moment)
    focus_text = (focus or "").strip()
    focus_line = f"Focus: {focus_text}" if focus_text else "Focus: top current chokepoint"
    scholars = [f"{s['name']} ({s['field']})" for s in council.get("convened", [])]

    digest = {
        "moment": moment,
        "focus": focus_text or None,
        "council": scholars,
        "moves": [
            "Execute one irreversible shipping action in the first work block.",
            "Resolve one blocker before introducing new work.",
            "Close with evidence log and carry-forward note.",
        ],
        "citations": [s.get("citation_footer") for s in council.get("convened", [])],
    }

    lines = [
        f"Moment: {moment}",
        focus_line,
        "Council:",
        *[f"- {s}" for s in scholars],
        "Top Moves:",
        "- Execute one irreversible shipping action in the first work block.",
        "- Resolve one blocker before introducing new work.",
        "- Close with evidence log and carry-forward note.",
    ]
    content = "\n".join(lines)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into briefings (id, user_id, briefing_type, content, compendium_digest, created_at)
                values (:id, :user_id, :briefing_type, :content, :compendium_digest, :created_at)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "briefing_type": moment,
                "content": content,
                "compendium_digest": json.dumps(digest),
                "created_at": datetime.utcnow(),
            },
        )

    return {"content": content, "digest": digest}


def list_recent_briefings(user_id: str, limit: int = 5) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select * from briefings
                where user_id = :user_id
                order by created_at desc
                limit :limit
                """
            ),
            {"user_id": user_id, "limit": max(1, min(20, limit))},
        ).all()
    out: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row._mapping)
        item["compendium_digest"] = _json_loads(item.get("compendium_digest"), {})
        out.append(item)
    return out


def create_meal_context(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    meal_name = payload.get("meal_name") or "meal"
    ingredients = [str(i).strip().lower() for i in (payload.get("ingredients") or []) if str(i).strip()]

    plants = list_plants()
    matched: list[dict[str, Any]] = []
    for plant in plants:
        names = [plant.get("scientific_name", "").lower(), *[n.lower() for n in plant.get("common_names") or []]]
        if any(i in names for i in ingredients):
            matched.append(plant)

    historical_uses: list[dict[str, Any]] = []
    safety_flags: list[dict[str, Any]] = []
    for plant in matched:
        historical_uses.extend(get_plant_scholars(plant["id"]))
        safety_flags.extend(get_plant_safety(plant["id"]))

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into meals_today (id, user_id, meal_name, notes, historical_uses, safety_flags, created_at)
                values (:id, :user_id, :meal_name, :notes, :historical_uses, :safety_flags, :created_at)
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "meal_name": meal_name,
                "notes": payload.get("notes"),
                "historical_uses": json.dumps(historical_uses),
                "safety_flags": json.dumps(safety_flags),
                "created_at": datetime.utcnow(),
            },
        )

    return {
        "meal_name": meal_name,
        "matched_plants": [p.get("scientific_name") for p in matched],
        "historical_uses": historical_uses,
        "safety_flags": safety_flags,
    }


def list_recent_meals(user_id: str, limit: int = 5) -> list[dict[str, Any]]:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                select * from meals_today
                where user_id = :user_id
                order by created_at desc
                limit :limit
                """
            ),
            {"user_id": user_id, "limit": max(1, min(20, limit))},
        ).all()
    out: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row._mapping)
        item["historical_uses"] = _json_loads(item.get("historical_uses"), [])
        item["safety_flags"] = _json_loads(item.get("safety_flags"), [])
        out.append(item)
    return out


def comp_query(user_id: str, query: str, search_knowledge_fn) -> dict[str, Any]:
    q = (query or "").strip().lower()
    scholars = list_scholars()
    plants = list_plants()

    scholar_hits = [s for s in scholars if q and (q in s["name"].lower() or q in " ".join(s.get("fields") or []).lower() or q in (s.get("biography") or "").lower())]
    plant_hits = [p for p in plants if q and (q in (p.get("scientific_name") or "").lower() or q in " ".join(p.get("common_names") or []).lower() or q in (p.get("description") or "").lower())]

    kb_hits = search_knowledge_fn(user_id, query, limit=5)

    source_map = [
        {"type": "scholar", "id": s["id"], "title": s["name"]} for s in scholar_hits[:3]
    ] + [
        {"type": "plant", "id": p["id"], "title": p["scientific_name"]} for p in plant_hits[:3]
    ] + [
        {"type": "knowledge", "id": k["id"], "title": k["title"]} for k in kb_hits[:3]
    ]

    hit_count = len(source_map)
    confidence = "high" if hit_count >= 5 else "medium" if hit_count >= 2 else "low"

    if scholar_hits:
        lead = f"Council lens: {scholar_hits[0]['name']} suggests {scholar_hits[0].get('methodology') or 'a practical method'} for this question."
    elif plant_hits:
        lead = f"Materia medica lens: {plant_hits[0]['scientific_name']} is relevant to this topic in the compendium."
    else:
        lead = "No direct compendium match was found in seeded entries. Expand seed data or refine the query context."

    return {
        "answer": lead,
        "confidence_tier": confidence,
        "source_map": source_map,
        "suggested_follow_ups": [
            "Request a council convening for this decision context.",
            "Ask for scholar works and lineage links tied to this topic.",
            "Query plant safety and evidence tiers before actioning health recommendations.",
        ],
    }
