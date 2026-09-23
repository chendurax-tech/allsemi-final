# ALLSEMI CONTENT MASTER

Phase 1 deliverable. Research, content architecture and implementation planning only.
No production UI was modified while producing this document.

## How to read this document

- Every claim, statistic, service name or fact that is NOT already confirmed by the
  existing ALLSEMI landing page is marked `[CLIENT CONFIRMATION REQUIRED]` with a
  short note on what is needed.
- Everywhere Nexus-specific information appeared during research (their offices,
  their stats, their testimonials, their team, their case studies), it is marked
  `NEXUS-SPECIFIC - DO NOT TRANSFER` and paired with the correct ALLSEMI placeholder.
- Content drafted below is written independently for ALLSEMI. It uses Nexus only as
  a reference for what KIND of content a page needs, not as a source of wording.
- Source hierarchy followed throughout: (1) existing ALLSEMI repository and landing
  page, (2) Nexus Semiconductor as a structural/conceptual reference, (3) explicit
  client input, marked as required wherever it is missing.

---

# 01. EMPLOYERS

## Page purpose

Convert a hiring manager, HR leader or founder into a qualified enquiry. This is the
commercial front door of ALLSEMI - the page a prospective client lands on from a
LinkedIn message, a referral, or the "Employers" link in the header.

## Audience

Engineering leaders, HR/Talent Acquisition leaders, and founders at semiconductor,
automotive, aerospace, industrial and (per the existing 8-sector Expertise system)
AI infrastructure, finance, retail and healthcare technology companies who need to
hire specialist engineers.

## Hero direction

Draft positioning:
"Specialist staffing for the engineers who build modern silicon and the systems
around it."

This is a direct extension of the existing landing page's own hero line ("We connect
the engineers behind modern silicon, from architecture to tape-out...") rather than
new wording, since the landing page already establishes ALLSEMI's core voice. The
Employers page hero should narrow that same voice specifically toward the hiring
company's problem (unfilled specialist roles) rather than the general company
positioning.

Status: consistent with confirmed landing page copy. No client confirmation needed
for the direction itself, but the exact final line should be approved before use
site-wide.

## Core proposition

Draft positioning:
"We source, screen and place engineers who already understand your process node,
your stack, or your safety-critical requirements, so your team spends its time
interviewing, not sifting."

This draws on two things already confirmed on the existing landing page: the Facts
section's real stat "48h Avg. shortlist time" and the "Rapid turnaround" /
"Safety-critical hiring" reason cards. It does not borrow Nexus's specific claims
("300+ passive candidates per search", "10x the reach") since those are Nexus's own
operating metrics.

Status: usable as drafted, built from confirmed existing copy.

## Services

The existing ALLSEMI landing page already confirms exactly three service lines, and
these should remain the spine of the Employers page:

### Permanent Staffing
Draft positioning:
"Find the right full-time talent for your semiconductor, chip design, automotive, or
aerospace teams. We source, screen, and place top engineers who stay and grow with
your organization." (existing, confirmed copy from Services.jsx)

Status: CONFIRMED (already live).

### Project Staffing
Draft positioning:
"Scale your team on-demand with highly skilled contract engineers for specific
projects. From VLSI design to embedded systems, we provide experts exactly when you
need them." (existing, confirmed copy from Services.jsx)

Status: CONFIRMED (already live).

### RPO Solution
Draft positioning:
"Outsource your entire recruitment process to Allsemi. Our Recruitment Process
Outsourcing (RPO) solution delivers a dedicated hiring engine tailored to your talent
acquisition needs." (existing, confirmed copy from Services.jsx)

Status: CONFIRMED (already live).

Nexus additionally documents Retained search, Embedded/Fractional recruiting, and a
dedicated Start-Ups & Scale-Ups model as separate engagement types. These are
genuinely useful CONCEPTS (a client may want to understand ALLSEMI offers something
similar), but ALLSEMI has not confirmed it offers these as distinct services.

Executive/retained search
Draft positioning (if confirmed):
"Confidential, director-led search for senior and executive engineering leadership
hires."

Status: `[CLIENT CONFIRMATION REQUIRED]`
Need: does ALLSEMI offer a distinct executive/retained search product, or is this
folded into Permanent Staffing today?

Embedded/fractional recruiting
Draft positioning (if confirmed):
"An ALLSEMI recruiter working inside your team on your systems, scaling with your
hiring volume."

Status: `[CLIENT CONFIRMATION REQUIRED]`
Need: confirm whether this is an actual ALLSEMI offering or should be left out.

Start-up/scale-up hiring
Draft positioning (if confirmed):
"Founding engineers and first commercial hires for venture-backed teams, shaped
around an early-stage budget."

Status: `[CLIENT CONFIRMATION REQUIRED]`
Need: confirm whether ALLSEMI has a distinct early-stage/start-up offering, or
whether this should not be presented as a separate line.

## Hiring process

Draft positioning (structure only, not claims):
A simple 3 to 4 step visual explainer: Brief -> Search -> Shortlist -> Hire. The
existing Enquiry component already implies a lightweight intake ("Hire talent",
routed as `RCT-01`), so the Employers page process explainer should describe what
actually happens between that intake and a placement.

Status: structure only. `[CLIENT CONFIRMATION REQUIRED]` for the specific step
names, typical timelines per step (e.g. Nexus states "2 weeks to first shortlist",
which is NEXUS-SPECIFIC - DO NOT TRANSFER -> `[CLIENT ALLSEMI TIMELINE REQUIRED]`),
and whether ALLSEMI wants to publish typical timelines at all.

## Differentiators

The existing Facts section already confirms five real differentiator statements that
can be reused directly:
- Deep network (semiconductor and VLSI chip design engineers)
- Domain expertise (chip design, automotive, aerospace)
- Safety-critical hiring
- Rapid turnaround (48 to 72 hours to shortlist)
- End-to-end managed staffing with dedicated account managers

