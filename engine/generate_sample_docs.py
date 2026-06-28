"""
Generate synthetic legal documents for testing Phase 0.
These are realistic but fictional — safe to use for engine testing without a real firm.

Run: python generate_sample_docs.py
Creates text files in sample_docs/ that can be ingested with:
  python ingest.py sample_docs/ --folder sample_matter
"""

import os
from pathlib import Path

OUT_DIR = Path("sample_docs")
OUT_DIR.mkdir(exist_ok=True)


docs = {

"FIR_Krishnamurthy_2023.txt": """\
FIRST INFORMATION REPORT
Police Station: Anna Nagar, Chennai
FIR No.: 147/2023
Date: 14 March 2023

Complainant: Ramesh Krishnamurthy, S/o Suresh Krishnamurthy,
Residing at: No. 42, 3rd Cross Street, Anna Nagar West, Chennai – 600 040.

Nature of Offence: Cheating and Criminal Breach of Trust under IPC Sections 420 and 406.

Brief facts of the complaint:
The complainant states that on 10 January 2023, the accused, one Mr. Balasubramanian Rajan,
approached him claiming to be a property developer, and induced him to invest a sum of
Rupees Fifteen Lakhs (₹15,00,000) for a residential project in Ambattur.
The accused assured a 24-month return with 18% interest and provided a post-dated cheque
bearing no. 004521 dated 15 October 2023 drawn on Indian Bank, Ambattur branch.

On 20 February 2023, when the complainant attempted to verify the project, he discovered
that no such project existed and the accused had absconded from his registered address
at No. 7, Nehru Street, Ambattur, Chennai – 600 053.

The accused's mobile number (98400-XXXXX) has been switched off since 22 February 2023.
Total financial loss to complainant: ₹15,00,000 (Rupees Fifteen Lakhs).

Offence made out: Sections 420 (Cheating), 406 (Criminal breach of trust) IPC.

Signature of complainant: Ramesh Krishnamurthy
Officer-in-Charge: Inspector R. Selvam, Anna Nagar PS
FIR registered: 14 March 2023, 11:45 AM
""",

"Legal_Notice_Krishnamurthy_v_Rajan.txt": """\
LEGAL NOTICE

To,
Mr. Balasubramanian Rajan,
(Last known address) No. 7, Nehru Street, Ambattur, Chennai – 600 053.

Through Registered Post and Email.
Date: 25 March 2023

Dear Sir,

We are instructed by and on behalf of our client, Mr. Ramesh Krishnamurthy,
residing at No. 42, 3rd Cross Street, Anna Nagar West, Chennai – 600 040,
to address this legal notice to you as follows:

1. That our client invested a sum of Rupees Fifteen Lakhs (₹15,00,000) with you
   on 10 January 2023 upon your representation that you were developing a
   residential project in Ambattur, Chennai.

2. That you issued a post-dated cheque bearing No. 004521 dated 15 October 2023
   drawn on Indian Bank, Ambattur Branch, as security.

3. That upon verification, no such project was found to exist and you have absconded.

4. This constitutes cheating punishable under Section 420 IPC and criminal breach
   of trust under Section 406 IPC.

YOU ARE HEREBY CALLED UPON to repay the sum of ₹15,00,000 along with interest
at 12% per annum within 15 (fifteen) days from the date of receipt of this notice.

Failing which, our client shall be constrained to initiate appropriate legal
proceedings before the competent court in Chennai, at your risk, cost and consequence.

Issued by:
Annamalai & Associates, Advocates
12, High Court Road, Chennai – 600 104
Ref: AAA/2023/KRI/047
""",

"Witness_Statement_Gopal.txt": """\
WITNESS STATEMENT
In the matter of: Ramesh Krishnamurthy v. Balasubramanian Rajan
Case Reference: FIR No. 147/2023, Anna Nagar PS

I, Gopalakrishnan Venkat, aged 45 years, residing at No. 18, Gandhi Street,
Ambattur, Chennai – 600 053, do hereby solemnly affirm and state as follows:

1. I am the owner of the premises at No. 7, Nehru Street, Ambattur, which was
   rented to the accused Mr. Balasubramanian Rajan from June 2022 to January 2023.

2. I confirm that on approximately 18 February 2023, the accused vacated the
   premises without notice, leaving behind unpaid rent of ₹36,000 for two months.

3. I am aware that the accused was operating a so-called "property investment"
   business from the rented premises. I personally heard him make phone calls
   promising investors high returns.

4. The accused collected his belongings between 20–21 February 2023 at night.
   No forwarding address was provided.

5. I can identify the accused Mr. Balasubramanian Rajan if shown a photograph.

6. I have no personal connection with the complainant Mr. Ramesh Krishnamurthy.

Affirmed before me on this 28th day of March 2023.

Signature of deponent: G. Venkat
Witness to signature: ________________
Notary / Advocate Commissioner: ________________
""",

"Court_Order_Interim_Apr2023.txt": """\
IN THE CITY CIVIL COURT, CHENNAI
C.S. No. 234 of 2023

Ramesh Krishnamurthy                ... Plaintiff
vs.
Balasubramanian Rajan               ... Defendant

ORDER (Interim — dated 12 April 2023)

This matter came up for hearing before His Honour Judge K. Sundaram on 12 April 2023.

The plaintiff's counsel, Advocate S. Annamalai, appeared and presented the plaint
along with an application for interim injunction under Order XXXIX Rules 1 and 2 CPC,
seeking to restrain the defendant from alienating his assets.

Having perused the plaint, affidavit in support, and the documents filed (FIR No. 147/2023,
Legal Notice dated 25 March 2023, Witness Statement of Mr. Gopalakrishnan Venkat),
this Court is of the opinion that a prima facie case has been made out.

IT IS HEREBY ORDERED:
1. The defendant Mr. Balasubramanian Rajan is restrained from alienating, disposing of,
   or encumbering any of his movable or immovable assets until further orders.
2. Notice to the defendant returnable on 10 May 2023.
3. The plaintiff to effect service through court and by publication if defendant cannot
   be personally served within 7 days.

Sd/-
K. Sundaram
District Judge, City Civil Court, Chennai
12 April 2023
""",

"Contract_Investment_Agreement.txt": """\
INVESTMENT AGREEMENT
(This is a disputed document — submitted as evidence by complainant)

This Agreement is entered into on the 10th day of January 2023 between:

Party A (Investor): Mr. Ramesh Krishnamurthy, No. 42, 3rd Cross Street,
Anna Nagar West, Chennai – 600 040. (hereinafter "Investor")

Party B (Developer): Mr. Balasubramanian Rajan, No. 7, Nehru Street,
Ambattur, Chennai – 600 053, trading as "Rajan Constructions and Developers".
(hereinafter "Developer")

WHEREAS the Developer represents that he is developing a residential apartment project
titled "Greenview Enclave" at Survey No. 118/2A, Ambattur, Chennai.

NOW THEREFORE, in consideration of the mutual covenants herein, the parties agree:

1. INVESTMENT AMOUNT: The Investor agrees to invest a sum of ₹15,00,000 (Rupees
   Fifteen Lakhs) towards the said project.

2. RETURN: The Developer agrees to repay the invested amount along with interest
   at 18% per annum within 24 months from the date of this agreement,
   i.e., on or before 10 January 2025.

3. SECURITY: The Developer provides post-dated cheque No. 004521 dated 15 October 2023
   drawn on Indian Bank, Ambattur Branch, for ₹15,00,000 as security.

4. GOVERNING LAW: This agreement shall be governed by the laws of India.
   Disputes shall be subject to the jurisdiction of courts in Chennai.

Signed by:
Investor: Ramesh Krishnamurthy     Developer: B. Rajan
Date: 10 January 2023
Witness 1: (signature)             Witness 2: (signature)

NOTE: The complainant asserts this agreement is genuine. The defendant's whereabouts
are currently unknown (see FIR No. 147/2023).
""",

"Hearing_Notes_May_June_2023.txt": """\
HEARING NOTES — C.S. No. 234 of 2023
Ramesh Krishnamurthy v. Balasubramanian Rajan
City Civil Court, Chennai — Judge K. Sundaram

---
Hearing Date: 10 May 2023
Appearances: Plaintiff — Adv. S. Annamalai; Defendant — Absent (not served yet)
Notes: Service not effected. Defendant could not be traced at Ambattur address.
Court directed: publication in The Hindu (Chennai edition) on two consecutive Wednesdays.
Next date: 14 June 2023

---
Hearing Date: 14 June 2023
Appearances: Plaintiff — Adv. S. Annamalai; Defendant — Absent
Notes: Publication completed (The Hindu, 24 May and 31 May 2023). No appearance.
Court ordered: Ex-parte proceedings to commence.
Next date: 12 July 2023 (plaintiff's evidence)

---
Hearing Date: 12 July 2023
Appearances: Plaintiff — Adv. S. Annamalai; Plaintiff (Ramesh Krishnamurthy) present
Notes: Plaintiff examined as PW-1. Documents marked:
  Exhibit P-1: FIR No. 147/2023
  Exhibit P-2: Legal Notice dated 25 March 2023 with postal acknowledgement
  Exhibit P-3: Investment Agreement dated 10 January 2023
  Exhibit P-4: Witness Statement of Gopalakrishnan Venkat
  Exhibit P-5: Photograph of accused (from Rajan Constructions business card)
Next date: 9 August 2023 (continued examination of PW-1)
""",

}


def main():
    for filename, content in docs.items():
        path = OUT_DIR / filename
        path.write_text(content, encoding="utf-8")
        print(f"Created: {path}")

    print(f"\n{len(docs)} sample documents created in {OUT_DIR}/")
    print("\nTo ingest them:")
    print("  python ingest.py sample_docs/ --folder krishnamurthy_v_rajan")
    print("\nThen test with:")
    print("  python cli.py --folder krishnamurthy_v_rajan")
    print("\nSample queries to try:")
    print('  "What is the FIR number for the Krishnamurthy case?"')
    print('  "How much money did Krishnamurthy invest?"')
    print('  "What was the court order on 12 April 2023?"')
    print('  "Who is the witness in this case and what did they say?"')
    print('  "What exhibits were marked on 12 July 2023?"')
    print('  "What is the GST rate on textiles?"  ← must say not found')


if __name__ == "__main__":
    main()
