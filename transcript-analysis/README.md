# AI interview analysis workflow

## Problem and project scope

Customer-discovery interviews contain product requests, workflow problems, and explanations that need to be organized before a team can use them. I assembled a Python/Gemini workflow in Google Colab to help draft a thematic codebook and synthesize feature requests into editable Word reports. The original project involved 29 interview transcripts in PDF, DOCX, and TXT formats.

This repository contains a sanitized source excerpt for inspection. It excludes the original interviews and reports. It also excludes the original notebook's separate theme-validation, frozen-codebook application, and exploratory visualization sections; the excerpt focuses on the two workflows described below.

## Workflow

1. Read text from PDF, DOCX, and TXT files and retain filenames as source labels.
2. Optionally send the labeled corpus to Gemini to generate an initial codebook draft.
3. For feature synthesis, request JSON feature objects from each transcript, including a label, description, pain point, and supporting excerpts.
4. Parse those objects and send them to a second Gemini call to consolidate overlapping requests.
5. Format the resulting draft as a Word document for review.

The source includes a retry helper, basic JSON parsing, processed-file state for the codebook workflow, and Word export. The model performs the semantic extraction and consolidation; this is a scripted workflow rather than a claim of an autonomous agent.

## What to inspect

- [Colab notebook](interview_analyst.ipynb): the document readers, report exporter, draft-codebook prompt, per-transcript extraction prompt, JSON parser, and consolidation step.
- [Fictional example 1](examples/interview_01.txt) and [fictional example 2](examples/interview_02.txt): short inputs created for this portfolio. They are not research participants or evidence of the original project's results.

## Run in Colab

1. Download `interview_analyst.ipynb` and open it in Google Colab using **File → Upload notebook**.
2. Run the dependency-installation cell.
3. Copy the example TXT files into a Google Drive folder named `interview-transcripts`, or change `FOLDER` to a folder containing inputs you are permitted to send to Gemini. Keep generated reports outside the input folder.
4. Run the Drive-mount and shared-setup cells. Supply your own Gemini key through an environment variable or the hidden prompt; do not save the key in the notebook.
5. Run the draft-codebook action, feature-synthesis action, or both. The notebook downloads Word reports from the Colab runtime.

Live calls send transcript content to Gemini and may incur API charges. The local portfolio checks did not make live calls. The notebook retains the historical `google-generativeai` package and model names; verify their current availability or migrate the integration before relying on a new live run. Google identifies this Python SDK as legacy and recommends `google-genai`: [official library documentation](https://ai.google.dev/gemini-api/docs/libraries).

## Limitations and review requirements

- Prompt instructions requesting rigor, exhaustive coverage, or verbatim quotations are not evidence that the model achieved them. Check quotations against the source text and review coding and consolidation decisions.
- PDF extraction reads embedded text; scanned PDFs need OCR outside this notebook. The DOCX reader reads paragraphs, not tables.
- JSON handling checks the outer list and supplies missing fields, but does not fully validate a schema or semantic accuracy. Malformed responses can be skipped, which can make the final report incomplete.
- Codebook drafting sends the corpus in one request, and consolidation sends all extracted feature descriptions together. Input size and output limits can constrain these steps.
- The notebook's legacy integration has not been revalidated against the current Gemini service. No extraction-accuracy, time-saving, or adoption metric is claimed here.
- The source demonstrates the implementation approach; the number 29 describes the original project, not a run included in this repository.