Status: CONFIRMED (already live, from Facts.jsx). These should be the primary
differentiator content on the Employers page rather than inventing new ones.

## Supporting content

- Real stats block, reusing the existing confirmed numbers: 100+ Engineers placed,
  10+ Clients served, 95% Retention rate, 48h Avg. shortlist time. Status: CONFIRMED.
- Sector coverage, linking to the existing 8-sector Expertise experience (see
  Section 03). Status: CONFIRMED.
- Client testimonials. Status: `[CLIENT ALLSEMI TESTIMONIAL REQUIRED]`
  Need: client/company name (or permission to anonymize, as the current landing
  page testimonials already do), approved quote, person's name and title, and
  written permission to publish.
- Client/partner logos. Status: `[CLIENT PARTNER/CLIENT LOGOS REQUIRED]`
  Need: logo files, and written permission to display each one publicly.
- Case studies. Status: `[CLIENT CASE STUDY REQUIRED]`
  Need: client name (or anonymized description as currently used, e.g. "Leading
  chip design firm"), the role(s) filled, the challenge, the outcome, and
  permission to publish. Nexus's own case studies (Lavorro, the Houston power
  semiconductor start-up, the Texas Instruments partnership) are NEXUS-SPECIFIC -
  DO NOT TRANSFER.

## CTA

Primary: "Hire Talent" -> routes into the existing Enquiry experience at the
`hire` path (`RCT-01`, already built). Status: CONFIRMED, this wiring already
exists and should be reused, not rebuilt.

## Potential creative/interaction ideas

CONTENT IDEA: Frame the hiring process as a "signal path" from brief to placement,
using the same REF-code convention already established in the Enquiry component
(`RCT-01`, `RCT-02`, `RCT-03`) so a client sees their own enquiry become a
numbered, trackable reference the moment they submit it.

VISUAL IDEA: A horizontal process diagram styled like the engineering title-block
language already used in the Enquiry panel and the Facts stat table, with each
stage as a labeled node rather than a generic numbered card.

INTERACTION IDEA: As the visitor scrolls past each process stage, a thin accent
rule draws in beneath it, reusing the exact `expertise-band-rule-in` /
`expertise-rule-draw` animation pattern already built for the Expertise section, so
the interaction language stays consistent with the rest of the site rather than
introducing a new motion system.

---

# 02. TALENT

## Page purpose

Convert an engineer, technician or engineering leader into either an application
for a specific role or a talent-community signup. This is the candidate-facing
counterpart to the Employers page.

## Candidate proposition

Draft positioning:
"Confidential conversations with people who understand the role you do today, not
a keyword match against a database."

Built from the existing landing page's own register (technical, direct, no
generic staffing-agency language) rather than adapted from Nexus wording.

Status: usable as drafted, consistent with confirmed site voice.

## Job search experience

Nexus's job board (55 open roles at time of research, filterable by specialism,
location, job type, on-site/remote, each card showing title, location, salary
band, posted date and a reference number) is useful STRUCTURE research, but
ALLSEMI has no live job data today.

Do NOT copy Nexus's listed roles, locations or salary figures - these are
NEXUS-SPECIFIC (real US roles at real companies) and must never appear as if they
are ALLSEMI vacancies.

Proposed placeholder experience:
`[CLIENT JOB DATA REQUIRED]`
Need: a live feed or manually maintained list of real, current ALLSEMI/client
vacancies (title, location, sector, employment type, a short role summary, and a
reference code). Until that exists, the Talent page should present a polished
"talent community" experience (see below) as the primary path, with a clearly
labeled "no open roles listed yet, join the talent community" state rather than
an empty or broken job board.

Suggested UI/content structure once job data exists: filter bar scoped to the
existing 8 Expertise sectors (reusing `SECTORS` as the filter taxonomy, so Talent
and Expertise share one source of truth rather than a second, divergent list),
each job card in the existing card visual language (number, title, one-line
description, thin accent rule), and a detail view that reuses the Enquiry
component's `role` path (`RCT-02`) as the application mechanism.

## Talent community / profile submission

Draft positioning:
"Not seeing the right role today? Join the ALLSEMI talent community and we will
reach out when a match opens."

This is a legitimate, low-risk feature to build now (it does not depend on live
job data) and mirrors a pattern Nexus also uses, but the specific commitments
(e.g. how quickly ALLSEMI will respond, what happens to submitted data) require
sign-off.

Status: `[CLIENT CONFIRMATION REQUIRED]`
Need: confirm data-retention/consent wording for storing a candidate's details
without an active application, and confirm whether resume/CV upload is available
now or a later phase (this affects the Enquiry form's `extraType` field, which
today is plain text or textarea only, not file upload).

## Candidate journey

Draft flow: Talent page -> (live role or talent-community path) -> Enquiry
component's `role` path (`RCT-02`, already built: name, email, "current role or
background") -> confirmation state (already built, reuses the existing success
screen).

Status: the mechanism already exists and should be reused, not rebuilt.

## Job categories

Reuse the existing 8-sector `SECTORS` taxonomy exactly as already defined (see
Section 03), rather than introducing a separate job-category list. This keeps
Expertise and Talent using one shared source of truth, consistent with how
`SECTORS` is already imported into both `Header.jsx` and `Expertise.jsx` /
`ExpertiseBands.jsx` today.

Status: CONFIRMED as a structural decision (reusing existing data), not a new
content commitment.

## Application experience

Draft structure: role summary, "what you will do" and "what we are looking for"
sections, then a single CTA into the Enquiry `role` path rather than a separate,
parallel application form. Building a second form system would fragment the
enquiry experience the site already has.

Status: structure only. `[CLIENT JOB DATA REQUIRED]` for actual role content.

## CTA

Primary: "Search Jobs" -> Talent page. Secondary, once no matching role exists:
"Join the talent community" -> Enquiry `role` path.

## Creative interaction ideas

CONTENT IDEA: Present the talent-community signup as joining a "signal", echoing
the site's existing semiconductor-documentation visual language (the same
register as "REF 06", the alignment-cross corner marks, and the Enquiry panel's
spec-row layout) rather than a generic "subscribe" box.

VISUAL IDEA: Job cards that reuse the exact bespoke-diagram system already built
for the 8 Expertise sectors (wafer map, layer stack, signal routing, orbital
pattern, BGA grid) as a small per-sector marker on each job card, so a candidate
instantly recognizes which of the 8 sectors a role belongs to without reading the
title first.

INTERACTION IDEA: Filtering the job list by sector could visually echo the
Expertise section's own grayscale-to-color activation: the selected sector's
marker colorizes while others dim, reusing the same CSS transition already built
for `ExpertiseBands.jsx` rather than a generic dropdown filter.

## Client-required information

- `[CLIENT JOB DATA REQUIRED]` (see above)
- `[CLIENT CONFIRMATION REQUIRED]` on resume/CV upload capability and data
  retention/consent wording

---

# 03. EXPERTISE

The existing ALLSEMI landing page already confirms all 8 sectors, their order,
numbering, names, and current placeholder descriptions (from `Expertise.jsx`'s
`SECTORS` array). Each sector below documents what already exists and what a
dedicated sector page would add.

Nexus's own specialism structure (for example, on the Semiconductors page: an
"Our approach" 4-pillar grid, a "Fields we specialize in" tag list, and a "Key
Roles We Recruit" list, covering areas such as Analog/Mixed-Signal, Digital/ASIC,
High-Speed Connectivity, Power Semiconductors, Memory & Storage, RISC-V & Custom
Processors, Quantum Computing, Semiconductor Manufacturing, and Verification &
Test) is used below strictly as a RESEARCH INPUT for what a sector page could
contain, not as an ALLSEMI claim.

## 01. Semiconductor & Chip Engineering

Sector positioning (existing, confirmed):
"RTL to tape-out - the engineers who design and verify modern silicon."
(from `Expertise.jsx`)

Short introduction (draft, extending confirmed copy):
"From architecture through verification to tape-out, semiconductor design is the
sector ALLSEMI was built around."

Relevant technical/business domains (Nexus research input, NOT an ALLSEMI claim
until confirmed): analog/mixed-signal, digital/ASIC design, RTL, verification,
physical design, packaging, process/fab engineering, test.
Status: `[CLIENT CONFIRMATION REQUIRED]` on which of these ALLSEMI actually
covers today.

Possible role categories (research input): RTL design engineer, verification
engineer, physical design engineer, ASIC design engineer, packaging engineer,
process engineer.
Status: `[CLIENT CONFIRMATION REQUIRED]`

Hiring challenges (draft, generic to the sector, not an ALLSEMI-specific claim):
a small, senior talent pool; long, specialized ramp time; most strong candidates
are already employed and not actively job-searching.

Talent categories: individual contributor through senior/staff engineer, and
(if confirmed as an ALLSEMI service, see Section 01) engineering leadership.

Supporting content: this is the one sector where the site's own `ChipSequence`
component (the 50-frame assembled/exploded/die-revealed/reassembled animation)
already exists and is the strongest possible visual asset - a dedicated sector
page should reuse it rather than building a new hero animation.

Visual/graphic opportunity: the existing `ExpertiseVisuals.jsx` wafer-map diagram
(already built, currently unused in the live rail/panel Expertise fallback) is a
ready-made asset for this exact sector page.

CTA: "Hire for Semiconductor & Chip Engineering" (Employers path) / "See
Semiconductor roles" (Talent path, pending job data).

Client confirmation requirements: domain list, role list, and whether any
process-node or technology specificity should be stated publicly.

## 02. AI Infrastructure & Cloud

Sector positioning (existing, confirmed):
"The infrastructure and systems engineering behind large-scale compute."
(from `Expertise.jsx`)

Short introduction (draft): "The systems, silicon and infrastructure engineering
that large-scale AI compute depends on."

Relevant domains (research input, not confirmed): AI accelerator architecture,
data center infrastructure, ML systems/compiler engineering, cloud
infrastructure engineering.
Status: `[CLIENT CONFIRMATION REQUIRED]`

Possible role categories: infrastructure engineer, ML systems engineer, data
center operations engineer, AI hardware architect.
Status: `[CLIENT CONFIRMATION REQUIRED]`

Hiring challenges (generic, draft): extremely high demand across the industry
for a small pool of infrastructure-at-scale engineers.

Visual/graphic opportunity: the existing `ExpertiseBands.jsx` treatment already
uses a data-center-corridor photograph for this sector; a dedicated page could
extend this with the same bespoke-diagram system used elsewhere (a rack/topology
line diagram, matching the restrained technical-drawing style already
established).

CTA: as above, scoped to this sector.

Client confirmation requirements: domain and role lists; confirm scope (is this
AI silicon, data-center infrastructure, or both).

## 03. Automotive & Mobility

Sector positioning (existing, confirmed):
"Electronics and embedded engineering for the vehicles being built today."
(from `Expertise.jsx`)

Short introduction (draft): "The embedded and electronics engineering inside
modern vehicles, from sensor to system."

The existing Stories section already contains one relevant, confirmed reference
point: a testimonial about "ADAS and functional safety engineers", though the
testimonial itself is written in a placeholder/anonymized style and is flagged
in Section 06 below.

Relevant domains (research input): ADAS, functional safety, embedded software,
sensor fusion, power electronics for EV.
Status: `[CLIENT CONFIRMATION REQUIRED]`

Possible role categories: ADAS engineer, functional safety engineer, embedded
software engineer, automotive power electronics engineer.
Status: `[CLIENT CONFIRMATION REQUIRED]`

CTA: as above, scoped to this sector.

Client confirmation requirements: domain and role lists; confirm functional
safety standard familiarity (e.g. ISO 26262) if ALLSEMI wants to state this
publicly - not currently confirmed anywhere in the repository.

## 04. Aerospace & Communications

Sector positioning (existing, confirmed):
"Precision hardware and systems engineering for aerospace and comms."
(from `Expertise.jsx`)

Short introduction (draft): "Precision hardware and systems engineering for
aerospace, satellite and communications programs."

Relevant domains (research input): RF/microwave engineering, satellite
communications, avionics, precision hardware engineering.
Status: `[CLIENT CONFIRMATION REQUIRED]`

Possible role categories: RF engineer, systems engineer, avionics engineer,
hardware engineer.
Status: `[CLIENT CONFIRMATION REQUIRED]`

CTA: as above, scoped to this sector.

Client confirmation requirements: domain and role lists; confirm whether ALLSEMI
handles any export-control-sensitive placements and what that implies for public
copy (a genuine sensitivity in this sector, worth a direct answer rather than an
assumption).

## 05. Business, Finance & Consumer

Sector positioning (existing, confirmed):
"Commercial and operational talent across consumer-facing technology."
(from `Expertise.jsx`)

Short introduction (draft): "Commercial, operational and go-to-market talent for
technology companies building consumer-facing products."

Relevant domains (research input): sales, business operations, product
management, go-to-market for hardware-adjacent consumer technology.
Status: `[CLIENT CONFIRMATION REQUIRED]`

Possible role categories: account manager, business operations lead, product
manager.
Status: `[CLIENT CONFIRMATION REQUIRED]`

CTA: as above, scoped to this sector.

Client confirmation requirements: this sector is the least technically specific
of the 8, and the client should confirm what specifically differentiates it from
Section 06 (Banking, Finance & FinTech) in ALLSEMI's own positioning, since both
currently use similar "business/finance" language.

## 06. Banking, Finance & FinTech

Sector positioning (existing, confirmed):
"Engineering talent behind modern payment and financial infrastructure."
(from `Expertise.jsx`)

Short introduction (draft): "The engineering talent behind modern payment
systems and financial infrastructure, not general finance hiring."

Relevant domains (research input): payments infrastructure, financial
technology systems engineering, security/cryptography for financial systems.
Status: `[CLIENT CONFIRMATION REQUIRED]`

Possible role categories: payments infrastructure engineer, fintech systems
engineer, security engineer.
Status: `[CLIENT CONFIRMATION REQUIRED]`

CTA: as above, scoped to this sector.

Client confirmation requirements: domain and role lists; as above, confirm the
distinction from Section 05 in ALLSEMI's own terms.

## 07. Consumer Goods & Retail

Sector positioning (existing, confirmed):
"Precision manufacturing and engineering talent for consumer products."
(from `Expertise.jsx`)

Short introduction (draft): "Precision manufacturing and product engineering
talent for consumer goods and retail technology."

Relevant domains (research input): manufacturing/production engineering,
consumer electronics product engineering, supply chain engineering.
Status: `[CLIENT CONFIRMATION REQUIRED]`

Possible role categories: manufacturing engineer, product engineer, quality
engineer.
Status: `[CLIENT CONFIRMATION REQUIRED]`

CTA: as above, scoped to this sector.

Client confirmation requirements: domain and role lists.

## 08. Healthcare & Medical Technology

Sector positioning (existing, confirmed):
"Engineering talent for medical devices and diagnostic technology."
(from `Expertise.jsx`)

Short introduction (draft): "Engineering talent for medical devices and
diagnostic technology, where regulatory precision matters as much as technical
skill."

Relevant domains (research input): medical device engineering, diagnostic
equipment engineering, regulatory/quality engineering (e.g. FDA/ISO 13485
familiarity).
Status: `[CLIENT CONFIRMATION REQUIRED]`

Possible role categories: medical device engineer, diagnostic systems engineer,
regulatory/quality engineer.
Status: `[CLIENT CONFIRMATION REQUIRED]`

CTA: as above, scoped to this sector.

Client confirmation requirements: domain and role lists; confirm whether ALLSEMI
wants to state specific regulatory-standard familiarity publicly.

## Cross-sector notes

Supporting content across all 8 sectors: real placed-candidate examples, sector-
specific stats, or sector-specific testimonials would materially strengthen every
one of the pages above.
Status: `[CLIENT ALLSEMI STATISTICS REQUIRED]` and `[CLIENT ALLSEMI TESTIMONIAL
REQUIRED]` per sector, if available.

Visual/graphic opportunity, site-wide: the existing bespoke SVG diagram system
already built in `ExpertiseVisuals.jsx` (wafer map, layer stack, signal routing,
orbital/RF pattern, BGA grid) is the strongest reusable visual asset for
individual sector pages and should be extended rather than replaced with
photography-only treatment, since it is the site's only fully original (not
stock-photo-derived) visual system.

---

# 04. INSIGHTS

## Page purpose

Build search-engine and referral traffic, demonstrate genuine industry knowledge,
and give the Enquiry funnel a top-of-funnel entry point that is not a direct
sales page.

## Article categories

Proposed categories (not established facts, drafted with the existing ALLSEMI
sector language in mind rather than copied from Nexus's own category names,
which were Hiring & HR, Candidates, State & City Guides, Industry, and Nexus
News):

- INDUSTRY - market and technology notes across the 8 sectors
- ENGINEERING - technical hiring notes (what "good" looks like for a given role)
- TALENT - candidate-facing career and interview guidance
- HIRING - employer-facing hiring-process guidance
- ALLSEMI - company news and announcements

Status: proposed structure, `[CLIENT CONFIRMATION REQUIRED]` on final category
names and whether all five are needed at launch.

## Editorial structure

Standard structure: category label, headline, one-line summary, publish date,
estimated read time, hero image, byline (optional). This mirrors what both the
existing landing page's Insights teaser section already implies (category label
+ headline pattern, already built in `Insights.jsx`) and what Nexus's own
article-card pattern uses structurally.

## Article listing

A featured article (large card) plus a standard grid of remaining articles,
directly extending the layout already built in the existing `Insights.jsx`
(one large `lg:row-span-2` card plus two smaller cards) rather than a new grid
system. Category filtering (via the five proposed categories above) should sit
above the grid.

## Article detail structure

Category label, headline, byline/date/read-time, hero image, body copy in the
site's existing typography system, a "related expertise sector" link (tying back
into Section 03), and an Enquiry CTA at the close of the article.

## Featured insight

The homepage/Insights-index featured slot should always show the single most
recent or most strategically important article, using the same large-card
treatment already built.

## Filters/categories

Useful once more than roughly 8 to 10 articles exist; not necessary at launch
with a small initial article set.

## Future content strategy

Draft recommendation: launch with a small number of genuinely useful,
ALLSEMI-authored pieces (for example, one per Expertise sector introducing how
ALLSEMI thinks about hiring in that space) rather than a large volume of thin
content. Nexus's own city/relocation-guide format is a useful CONCEPT (long-form,
practically useful, not sales-y) but should not be copied - if ALLSEMI wants a
similar format, it needs to be about locations and situations genuinely relevant
to ALLSEMI's own candidate base.

Status: `[CLIENT CONFIRMATION REQUIRED]` on content strategy and cadence, and
`[CLIENT CONTENT REQUIRED]` for the first batch of real articles.

## Client content requirements

- `[CLIENT CONTENT REQUIRED]`: first set of real, ALLSEMI-authored articles
  (minimum needed to avoid an empty page: 3 to 4 articles, one of which should be
  a company-introduction piece).
- Until real articles exist, the Insights page should show a polished "coming
  soon" / "in progress" state rather than a broken or empty grid - the existing
  landing page's Insights teaser cards currently link to `#insights` (themselves,
  a placeholder), which should be replaced with real article links once content
  exists, not left as self-referential links on the eventual dedicated page.

---

# 05. ABOUT ALLSEMI

## Company story

Nothing about ALLSEMI's founding, history, or origin is documented anywhere in
the existing repository.

Status: `[CLIENT INPUT REQUIRED]`
Need: when ALLSEMI was founded, by whom, and why (the "why we started" narrative
Nexus uses on their own About page is a useful CONCEPT - a specific, credible
founding story - but Nexus's own story, being founded in 2024 by people who
previously hired inside semiconductor companies, is NEXUS-SPECIFIC - DO NOT
TRANSFER).

## Positioning

Draft positioning, built only from what the landing page already confirms:
"ALLSEMI is a specialist staffing partner for semiconductor, VLSI, and advanced
engineering talent, engineered around technical depth rather than volume."

This draws on the confirmed hero line ("Talent. Engineered.") and the confirmed
Facts section copy ("With deep domain expertise in semiconductor and advanced
engineering sectors, we go beyond traditional recruiting.").

Status: usable as drafted.

## Philosophy

The existing Connecting section already states a genuine, confirmed philosophy
line: "Our focus stays simple: put the right engineer in front of the right
team, quickly and without the noise." This should anchor the About page's
philosophy section directly rather than be replaced with new wording.

Status: CONFIRMED (already live, from `Connecting.jsx`).

## Values

Nothing beyond the Facts section's five reason statements (Deep network, Domain
expertise, Safety-critical hiring, Rapid turnaround, End-to-end managed) is
currently framed as a "values" statement, though they function as one.

Status: usable as a starting point, but `[CLIENT INPUT REQUIRED]` if ALLSEMI
wants a distinct values statement separate from the existing "why ALLSEMI"
reasons (Nexus's own four-pillar "Accountability / Innovation / Agility / Speed &
Precision" framing is a useful CONCEPT for how to structure a values section, but
the specific pillar names and claims are NEXUS-SPECIFIC - DO NOT TRANSFER).

## Approach

Draft positioning, extending confirmed copy:
"We combine deep domain expertise in semiconductor and advanced engineering
sectors with a screening process built around understanding the technology, not
just matching keywords."

Status: usable as drafted, built from confirmed Facts-section copy.

## Team

Status: `[CLIENT TEAM DATA REQUIRED]`
Need: team member names, titles, short bios, headshots, and permission to
publish. Nexus's own team page (named individuals, years of experience, areas
of focus, small "backed by a team" photo strips) is a useful STRUCTURAL
reference, but every name and bio shown there is NEXUS-SPECIFIC - DO NOT
TRANSFER.

## Facts/statistics

The existing Facts section already confirms four real, usable statistics: 100+
Engineers placed, 10+ Clients served, 95% Retention rate, 48h Avg. shortlist
time.

Status: CONFIRMED (already live, from `Facts.jsx`). These should be the About
page's stat block. Nexus's own stats (100k+ candidates mapped, 6-month placement
guarantee, "3 Regions, one team", the Google-rating badge, the "2026
Semiconductor Review Top Talent Service Provider" award, "#1 on Google in the
US") are all NEXUS-SPECIFIC - DO NOT TRANSFER -> `[CLIENT ALLSEMI STATISTICS
REQUIRED]` and `[CLIENT ALLSEMI AWARD/RECOGNITION REQUIRED]` if ALLSEMI has
comparable, real recognition to publish.

## Locations

The existing Enquiry component already confirms exactly one real, live ALLSEMI
location: No.73, Nallurahalli, Whitefield, Bangalore South, Karnataka 560066,
with a `+91-70901-23400` phone number and `sales@allsemi.com` email.

Status: CONFIRMED (already live, from `Enquiry.jsx`). This is the only office
that should be shown anywhere. Nexus's three offices (Austin TX, London UK,
Manila PH) are NEXUS-SPECIFIC - DO NOT TRANSFER -> if ALLSEMI has any additional
real locations beyond Bangalore, `[CLIENT ALLSEMI LOCATIONS REQUIRED]`. Per the
earlier design-review phase of this project, ALLSEMI has explicitly chosen not
to claim European/UK/global office presence it does not have, and this document
follows that same instruction: do not imply additional offices anywhere.

## Proof

Covered under Supporting content in Section 01 and Section 03: testimonials,
case studies, and client logos. All require `[CLIENT ALLSEMI TESTIMONIAL
REQUIRED]` / `[CLIENT ALLSEMI CASE STUDY REQUIRED]` / `[CLIENT PARTNER/CLIENT
LOGOS REQUIRED]` as detailed there.

## CTA

Primary: "Get in Touch" -> Enquiry `general` path (`RCT-03`, already built).

## Creative direction

CONTENT IDEA: A short "why ALLSEMI" statement structured the same way the site's
own logo/name could be explained (Nexus does this effectively with their own
mark), but only once ALLSEMI's own naming rationale is confirmed by the client -
this should not be invented.
Status: `[CLIENT INPUT REQUIRED]` on whether ALLSEMI's own name/mark has a
story worth telling this way; if not, this idea should be dropped rather than
forced.

VISUAL IDEA: A large-format typographic statement using the same reactive-letter
system already built for the Connecting section's headline (`useReactiveLetters`,
already live), reused here to introduce ALLSEMI's philosophy line, rather than a
generic About-page hero photo.

INTERACTION IDEA: Team member cards that use the same restrained
grayscale-to-color hover treatment as the Expertise sectors, applied to
headshots once real team photography exists, keeping the interaction language
consistent site-wide rather than introducing a new "team card" pattern.

---

# 06. GET IN TOUCH

The existing `Enquiry.jsx` component already implements a substantial, working
progressive enquiry experience which should be preserved and extended, not
replaced. Below documents what exists and what a dedicated Get in Touch page
adds.

## Existing, confirmed experience

- Three paths, already built: `hire` (RCT-01, "Hire talent" - Permanent, contract,
  or RPO solutions), `role` (RCT-02, "Find my next role" - Semiconductor, chip
  design, or engineering), `general` (RCT-03, "General enquiry" - Partnerships,
  press, or anything else).
- Three-step progressive flow, already built: Route -> Identity (name) -> Contact
  (email + one path-specific field, either text or a textarea).
- Typewriter-revealed "REF 06" opener and "How can we help you?" heading, already
  built and explicitly preserved per prior project instructions.
- Validation already built: name >= 2 characters, standard email pattern, the
  path-specific field >= 2 characters.
- Success state already built: confirmation message, "We'll be in touch within
  one business day," and a "Submit another" reset.
- Real, confirmed contact information already built: the Bangalore office
  address, `+91-70901-23400`, `sales@allsemi.com`, and stated hours (Mon-Fri,
  9:00 AM to 6:30 PM IST / Mon-Fri, 8:30 PM to 6:00 AM EST).

Status: CONFIRMED (already live). A dedicated Get in Touch page should embed
this exact component rather than rebuild a parallel form.

## Potential additional paths

Nexus's own intake question ("I'm looking to: Hire Talent / Search for Jobs /
Learn More about Nexus / Other Inquiry") maps closely to ALLSEMI's existing three
paths, with one addition worth considering: a distinct "Partnership" path,
separate from "General enquiry", for vendor/partner outreach rather than press
or candidate-adjacent messages.

Status: `[CLIENT CONFIRMATION REQUIRED]`
Need: does ALLSEMI want a fourth, distinct `partnership` path (its own `RCT-04`
code, its own routing), or should partnership enquiries continue to fall under
General enquiry as they do today?

## First question / progressive fields

Already defined per path (see above). If a `partnership` path is added, it would
need its own first-step label and its own path-specific field (for example,
"Partnership type" or "Company").

Status: `[CLIENT CONFIRMATION REQUIRED]` only if the new path is approved.

## Employer fields

Currently: name, work email, company (text). Nexus's own employer intake
additionally asks for hiring timeline, and (further into their flow) role
seniority and location - useful CONCEPTS for a more qualified lead, but adding
fields increases friction, and the existing ALLSEMI flow is deliberately short
(3 steps). Any additional field is a scope decision, not a content gap.

Status: `[CLIENT CONFIRMATION REQUIRED]`
Need: does ALLSEMI want a longer, more qualifying employer intake (closer to
Nexus's multi-step version), or should the current 3-step flow remain as-is.

## Candidate fields

Currently: name, personal email, current role or background (text). Resume/CV
upload is not currently implemented.

Status: `[CLIENT CONFIRMATION REQUIRED]` on whether resume/CV upload should be
added (this is a genuine build item, not just a content gap, since the current
form has no file-upload field type).

## Contact fields

Currently: email only (no phone number field in the form itself, though the
office's own phone number is displayed for the visitor to call directly).

Status: usable as-is. `[CLIENT CONFIRMATION REQUIRED]` only if a phone field
should be added to the form.

## File upload requirements

Not currently built. See Candidate fields above.
Status: `[CLIENT CONFIRMATION REQUIRED]`

## Success state

Already built and confirmed (see above). No changes proposed unless the client
wants a different promised response time than "within one business day."
Status: CONFIRMED, `[CLIENT CONFIRMATION REQUIRED]` only if the response-time
promise should change.

## Validation requirements

Already built and confirmed (see above). Sufficient for the current 3 fields per
path; would need extension only if new fields are added.

## Client contact information requirements

Fully confirmed already (Bangalore address, phone, email, hours). No gap here.
Any additional office would require `[CLIENT ALLSEMI LOCATIONS REQUIRED]` as
noted in Section 05.

## Creative direction

CONTENT IDEA: If a fourth `partnership` path is approved, give it its own
REF-code (`RCT-04`) and its own short descriptive line, continuing the existing
numbering convention exactly rather than inventing a new labeling system.

VISUAL IDEA: The existing two-panel layout (light form panel / dark spec-readout
panel) is strong and should extend to a dedicated Get in Touch page unchanged -
the "engineering datasheet" visual language (alignment-cross corner marks, the
LOCATION/PHONE/EMAIL/HOURS spec-row treatment) is one of the site's most
distinctive elements and should not be diluted with a generic contact-page
layout.

INTERACTION IDEA: The existing single-pass inspection sweep already built for
this panel (per prior project phases) should remain the page's signature motion
moment; no new animation is needed here.

---

# GLOBAL CLIENT-SPECIFIC PLACEHOLDER SYSTEM

This section consolidates every placeholder tag used above with what is needed,
for quick reference. Nothing here duplicates content - it exists purely as an
index into the sections above.

`[CLIENT CONFIRMATION REQUIRED]`
Used for: unconfirmed service lines (executive/retained search, embedded
recruiting, start-up hiring), hiring-process step names and timelines, sector
domain/role lists across all 8 Expertise sectors, Insights category names and
content strategy, About page values framing, a possible fourth Enquiry path,
employer/candidate field scope, and response-time promises.
Need (general pattern): a direct answer from ALLSEMI on whether the drafted
concept is accurate, and if so, the specific wording to publish.

`[CLIENT ALLSEMI TESTIMONIAL REQUIRED]`
Used for: Employers page proof content, per-sector Expertise testimonials.
Need: client/company name or agreed anonymization, an approved quote, the
person's name and title, and written permission to publish.

`[CLIENT ALLSEMI CASE STUDY REQUIRED]`
Used for: Employers page proof content, per-sector Expertise supporting content.
Need: client name or agreed anonymization, the role(s) filled, the challenge,
the outcome, and written permission to publish.

`[CLIENT PARTNER/CLIENT LOGOS REQUIRED]`
Used for: Employers page supporting content.
Need: logo files and written permission to display each one publicly.

`[CLIENT JOB DATA REQUIRED]`
Used for: the entire Talent page job-listing experience.
Need: a live feed or maintained list of real, current vacancies (title,
location, sector, employment type, summary, reference code).

`[CLIENT CONTENT REQUIRED]`
Used for: Insights page launch content.
Need: a first batch of real, ALLSEMI-authored articles (minimum 3 to 4).

`[CLIENT INPUT REQUIRED]`
Used for: About page founding story, naming rationale, values framing.
Need: the actual history and reasoning from ALLSEMI, not a drafted assumption.

`[CLIENT TEAM DATA REQUIRED]`
Used for: About page team section.
Need: names, titles, short bios, headshots, and permission to publish.

`[CLIENT ALLSEMI STATISTICS REQUIRED]`
Used for: any statistic beyond the four already confirmed (100+, 10+, 95%, 48h),
including per-sector stats and any awards/recognition.
Need: the real number and a source/date if it should be publicly stated.

`[CLIENT ALLSEMI LOCATIONS REQUIRED]`
Used for: any office beyond the confirmed Bangalore address.
Need: confirm whether any additional real location exists; per current project
direction, ALLSEMI has chosen not to claim office presence it does not have, so
this tag should only ever be resolved with a genuinely real address.

`[CLIENT ALLSEMI TIMELINE REQUIRED]`
Used for: any specific hiring-process timeline claim (e.g. "X weeks to
shortlist") beyond the already-confirmed "48h Avg. shortlist time" stat.
Need: the real, current figure, if ALLSEMI wants to publish one.

---

# NEXUS-SPECIFIC INFORMATION - DO NOT TRANSFER

Consolidated list of everything encountered during Nexus research that must
never be presented as ALLSEMI fact:

- Nexus's three office locations (Austin TX, London UK, Manila PH), phone
  numbers and email addresses -> `[CLIENT ALLSEMI LOCATIONS REQUIRED]` /
  `[CLIENT ALLSEMI CONTACT DETAILS REQUIRED]` (ALLSEMI's own Bangalore details
  are already confirmed and should be used instead).
- Nexus's statistics: "100k+ candidates mapped", "6 months placement guarantee",
  "3 Regions, one team", "300+ passive candidates per search", "10x the reach",
  "77% of clients engage us exclusively", Google rating badge, "2026
  Semiconductor Review Top Talent Service Provider" award, "#1 on Google in the
  US for semiconductor recruitment" -> `[CLIENT ALLSEMI STATISTICS REQUIRED]` /
  `[CLIENT ALLSEMI AWARD/RECOGNITION REQUIRED]`.
- Nexus's testimonials (Tim at Ideal Power, DeeDee at Cirrus Logic, and the
  anonymized Houston power semiconductor start-up board director quote) ->
  `[CLIENT ALLSEMI TESTIMONIAL REQUIRED]`.
- Nexus's case studies (Lavorro AI/ML leadership hires, the Houston power
  semiconductor start-up build-out, the Texas Instruments Lehi partnership) ->
  `[CLIENT ALLSEMI CASE STUDY REQUIRED]`.
- Nexus's live job listings (all specific roles, companies, locations and
  salary figures seen on their Search Jobs page) -> `[CLIENT JOB DATA REQUIRED]`.
- Nexus's founding story (founded 2024, by people who previously hired inside
  semiconductor companies), mission statement, name-origin explainer, and logo
  meaning -> `[CLIENT INPUT REQUIRED]` (ALLSEMI's own story, if and when
  provided).
- Nexus's team (Luke Hickson, Terry Porter, Tom Poole, Justine Slough and the
  wider team shown on their About/Team pages), including years of experience
  and bios -> `[CLIENT TEAM DATA REQUIRED]`.
- Nexus's specific engagement-model numbers (e.g. "45 day candidate guarantee",
  "2 weeks to first shortlist", "Week 1 live on your reqs") -> `[CLIENT ALLSEMI
  TIMELINE REQUIRED]`.
- Nexus's FAQ answers (specific guarantee lengths, specific fee-structure
  claims, specific regional coverage claims) -> not transferable; if ALLSEMI
  wants a comparable FAQ section, each answer needs its own confirmed ALLSEMI
  fact.

---

# PAGE RELATIONSHIPS

Employers
-> Get in Touch (hire path, RCT-01)
-> Expertise (browse sector coverage)
  -> relevant sector page
    -> Get in Touch (hire path, pre-scoped to that sector if the enquiry form
       is extended to carry sector context)
-> Insights (hiring-guidance articles, once they exist)

Talent
-> Expertise (browse sector to find relevant roles once job data exists)
-> Job detail (once job data exists)
  -> Get in Touch (role path, RCT-02)
-> Talent community signup (fallback when no matching role exists)
  -> Get in Touch (role path, RCT-02)

Expertise
-> sector page
  -> Employers (hire for this sector)
  -> Talent (find roles in this sector, once job data exists)
  -> Insights (sector-relevant articles, once they exist)

Insights
-> article detail
  -> related Expertise sector
  -> Get in Touch (general path, RCT-03, or the relevant path if the article is
     clearly employer- or candidate-facing)

About ALLSEMI
-> Expertise (what we cover)
-> Get in Touch (general path, RCT-03)

Get in Touch
-> success state -> no further forced navigation (visitor may leave or use the
   header nav normally); this matches the existing confirmed success-state
   behavior, which already offers "Submit another" rather than redirecting.

No page above is a dead end: every page has at least one path back into either
Expertise (the site's strongest content) or Get in Touch (the conversion point).

---

# RESPONSIVE DESIGN NOTES

Documented per page below. All three viewport tiers assume the desktop-canvas
breakpoint already established for Expertise (768px and above gets the fuller
desktop treatment; below 768px gets a purpose-built mobile composition, not a
shrunk desktop layout), and reuse the site's existing responsive conventions
(`md:` for tablet, `lg:`/`xl:` for wider desktop) rather than introducing new
breakpoint logic per page.

## Employers

Desktop: multi-column service grid (matching the existing 3-column Services
section), a 4-pillar differentiator row (matching the existing Facts reason-card
grid), and a wide stat row (matching the existing Facts stat table).
Tablet: service grid drops to 2 columns; differentiator row drops to 2 columns;
stat row remains a single row if it fits, otherwise 2x2.
Mobile: everything becomes a single stacked column; the stat row becomes the
existing Facts mobile pattern (already responsive today) rather than a new
pattern.

## Talent

Desktop: filter sidebar or filter bar plus a multi-column job card grid.
Tablet: filters collapse into a horizontal scroll or an expandable panel; job
cards drop to 2 columns.
Mobile: filters become a single expandable sheet/accordion (consistent with the
existing mobile Expertise-dropdown accordion pattern already built in
`Header.jsx`); job cards stack to a single column.

## Expertise (sector detail pages)

Desktop: large hero, 4-pillar "approach" grid (if that Nexus-inspired structure
is adopted), tag list of domains, role list, CTA.
Tablet: grids drop to 2 columns; layout otherwise unchanged.
Mobile: fully stacked, single column; if a bespoke sector diagram is used, it
should follow the same mobile treatment already established for the 8-sector
grayscale-to-color cards.

## Insights

Desktop: featured large card plus a grid of standard cards (already built,
existing 1.4fr/1fr large-plus-small pattern).
Tablet: featured card remains large; standard grid drops to 2 columns.
Mobile: single column, featured card first, already the existing pattern's
natural mobile behavior once media queries are added; the existing `Insights.jsx`
grid is not yet mobile-tuned and would need a proper single-column mobile
composition as part of implementation, not just a shrink.

## About ALLSEMI

Desktop: large typographic statement, team grid (3 to 4 columns), stat row,
locations block.
Tablet: team grid drops to 2 columns.
Mobile: team grid becomes a single column or a horizontal snap-scroll (matching
the interaction language already used for the Expertise mobile slides), stat
row uses the existing Facts mobile pattern.

## Get in Touch

Already fully responsive today (confirmed, live): the two-panel layout stacks
to a single column on mobile, already implemented in `Enquiry.jsx`. No new
responsive work needed here unless new fields or a new path are approved, in
which case the same existing responsive pattern extends to them directly.

---

# IMPLEMENTATION NOTES (NOT PHASE 2 WORK, CONTEXT ONLY)

- The existing repository has no routing library installed (`package.json`
  lists only `react` and `react-dom`). Multi-page navigation does not exist
  today; the entire site is currently a single scrolling page with anchor
  links. Introducing real pages will require adding a router as a genuine,
  separate implementation decision, not a content decision, and is explicitly
  out of scope for this Phase 1 document.
- The existing `SECTORS` data (in `Expertise.jsx`) is already the shared source
  of truth for the Header dropdown and the Expertise section itself. Any new
  page that references the 8 sectors (Talent's job filters, sector detail
  pages) should continue importing from this same source rather than
  duplicating the list.
- The existing Enquiry component's three paths, validation, and success state
  are solid and should be extended (new fields, a possible fourth path) rather
  than replaced.
- Image sourcing: the current Expertise images are explicitly documented in
  `Expertise.jsx` as placeholders pending real licensed photography. Any new
  page using photography should follow the same documented pattern (a single,
  easily swappable `image` field per item) rather than hard-coding image URLs
  inline throughout new components.
